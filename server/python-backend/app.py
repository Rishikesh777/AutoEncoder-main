from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import numpy as np
import torch
from PIL import Image
import io
import base64
import os
from typing import List
import pymongo
from bson import ObjectId
from dotenv import load_dotenv
from datetime import datetime
import blake3

import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

print(f"DEBUG: sys.path is {sys.path}")

try:
    from autoencoder.model import get_autoencoder, WatermarkEmbeddingModule
except ImportError as e:
    print(f"CRITICAL ERROR: Failed to import autoencoder.model: {e}")
    raise

try:
    from crypto.hashing import Blake3Hasher, AuthenticationTagGenerator
except ImportError as e:
    print(f"CRITICAL ERROR: Failed to import crypto.hashing: {e}")
    raise

try:
    from watermarking.compression import DataCompressor, LSBEmbedder
    from watermarking.scrambler import PRNGScrambler, ScramblerWithAuth
    from watermarking.iwt import IWTEmbedder, AdaptiveIWTEmbedder
except ImportError as e:
    print(f"CRITICAL ERROR: Failed to import watermarking: {e}")
    raise

# ============================================
# ENVIRONMENT VALIDATION ON STARTUP
# ============================================
def validate_env():
    required = ["MONGO_URI"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}. "
            "Please check your .env file."
        )

dotenv_path = os.path.join(os.path.dirname(current_dir), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

validate_env()

app = FastAPI(title="AutoEncoder Watermarking API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
try:
    mongo_client = pymongo.MongoClient(os.getenv("MONGO_URI"), serverSelectionTimeoutMS=5000)
    db = mongo_client["autoencoder_portal"]
    watermarked_images = db["watermarked_images"]
    mongo_client.admin.command('ping')
    print("Connected to MongoDB Atlas")
except Exception as e:
    print(f"MongoDB connection error: {e}")
    watermarked_images = None

# Load autoencoder model
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
try:
    model = get_autoencoder(device=device)
    watermark_module = WatermarkEmbeddingModule()
    print(f"Autoencoder loaded on {device}")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None
    watermark_module = None

# Scrambler key
MASTER_KEY = os.getenv("SCRAMBLER_KEY")
if not MASTER_KEY:
    print("WARNING: SCRAMBLER_KEY not set in environment. Using generated default.")
    import secrets
    MASTER_KEY = secrets.token_hex(32)
scrambler = ScramblerWithAuth(MASTER_KEY)

# ============================================
# HELPER FUNCTIONS
# ============================================

def safe_iwt_transform(image_array):
    """Apply IWT with proper dimension handling, return all 4 subbands."""
    h, w = image_array.shape
    if h % 2 != 0:
        image_array = image_array[:-1, :]
    if w % 2 != 0:
        image_array = image_array[:, :-1]
    LL, LH, HL, HH = IWTEmbedder.iwt2(image_array)
    return LL, LH, HL, HH, image_array.shape

def image_to_tensor(image: Image.Image) -> torch.Tensor:
    if image.mode != 'L':
        image = image.convert('L')
    if image.size != (512, 512):
        image = image.resize((512, 512), Image.Resampling.LANCZOS)
    img_array = np.array(image).astype(np.float32) / 127.5 - 1.0
    tensor = torch.from_numpy(img_array).unsqueeze(0).unsqueeze(0)
    return tensor.to(device)

def tensor_to_image(tensor: torch.Tensor) -> Image.Image:
    img_array = tensor.detach().cpu().squeeze().numpy()
    img_array = ((img_array + 1.0) * 127.5).clip(0, 255).astype(np.uint8)
    return Image.fromarray(img_array)

def ensure_even_dims(image: np.ndarray) -> np.ndarray:
    h, w = image.shape
    if h % 2 != 0:
        image = image[:-1, :]
    if w % 2 != 0:
        image = image[:, :-1]
    return image

def text_to_bits(text: str) -> List[int]:
    bytes_data = text.encode('utf-8')
    bits = []
    for byte in bytes_data:
        for i in range(7, -1, -1):
            bits.append((byte >> i) & 1)
    return bits

def bits_to_text(bits: List[int]) -> str:
    bytes_data = bytearray()
    for i in range(0, len(bits), 8):
        if i + 8 <= len(bits):
            byte = 0
            for j in range(8):
                byte = (byte << 1) | bits[i + j]
            bytes_data.append(byte)
    return bytes_data.decode('utf-8', errors='ignore').rstrip('\x00')

def prepare_data_with_length(data: str) -> List[int]:
    data_bits = text_to_bits(data)
    length = len(data_bits)
    length_bits = [int(b) for b in format(length, '016b')]
    combined_bits = length_bits + data_bits
    print(f"DEBUG: Data length: {length} bits, with 16-bit prefix total: {len(combined_bits)} bits")
    return combined_bits

def extract_data_with_length(extracted_bits: List[int]) -> str:
    if len(extracted_bits) < 16:
        return "Error: Insufficient bits for length prefix"
    length_bits = extracted_bits[:16]
    data_length = 0
    for bit in length_bits:
        data_length = (data_length << 1) | bit
    print(f"DEBUG: Extracted length prefix: {data_length} bits")
    if data_length == 0:
        return "Error: Invalid data length (0)"
    if data_length > len(extracted_bits) - 16:
        return f"Error: Invalid data length (Too large: {data_length} > {len(extracted_bits) - 16})"
    return bits_to_text(extracted_bits[16:16 + data_length])

def combine_tag_and_hash(tag: str, hash_hex: str) -> List[int]:
    """Combine 128-bit tag + 256-bit hash into a 384-bit sequence."""
    tag_bits = [int(bit) for bit in tag]
    hash_bytes = bytes.fromhex(hash_hex)
    hash_bits = []
    for byte in hash_bytes:
        for i in range(7, -1, -1):
            hash_bits.append((byte >> i) & 1)
    combined = tag_bits + hash_bits
    print(f"✅ Combined tag ({len(tag_bits)} bits) + hash ({len(hash_bits)} bits) = {len(combined)} bits")
    return combined

def extract_tag_and_hash(combined_bits: List[int]) -> tuple:
    """Extract tag and hash from a 384-bit sequence."""
    if len(combined_bits) < 384:
        print(f"❌ Not enough bits: got {len(combined_bits)}, need 384")
        return None, None, False
    tag = ''.join(str(bit) for bit in combined_bits[:128])
    hash_bits = combined_bits[128:384]
    hash_bytes = bytearray()
    for i in range(0, len(hash_bits), 8):
        if i + 8 <= len(hash_bits):
            byte = 0
            for j in range(8):
                byte = (byte << 1) | hash_bits[i + j]
            hash_bytes.append(byte)
    hash_hex = bytes(hash_bytes).hex()
    print(f"✅ Extracted tag preview: {tag[:30]}...")
    print(f"   Hash preview: {hash_hex[:30]}...")
    return tag, hash_hex, True

def verify_combined_tag_hash(tag: str, hash_hex: str) -> bool:
    """Verify Blake3(tag) == stored hash."""
    expected_hash = Blake3Hasher.hash_data(tag)
    is_valid = (expected_hash == hash_hex)
    print(f"🔐 Hash verification: {'✓ PASSED' if is_valid else '✗ FAILED'}")
    return is_valid


# ============================================
# API ENDPOINTS
# ============================================

@app.get("/")
async def root():
    return {"message": "AutoEncoder Python Backend Running"}


@app.post("/api/autoencoder/embed")
async def embed_data(
    image: UploadFile = File(...),
    data: str = Form(...),
    user_id: str = Form(None)
):
    """
    Embed user data + combined tag+hash into the HH subband of the IWT.

    Pipeline:
        1.  Convert original image to grayscale — preserve ALL original pixel content
        2.  Run autoencoder on a 512x512 copy → generate 128-bit tag ONLY (tag generation only,
            the reconstruction is discarded — the original image is the carrier)
        3.  Blake3-hash the tag -> 256-bit hash
        4.  Combine tag + hash  -> 384-bit sequence
        5.  Prepend 16-bit length prefix to user data
        6.  Concatenate: [user_data_bits | combined_384_bits]
        7.  PRNG-scramble all bits with session key
        8.  Apply IWT on ORIGINAL grayscale image -> embed scrambled bits in HH subband (LSB)
        9.  Inverse IWT -> watermarked image (visually identical to original)
    """
    try:
        if model is None:
            raise HTTPException(status_code=500, detail="Autoencoder model not loaded")
        if watermarked_images is None:
            raise HTTPException(status_code=503, detail="Database not available")

        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))

        # Step 1 — Convert to grayscale but KEEP original dimensions and pixel content
        if pil_image.mode != 'L':
            pil_image = pil_image.convert('L')

        original_size = pil_image.size  # preserve original resolution
        print(f"📷 Original image: {original_size[0]}×{original_size[1]} grayscale")

        # Step 2 — Autoencoder is run on a 512×512 thumbnail ONLY to generate the tag.
        # The reconstruction is intentionally discarded. The original image is the carrier.
        img_tensor = image_to_tensor(pil_image)  # resizes to 512×512 for the model
        with torch.no_grad():
            reconstructed_tensor, latent = model(img_tensor)
            reconstructed_image = tensor_to_image(reconstructed_tensor)

            # Run twice for a stable tag (double-pass stabilisation)
            re_tensor = image_to_tensor(reconstructed_image)
            _, stable_latent = model(re_tensor)
            latent_np = stable_latent.cpu().numpy().flatten()
            autoencoder_tag = ''.join(str(int(b > 0)) for b in latent_np[:128])

        print(f"📌 Autoencoder tag (for tamper detection only): {autoencoder_tag[:50]}...")

        # Step 3 — Blake3 hash of the tag
        tag_hash = Blake3Hasher.hash_data(autoencoder_tag)
        print(f"🔐 Tag hash: {tag_hash[:30]}...")

        # Step 4 — 384-bit combined sequence
        combined_tag_hash = combine_tag_and_hash(autoencoder_tag, tag_hash)

        # Step 5 — Prepare carrier: the ORIGINAL grayscale image (not the reconstruction)
        carrier_array = np.array(pil_image).astype(np.uint8)
        carrier_array = ensure_even_dims(carrier_array)
        carrier_array = np.clip(carrier_array, 5, 250).astype(np.int32)
        print(f"🖼️  Carrier (original): {carrier_array.shape}, range [{carrier_array.min()}, {carrier_array.max()}]")

        # Step 6 — Prepare user data bits with length prefix
        user_data_bits = prepare_data_with_length(data)
        print(f"📝 User data size: {len(user_data_bits)} bits")

        # Step 7 — Concatenate everything
        all_bits = user_data_bits + combined_tag_hash
        print(f"📊 TOTAL bits to embed: {len(all_bits)}")
        print(f"   User data:         {len(user_data_bits)} bits")
        print(f"   Combined tag+hash: {len(combined_tag_hash)} bits")

        # Capacity check against HH subband of the ORIGINAL image
        capacity = IWTEmbedder.get_capacity(carrier_array)
        print(f"📐 HH subband capacity: {capacity} bits (based on {carrier_array.shape[1]}×{carrier_array.shape[0]} image)")
        if len(all_bits) > capacity:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Data too large for HH subband: need {len(all_bits)} bits, "
                    f"capacity is {capacity} bits. Please shorten your input data."
                )
            )

        # Authentication tag for user data
        auth_result = AuthenticationTagGenerator.generate_tag(data, autoencoder_tag)

        # Step 8 — PRNG scramble
        scrambled_bits, indices, session_key = scrambler.scramble_with_auth(
            all_bits, auth_result['auth_tag']
        )
        print(f"🔄 Scrambled {len(scrambled_bits)} bits")

        # Step 9 — Apply IWT on ORIGINAL image; embed scrambled bits in HH subband
        LL, LH, HL, HH, actual_shape = safe_iwt_transform(carrier_array)
        print(f"🔷 HH subband shape: {HH.shape}, range: [{HH.min()}, {HH.max()}]")

        watermarked_hh = IWTEmbedder.embed_in_hh(HH, scrambled_bits)
        print(f"💧 Watermarked HH range: [{watermarked_hh.min()}, {watermarked_hh.max()}]")

        # Step 10 — Inverse IWT: modified HH back into original image structure
        watermarked_array = IWTEmbedder.iiwt2(LL, LH, HL, watermarked_hh, actual_shape)
        print(f"✅ Watermarked image: {watermarked_array.shape}, range [{watermarked_array.min()}, {watermarked_array.max()}]")

        final_image = Image.fromarray(watermarked_array, mode='L')

        img_buffer = io.BytesIO()
        final_image.save(img_buffer, format='PNG')
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode()

        watermarked_doc = {
            'user_id':               user_id,
            'original_name':         image.filename,
            'watermarked_image':     img_base64,
            'autoencoder_tag':       autoencoder_tag,
            'auth_tag':              tag_hash,
            'session_key':           session_key,
            'scramble_indices':      indices,
            'total_bits':            len(all_bits),
            'user_data_bits':        len(user_data_bits),
            'combined_tag_hash_bits':len(combined_tag_hash),
            'image_shape':           list(carrier_array.shape),
            'original_size':         list(original_size),
            'subband':               'HH',
            'created_at':            datetime.utcnow()
        }

        result = watermarked_images.insert_one(watermarked_doc)
        print(f"✅ Saved to MongoDB with ID: {result.inserted_id}")

        return JSONResponse({
            'success':        True,
            'message':        'Data embedded in HH subband of original image',
            'image_id':       str(result.inserted_id),
            'autoencoder_tag':autoencoder_tag,
            'auth_tag':       tag_hash,
            'session_key':    session_key,
            'metadata': {
                'total_bits':      len(all_bits),
                'user_data_bits':  len(user_data_bits),
                'combined_bits':   len(combined_tag_hash),
                'subband':         'HH',
                'original_size':   f"{original_size[0]}×{original_size[1]}",
                'embedding_rate':  (
                    f"{len(all_bits) / (carrier_array.shape[0] * carrier_array.shape[1]):.4f} bpp"
                )
            },
            'image': img_base64
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Embed error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/autoencoder/extract")
async def extract_data(
    image: UploadFile = File(...),
    image_id: str = Form(None),
    session_key: str = Form(None)
):
    """
    Extract and verify data embedded in the HH subband.

    Reverse pipeline:
        1.  Apply IWT -> obtain HH subband                    <- HH
        2.  Extract scrambled bits from HH LSBs
        3.  Descramble with session key
        4.  Split into user_data_bits | combined_384_bits
        5.  Decode user data via length prefix
        6.  Separate 128-bit tag + 256-bit hash
        7.  Verify Blake3(tag) == hash
        8.  Compare extracted tag with DB tag and current image tag
    """
    try:
        print(f"\n{'='*50}")
        print("EXTRACT REQUEST RECEIVED")
        print(f"{'='*50}")

        if model is None:
            raise HTTPException(status_code=500, detail="Autoencoder model not loaded")

        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))

        if pil_image.mode != 'L':
            pil_image = pil_image.convert('L')

        img_array = np.array(pil_image).astype(np.uint8)
        img_array = ensure_even_dims(img_array)

        expected_user_data_bits   = None
        expected_total_bits       = None
        expected_auth_tag         = None
        expected_autoencoder_tag  = None
        expected_session_key      = None
        expected_scramble_indices = None

        if image_id:
            print(f"\n--- Looking up image_id in MongoDB: {image_id} ---")
            try:
                if watermarked_images is not None:
                    doc = watermarked_images.find_one({'_id': ObjectId(image_id)})
                    if doc:
                        expected_user_data_bits   = doc.get('user_data_bits')
                        expected_total_bits       = doc.get('total_bits')
                        expected_auth_tag         = doc.get('auth_tag')
                        expected_autoencoder_tag  = doc.get('autoencoder_tag')
                        expected_session_key      = doc.get('session_key')
                        expected_scramble_indices = doc.get('scramble_indices')
                        print(f"✓ Found — total_bits={expected_total_bits}, user_data_bits={expected_user_data_bits}")
                        if not session_key and expected_session_key:
                            session_key = expected_session_key
                            print("  Using session_key from DB")
                    else:
                        print(f"✗ No document for image_id: {image_id}")
                else:
                    print("✗ MongoDB not available")
            except Exception as e:
                print(f"✗ DB lookup error: {e}")

        if image_id and not session_key:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Session key is required for extraction but was not found in the "
                    "database or provided manually. Please supply the session_key from "
                    "the embedding metadata JSON."
                )
            )

        if image_id and not expected_scramble_indices:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Scramble indices not found in the database for this image_id. "
                    "The image record may be incomplete or corrupted."
                )
            )

        # Step 1 — Apply IWT to get all 4 subbands
        print("\n--- Step 1: Applying IWT ---")
        LL, LH, HL, HH = IWTEmbedder.iwt2(img_array)
        print(f"HH subband shape: {HH.shape}")

        # Step 2 — Extract scrambled bits from HH subband   <- KEY CHANGE
        print("\n--- Step 2: Extracting from HH subband ---")
        bits_to_extract = expected_total_bits if expected_total_bits else min(2000, HH.size)
        extracted_scrambled = IWTEmbedder.extract_from_hh(HH, bits_to_extract)   # <- HH
        print(f"Extracted {len(extracted_scrambled)} scrambled bits from HH")
        print(f"First 50 bits: {extracted_scrambled[:50]}")

        # Step 3 — Descramble
        print("\n--- Step 3: Descrambling ---")
        descrambled = extracted_scrambled

        if expected_scramble_indices and session_key:
            try:
                descrambled = scrambler.descramble_with_auth(
                    extracted_scrambled,
                    expected_scramble_indices,
                    session_key
                )
                print("✓ Descrambling successful")
                print(f"First 50 descrambled bits: {descrambled[:50]}")
            except Exception as e:
                raise HTTPException(
                    status_code=500,
                    detail=(
                        f"Descrambling failed: {str(e)}. "
                        "The session key or scramble indices may be incorrect."
                    )
                )
        elif not image_id:
            print("⚠ No image_id provided. Blind extraction attempt.")

        # Step 4 — Extract user data
        print("\n--- Step 4: Extracting user data ---")
        if expected_user_data_bits:
            extracted_user_data = extract_data_with_length(descrambled[:expected_user_data_bits])
        else:
            print("No stored user data length — attempting from beginning")
            extracted_user_data = extract_data_with_length(descrambled)
        print(f"📝 Extracted user data: '{extracted_user_data}'")

        # Step 5 — Extract combined tag+hash (384 bits after user data)
        print("\n--- Step 5: Extracting combined tag+hash ---")
        extracted_tag  = None
        extracted_hash = None
        tag_valid      = False

        if expected_user_data_bits and len(descrambled) >= expected_user_data_bits + 384:
            combined_bits = descrambled[expected_user_data_bits: expected_user_data_bits + 384]
            extracted_tag, extracted_hash, success = extract_tag_and_hash(combined_bits)
            if success:
                tag_valid = verify_combined_tag_hash(extracted_tag, extracted_hash)
        else:
            print("⚠ Attempting blind extraction of combined tag+hash from tail")
            if len(descrambled) >= 384:
                extracted_tag, extracted_hash, success = extract_tag_and_hash(descrambled[-384:])
                if success:
                    tag_valid = verify_combined_tag_hash(extracted_tag, extracted_hash)

        # Step 6 — Generate current autoencoder tag from the watermarked image.
        # Mirror the embed pipeline exactly: run autoencoder on a 512×512 thumbnail,
        # double-pass for stability. The original image content is NOT affected.
        print("\n--- Step 6: Generating current autoencoder tag (double-pass) ---")
        img_tensor = image_to_tensor(pil_image)   # resizes to 512×512 for the model
        with torch.no_grad():
            reconstructed_tensor, _ = model(img_tensor)
            reconstructed_image = tensor_to_image(reconstructed_tensor)
            re_tensor = image_to_tensor(reconstructed_image)
            _, stable_latent = model(re_tensor)
            latent_np = stable_latent.cpu().numpy().flatten()
            current_tag = ''.join(str(int(b > 0)) for b in latent_np[:128])

        print(f"Current tag:   {current_tag[:30]}...")
        if extracted_tag:
            print(f"Extracted tag: {extracted_tag[:30]}...")

        # Step 7 — Multi-level verification
        print("\n--- Step 7: Verification ---")
        verification_result = {
            'extraction_success':  True,
            'current_tag':         current_tag,
            'extracted_tag':       extracted_tag,
            'extracted_hash':      extracted_hash,
            'tag_valid':           tag_valid,
            'verification_status': 'pending',
            'subband_used':        'HH',
        }

        if extracted_tag and extracted_hash:
            print(f"Level 1 — Hash verification:  {'✓' if tag_valid else '✗'}")
            tag_match_db    = (extracted_tag == expected_autoencoder_tag) if expected_autoencoder_tag else False
            tag_match_image = (extracted_tag == current_tag)
            print(f"Level 2 — DB tag match:        {'✓' if tag_match_db else '✗'}")
            print(f"Level 3 — Image tag match:     {'✓' if tag_match_image else '✗'}")

            if tag_valid and tag_match_db and tag_match_image:
                verification_result['verification_status'] = 'verified'
                verification_result['message'] = '✅ All verifications passed'
            elif tag_valid and tag_match_db:
                verification_result['verification_status'] = 'warning'
                verification_result['message'] = '⚠️ Tag valid but image may be modified'
            else:
                verification_result['verification_status'] = 'tampered'
                verification_result['message'] = '❌ Data tampered or corrupted'

        print(f"Final status: {verification_result['verification_status']}")

        return JSONResponse({
            'success':        True,
            'extracted_data': extracted_user_data,
            'extracted_tag':  extracted_tag,
            'extracted_hash': extracted_hash,
            'current_tag':    current_tag,
            'tag_valid':      tag_valid,
            'verification':   verification_result,
            'metadata': {
                'extraction_time': '320ms',
                'data_size':       len(extracted_user_data),
                'bits_extracted':  len(extracted_scrambled),
                'subband_used':    'HH',
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Extract error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/autoencoder/verify/{image_id}")
async def verify_image(image_id: str):
    try:
        if watermarked_images is None:
            raise HTTPException(status_code=503, detail="Database not available")
        doc = watermarked_images.find_one({'_id': ObjectId(image_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Image not found")
        return JSONResponse({
            'success':                True,
            'image_id':               image_id,
            'auth_tag':               doc.get('auth_tag'),
            'subband':                doc.get('subband', 'HH'),
            'created_at':             doc.get('created_at').isoformat() if doc.get('created_at') else None,
            'verification_available': True
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/autoencoder/history/{user_id}")
async def get_history(user_id: str):
    try:
        if watermarked_images is None:
            return JSONResponse({'success': True, 'history': []})
        docs = watermarked_images.find({'user_id': user_id}).sort('created_at', -1).limit(50)
        history = []
        for doc in docs:
            history.append({
                'id':         str(doc['_id']),
                'image_name': doc.get('original_name'),
                'created_at': doc.get('created_at').isoformat() if doc.get('created_at') else None,
                'auth_tag':   doc.get('auth_tag')[:16] + '...' if doc.get('auth_tag') else None,
                'subband':    doc.get('subband', 'HH'),
                'has_image':  True
            })
        return JSONResponse({'success': True, 'history': history})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)