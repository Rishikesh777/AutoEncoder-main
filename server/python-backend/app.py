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
import sys
import secrets
from typing import List
import pymongo
from bson import ObjectId
from dotenv import load_dotenv
from datetime import datetime

# ── path setup ──────────────────────────────────────────────────────────────
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

print(f"DEBUG: sys.path is {sys.path}")

# ── local imports ────────────────────────────────────────────────────────────
try:
    from autoencoder.model import get_autoencoder, WatermarkEmbeddingModule
except ImportError as e:
    print(f"CRITICAL ERROR: Failed to import autoencoder.model: {e}"); raise

try:
    from crypto.hashing import Blake3Hasher, AuthenticationTagGenerator
except ImportError as e:
    print(f"CRITICAL ERROR: Failed to import crypto.hashing: {e}"); raise

try:
    from watermarking.compression import DataCompressor, LSBEmbedder
    from watermarking.scrambler   import PRNGScrambler, ScramblerWithAuth
    from watermarking.iwt         import IWTEmbedder, AdaptiveIWTEmbedder
except ImportError as e:
    print(f"CRITICAL ERROR: Failed to import watermarking: {e}"); raise

try:
    from utils.image_utils   import (image_to_tensor, tensor_to_image,
                                      ensure_even_dims, safe_iwt_transform,
                                      set_device)
    from utils.payload_utils import (combine_tag_and_hash, extract_tag_and_hash,
                                      verify_combined_tag_hash, hash_image_pixels)
except ImportError as e:
    print(f"CRITICAL ERROR: Failed to import utils: {e}"); raise

# ── environment ──────────────────────────────────────────────────────────────
def validate_env():
    required = ["MONGO_URI"]
    missing  = [k for k in required if not os.getenv(k)]
    if missing:
        raise EnvironmentError(
            f"Missing required environment variables: {', '.join(missing)}. "
            "Please check your .env file."
        )

dotenv_path = os.path.join(os.path.dirname(current_dir), '.env')
load_dotenv(dotenv_path if os.path.exists(dotenv_path) else None)
validate_env()

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="AutoEncoder Watermarking API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── MongoDB ───────────────────────────────────────────────────────────────────
try:
    mongo_client       = pymongo.MongoClient(os.getenv("MONGO_URI"), serverSelectionTimeoutMS=5000)
    db                 = mongo_client["autoencoder_portal"]
    watermarked_images = db["watermarked_images"]
    mongo_client.admin.command('ping')
    print("Connected to MongoDB Atlas")
except Exception as e:
    print(f"MongoDB connection error: {e}")
    watermarked_images = None

# ── Autoencoder ───────────────────────────────────────────────────────────────
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
set_device(device)   # propagate to image_utils
try:
    model             = get_autoencoder(device=device)
    watermark_module  = WatermarkEmbeddingModule()
    print(f"Autoencoder loaded on {device}")
except Exception as e:
    print(f"Error loading model: {e}")
    model            = None
    watermark_module = None

# ── Scrambler ─────────────────────────────────────────────────────────────────
MASTER_KEY = os.getenv("SCRAMBLER_KEY") or secrets.token_hex(32)
if not os.getenv("SCRAMBLER_KEY"):
    print("WARNING: SCRAMBLER_KEY not set in environment. Using generated default.")
scrambler = ScramblerWithAuth(MASTER_KEY)


# ═══════════════════════════════════════════════════════════════════════════════
#  ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {"message": "AutoEncoder Python Backend Running"}


# ────────────────────────────────────────────────────────────────────────────
#  /api/autoencoder/embed
# ────────────────────────────────────────────────────────────────────────────
@app.post("/api/autoencoder/embed")
async def embed_data(
    image:   UploadFile = File(...),
    data:    str        = Form(...),
    user_id: str        = Form(None),
):
    """
    Embed user data + combined tag+hash into the image via Huffman + HS.

    Pipeline:
        1.  Convert to grayscale — preserve ALL original pixel content
        2.  Run autoencoder on a 512×512 copy → generate 128-bit tag ONLY
        3.  Blake3-hash the tag -> 256-bit hash
        4.  Compute Blake3 of raw carrier pixels (image integrity hash)
        5.  Assemble payload bytes: [2B len][user data][128B tag][64B tag_hash][64B img_hash]
        6.  PRNG-scramble payload bits with session key
        7.  Huffman-compress scrambled bytes then embed via Histogram Shifting
        8.  Save watermarked image + HS metadata to MongoDB
    """
    try:
        if model is None:
            raise HTTPException(status_code=500, detail="Autoencoder model not loaded")
        if watermarked_images is None:
            raise HTTPException(status_code=503, detail="Database not available")

        contents  = await image.read()
        pil_image = Image.open(io.BytesIO(contents))

        # Step 1 — grayscale
        if pil_image.mode != 'L':
            pil_image = pil_image.convert('L')
        original_size = pil_image.size
        print(f"📷 Original image: {original_size[0]}×{original_size[1]} grayscale")

        # Step 2 — autoencoder tag (double-pass)
        img_tensor = image_to_tensor(pil_image)
        with torch.no_grad():
            reconstructed_tensor, latent = model(img_tensor)
            reconstructed_image          = tensor_to_image(reconstructed_tensor)
            re_tensor                    = image_to_tensor(reconstructed_image)
            _, stable_latent             = model(re_tensor)
            latent_np                    = stable_latent.cpu().numpy().flatten()
            autoencoder_tag = ''.join(str(int(b > 0)) for b in latent_np[:128])
        print(f"📌 Autoencoder tag: {autoencoder_tag[:50]}...")

        # Step 3 — tag hash
        tag_hash = Blake3Hasher.hash_data(autoencoder_tag)
        print(f"🔐 Tag hash: {tag_hash[:30]}...")

        # Step 4 — carrier + image integrity hash
        carrier_array = np.array(pil_image).astype(np.uint8)
        carrier_array = ensure_even_dims(carrier_array)
        carrier_array = np.clip(carrier_array, 5, 250).astype(np.int32)
        print(f"🖼️  Carrier: {carrier_array.shape}, range [{carrier_array.min()}, {carrier_array.max()}]")

        image_hash     = hash_image_pixels(carrier_array.astype(np.uint8))
        print(f"🔒 Image integrity hash: {image_hash[:30]}...")

        # Step 5 — payload bytes
        user_data_bytes = data.encode('utf-8')
        tag_bytes       = autoencoder_tag.encode('ascii')   # 128 chars
        hash_bytes_enc  = tag_hash.encode('ascii')          # 64 hex chars
        image_hash_enc  = image_hash.encode('ascii')        # 64 hex chars
        user_len_prefix = len(user_data_bytes).to_bytes(2, 'big')
        # Layout: [2B len][user data][128B tag][64B tag_hash][64B image_hash]
        raw_payload = user_len_prefix + user_data_bytes + tag_bytes + hash_bytes_enc + image_hash_enc
        print(f"📝 Raw payload: {len(raw_payload)} bytes "
              f"({len(user_data_bytes)} user + 2 prefix + 128 tag + 64 tag_hash + 64 image_hash)")

        # Capacity check
        capacity_bytes = IWTEmbedder.get_capacity(carrier_array)
        print(f"📐 Safe capacity: {capacity_bytes} bytes")
        if len(raw_payload) > capacity_bytes:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Data too large: payload is {len(raw_payload)} bytes, "
                    f"safe capacity is {capacity_bytes} bytes. Shorten the patient data."
                ),
            )

        # Step 6 — PRNG scramble
        auth_result  = AuthenticationTagGenerator.generate_tag(data, autoencoder_tag)
        payload_bits = [int(b) for byte in raw_payload for b in format(byte, '08b')]
        scrambled_bits, indices, session_key = scrambler.scramble_with_auth(
            payload_bits, auth_result['auth_tag']
        )
        scrambled_bytes = bytes(
            int(''.join(
                str(scrambled_bits[i+j] if i+j < len(scrambled_bits) else 0)
                for j in range(8)
            ), 2)
            for i in range(0, len(scrambled_bits), 8)
        )
        print(f"🔄 Scrambled: {len(scrambled_bytes)} bytes, session_key={session_key[:16]}...")

        # Step 7 — HS embed
        watermarked_array, embedded_bits, hs_rounds = IWTEmbedder.embed_in_hh(
            carrier_array.astype(np.uint8), scrambled_bytes
        )
        raw_bit_count = len(scrambled_bits)
        saving_pct    = (1 - embedded_bits / max(raw_bit_count, 1)) * 100
        print(f"💧 HS-embedded {embedded_bits} bits across {len(hs_rounds)} round(s) "
              f"({saving_pct:.1f}% Huffman compression)")
        print(f"✅ Watermarked: {watermarked_array.shape}, "
              f"range [{watermarked_array.min()}, {watermarked_array.max()}]")

        final_image = Image.fromarray(watermarked_array, mode='L')
        img_buffer  = io.BytesIO()
        final_image.save(img_buffer, format='PNG')
        img_base64  = base64.b64encode(img_buffer.getvalue()).decode()

        # Step 8 — persist
        watermarked_doc = {
            'user_id':           user_id,
            'original_name':     image.filename,
            'watermarked_image': img_base64,
            'autoencoder_tag':   autoencoder_tag,
            'auth_tag':          tag_hash,
            'image_hash':        image_hash,
            'session_key':       session_key,
            'scramble_indices':  indices,
            'total_bits':        embedded_bits,
            'raw_payload_bytes': len(raw_payload),
            'user_data_bytes':   len(user_data_bytes),
            'encoding':          'huffman+hs',
            'hs_rounds':         hs_rounds,
            'image_shape':       list(carrier_array.shape),
            'original_size':     list(original_size),
            'subband':           'spatial_hs',
            'created_at':        datetime.utcnow(),
        }
        result = watermarked_images.insert_one(watermarked_doc)
        print(f"✅ Saved to MongoDB with ID: {result.inserted_id}")

        return JSONResponse({
            'success':         True,
            'message':         'Data embedded via Huffman + Histogram Shifting (reversible)',
            'image_id':        str(result.inserted_id),
            'autoencoder_tag': autoencoder_tag,
            'auth_tag':        tag_hash,
            'session_key':     session_key,
            'metadata': {
                'total_bits':        embedded_bits,
                'raw_payload_bytes': len(raw_payload),
                'encoding':          'huffman+hs',
                'hs_rounds':         len(hs_rounds),
                'subband':           'spatial_hs',
                'original_size':     f"{original_size[0]}x{original_size[1]}",
                'embedding_rate':    f"{embedded_bits / (carrier_array.shape[0] * carrier_array.shape[1]):.4f} bpp",
            },
            'image': img_base64,
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Embed error: {str(e)}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ────────────────────────────────────────────────────────────────────────────
#  /api/autoencoder/extract
# ────────────────────────────────────────────────────────────────────────────
@app.post("/api/autoencoder/extract")
async def extract_data(
    image:       UploadFile = File(...),
    image_id:    str        = Form(None),
    session_key: str        = Form(None),
):
    """
    Extract and verify data embedded via Huffman + Histogram Shifting.

    Reverse pipeline:
        1.  Load hs_rounds from MongoDB
        2.  HS-extract scrambled bytes + restore original image pixel-perfectly
        3.  Descramble bits with session key
        4.  Parse payload: [2B len][user data][128B tag][64B tag_hash][64B img_hash]
        5.  Verify Blake3(tag) == tag_hash  (internal consistency)
        5b. Hash restored image and compare to embedded image_hash  (tamper check)
        6.  Generate current autoencoder tag for double-check
        7.  Return verification result
    """
    try:
        print(f"\n{'='*50}\nEXTRACT REQUEST RECEIVED\n{'='*50}")

        if model is None:
            raise HTTPException(status_code=500, detail="Autoencoder model not loaded")

        contents  = await image.read()
        pil_image = Image.open(io.BytesIO(contents))
        if pil_image.mode != 'L':
            pil_image = pil_image.convert('L')

        img_array = np.array(pil_image).astype(np.uint8)
        img_array = ensure_even_dims(img_array)

        # DB look-up
        expected_user_data_bits   = None
        expected_total_bits       = None
        expected_auth_tag         = None
        expected_autoencoder_tag  = None
        expected_session_key      = None
        expected_scramble_indices = None
        expected_hs_rounds        = None
        expected_image_hash       = None

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
                        expected_hs_rounds        = doc.get('hs_rounds')
                        expected_image_hash       = doc.get('image_hash')
                        print(f"✓ Found — total_bits={expected_total_bits}, "
                              f"hs_rounds={len(expected_hs_rounds or [])}")
                        if not session_key and expected_session_key:
                            session_key = expected_session_key
                            print("  Using session_key from DB")
                    else:
                        print(f"✗ No document for image_id: {image_id}")
            except Exception as e:
                print(f"✗ DB lookup error: {e}")

        if image_id and not session_key:
            raise HTTPException(status_code=400, detail=(
                "Session key is required for extraction but was not found in the "
                "database or provided manually."
            ))
        if image_id and not expected_scramble_indices:
            raise HTTPException(status_code=400, detail=(
                "Scramble indices not found in the database for this image_id."
            ))

        # Step 1 — validate hs_rounds
        print("\n--- Step 1: Validating HS rounds ---")
        if not expected_hs_rounds:
            raise HTTPException(status_code=400, detail=(
                "Histogram shifting rounds (hs_rounds) not found. "
                "Please re-embed the image with the current version."
            ))
        print(f"✓ HS rounds loaded: {len(expected_hs_rounds)} round(s)")

        # Step 2 — HS extract + image restore
        print("\n--- Step 2: Histogram shifting extract + image restoration ---")
        try:
            scrambled_bytes_out, restored_image = IWTEmbedder.extract_from_hh(
                img_array, expected_hs_rounds
            )
            print(f"✓ HS extracted: {len(scrambled_bytes_out)} bytes")
            print(f"✓ Original image restored: {restored_image.shape}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Histogram shifting extraction failed: {e}")

        # Step 3 — descramble
        print("\n--- Step 3: Descrambling ---")
        extracted_bits   = [int(b) for byte in scrambled_bytes_out for b in format(byte, '08b')]
        descrambled_bits = extracted_bits

        if expected_scramble_indices and session_key:
            try:
                descrambled_bits = scrambler.descramble_with_auth(
                    extracted_bits, expected_scramble_indices, session_key
                )
                print(f"✓ Descrambling successful ({len(descrambled_bits)} bits)")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Descrambling failed: {e}")
        elif not image_id:
            print("⚠ No image_id provided. Blind extraction attempt.")

        descrambled_payload = bytes(
            int(''.join(
                str(descrambled_bits[i+j] if i+j < len(descrambled_bits) else 0)
                for j in range(8)
            ), 2)
            for i in range(0, len(descrambled_bits), 8)
        )

        # Step 4 — parse payload
        print("\n--- Step 4: Parsing payload ---")
        extracted_tag        = None
        extracted_hash       = None
        extracted_image_hash = None
        extracted_user_data  = ""
        tag_valid            = False

        try:
            user_len             = int.from_bytes(descrambled_payload[:2], 'big')
            user_bytes           = descrambled_payload[2: 2 + user_len]
            tag_start            = 2 + user_len
            extracted_user_data  = user_bytes.decode('utf-8', errors='replace')
            extracted_tag        = descrambled_payload[tag_start:       tag_start + 128].decode('ascii', errors='replace')
            extracted_hash       = descrambled_payload[tag_start + 128: tag_start + 192].decode('ascii', errors='replace')
            extracted_image_hash = descrambled_payload[tag_start + 192: tag_start + 256].decode('ascii', errors='replace')
            print(f"📝 Extracted user data: '{extracted_user_data}'")
            print(f"   Tag preview:        {extracted_tag[:30]}...")
            print(f"   Tag hash preview:   {extracted_hash[:30]}...")
            print(f"   Image hash preview: {(extracted_image_hash or '')[:30]}...")
        except Exception as e:
            print(f"⚠ Payload parse error: {e}")
            extracted_user_data = f"Parse error: {e}"

        # Step 5 — internal consistency
        print("\n--- Step 5: Hash verification ---")
        if extracted_tag and extracted_hash and len(extracted_tag) == 128:
            tag_valid = verify_combined_tag_hash(extracted_tag, extracted_hash)

        # Step 5b — image integrity
        image_integrity_valid = False
        restored_image_hash   = None
        print("\n--- Step 5b: Image integrity check ---")
        try:
            restored_image_hash = hash_image_pixels(restored_image)
            if extracted_image_hash and len(extracted_image_hash) == 64:
                image_integrity_valid = (restored_image_hash == extracted_image_hash)
                print(f"  Restored hash:  {restored_image_hash[:30]}...")
                print(f"  Embedded hash:  {extracted_image_hash[:30]}...")
                print(f"  Match: {'✓ PASSED' if image_integrity_valid else '✗ FAILED — IMAGE WAS TAMPERED'}")
            else:
                print("  ⚠ No image hash in payload (old embed format)")
        except Exception as e:
            print(f"  ⚠ Image hash check error: {e}")

        # Step 6 — current autoencoder tag
        print("\n--- Step 6: Generating current autoencoder tag (double-pass) ---")
        img_tensor = image_to_tensor(pil_image)
        with torch.no_grad():
            reconstructed_tensor, _ = model(img_tensor)
            reconstructed_image     = tensor_to_image(reconstructed_tensor)
            re_tensor               = image_to_tensor(reconstructed_image)
            _, stable_latent        = model(re_tensor)
            latent_np               = stable_latent.cpu().numpy().flatten()
            current_tag = ''.join(str(int(b > 0)) for b in latent_np[:128])
        print(f"Current tag:   {current_tag[:30]}...")
        if extracted_tag:
            print(f"Extracted tag: {extracted_tag[:30]}...")

        # Step 7 — verification result
        print("\n--- Step 7: Verification ---")
        verification_result = {
            'extraction_success':    True,
            'current_tag':           current_tag,
            'extracted_tag':         extracted_tag,
            'extracted_hash':        extracted_hash,
            'tag_valid':             tag_valid,
            'image_integrity_valid': image_integrity_valid,
            'restored_image_hash':   restored_image_hash,
            'embedded_image_hash':   extracted_image_hash,
            'verification_status':   'pending',
            'subband_used':          'spatial_hs',
        }

        if extracted_tag and extracted_hash:
            print(f"Level 1 — Internal hash (Blake3 tag):  {'✓' if tag_valid else '✗'}")
            print(f"Level 2 — Image integrity hash:         {'✓' if image_integrity_valid else '✗'}")
            tag_match_db = (extracted_tag == expected_autoencoder_tag) if expected_autoencoder_tag else False
            print(f"Level 3 — DB autoencoder tag match:     {'✓' if tag_match_db else '✗'}")

            if tag_valid and image_integrity_valid:
                verification_result['verification_status'] = 'verified'
                verification_result['message'] = '✅ All verifications passed — image is authentic and unmodified'
            elif tag_valid and not image_integrity_valid:
                verification_result['verification_status'] = 'tampered'
                verification_result['message'] = '❌ Image has been tampered with — pixel hash mismatch'
            elif not tag_valid:
                verification_result['verification_status'] = 'tampered'
                verification_result['message'] = '❌ Payload integrity check failed — data corrupted or wrong key'
            else:
                verification_result['verification_status'] = 'tampered'
                verification_result['message'] = '❌ Data tampered or corrupted'

        print(f"Final status: {verification_result['verification_status']}")

        return JSONResponse({
            'success':               True,
            'extracted_data':        extracted_user_data,
            'extracted_tag':         extracted_tag,
            'extracted_hash':        extracted_hash,
            'current_tag':           current_tag,
            'tag_valid':             tag_valid,
            'image_integrity_valid': image_integrity_valid,
            'verification':          verification_result,
            'metadata': {
                'extraction_time':       '320ms',
                'data_size':             len(extracted_user_data),
                'bytes_extracted':       len(scrambled_bytes_out),
                'encoding':              'huffman+hs',
                'hs_rounds':             len(expected_hs_rounds),
                'subband_used':          'spatial_hs',
                'image_restored':        True,
                'image_integrity_check': 'passed' if image_integrity_valid else 'FAILED',
            },
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Extract error: {str(e)}")
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ────────────────────────────────────────────────────────────────────────────
#  /api/autoencoder/verify/{image_id}
# ────────────────────────────────────────────────────────────────────────────
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
            'verification_available': True,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ────────────────────────────────────────────────────────────────────────────
#  /api/autoencoder/history/{user_id}
# ────────────────────────────────────────────────────────────────────────────
@app.get("/api/autoencoder/history/{user_id}")
async def get_history(user_id: str):
    try:
        if watermarked_images is None:
            return JSONResponse({'success': True, 'history': []})
        docs    = watermarked_images.find({'user_id': user_id}).sort('created_at', -1).limit(50)
        history = []
        for doc in docs:
            history.append({
                'id':         str(doc['_id']),
                'image_name': doc.get('original_name'),
                'created_at': doc.get('created_at').isoformat() if doc.get('created_at') else None,
                'auth_tag':   doc.get('auth_tag')[:16] + '...' if doc.get('auth_tag') else None,
                'subband':    doc.get('subband', 'HH'),
                'has_image':  True,
            })
        return JSONResponse({'success': True, 'history': history})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)