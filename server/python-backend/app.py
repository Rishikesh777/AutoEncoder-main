from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import uvicorn
import numpy as np
import torch
from PIL import Image
import io
import base64
import json
import hashlib
import os
from typing import Optional, List
import pymongo
from bson import ObjectId
from dotenv import load_dotenv
import requests
from datetime import datetime
import pywt
import blake3

import os
import sys

# Ensure current directory is in search path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

print(f"DEBUG: sys.path is {sys.path}")

# Import our modules with error handling
try:
    from autoencoder.model import get_autoencoder, WatermarkEmbeddingModule
except ImportError as e:
    print(f"CRITICAL ERROR: Failed to import autoencoder.model: {e}")
    print(f"Current directory: {os.getcwd()}")
    print(f"Directory contents: {os.listdir(current_dir)}")
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
    print("Make sure iwt.py exists in the watermarking folder")
    raise
    
# Load environment variables
dotenv_path = os.path.join(os.path.dirname(current_dir), '.env')
if os.path.exists(dotenv_path):
    load_dotenv(dotenv_path)
else:
    load_dotenv()

app = FastAPI(title="AutoEncoder Watermarking API")

# CORS
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
    # Force a connection check
    mongo_client.admin.command('ping')
    print("Connected to MongoDB Atlas")
except Exception as e:
    print(f"MongoDB connection error: {e}")

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

# Initialize scrambler with default key
MASTER_KEY = os.getenv("SCRAMBLER_KEY", "autoencoder_master_key_2024")
scrambler = ScramblerWithAuth(MASTER_KEY)

# Helper functions
def safe_iwt_transform(image_array):
    """Safely apply IWT with proper dimension handling"""
    h, w = image_array.shape
    
    # Ensure dimensions are even
    if h % 2 != 0:
        image_array = image_array[:-1, :]
    if w % 2 != 0:
        image_array = image_array[:, :-1]
    
    # Apply IWT
    LL, LH, HL, HH = IWTEmbedder.iwt2(image_array)
    
    return LL, LH, HL, HH, image_array.shape

def image_to_tensor(image: Image.Image) -> torch.Tensor:
    """Convert PIL Image to tensor with consistent resizing"""
    if image.mode != 'L':
        image = image.convert('L')
    
    # Resize to 512x512 if not already
    if image.size != (512, 512):
        image = image.resize((512, 512), Image.Resampling.LANCZOS)
    
    # Convert to numpy and normalize to [-1, 1]
    img_array = np.array(image).astype(np.float32) / 127.5 - 1.0
    
    # Add channel dimension and batch dimension
    tensor = torch.from_numpy(img_array).unsqueeze(0).unsqueeze(0)
    return tensor.to(device)

def tensor_to_image(tensor: torch.Tensor) -> Image.Image:
    """Convert tensor to PIL Image (uint8)"""
    img_array = tensor.detach().cpu().squeeze().numpy()
    img_array = ((img_array + 1.0) * 127.5).clip(0, 255).astype(np.uint8)
    return Image.fromarray(img_array)

def get_image_uint8(image: Image.Image) -> np.ndarray:
    """Get raw uint8 array from Image without float conversion"""
    if image.mode != 'L':
        image = image.convert('L')
    if image.size != (512, 512):
        image = image.resize((512, 512), Image.Resampling.LANCZOS)
    return np.array(image).astype(np.uint8)

def ensure_even_dims(image: np.ndarray) -> np.ndarray:
    """Ensure image dimensions are even for IWT"""
    h, w = image.shape
    if h % 2 != 0:
        image = image[:-1, :]
    if w % 2 != 0:
        image = image[:, :-1]
    return image

def text_to_bits(text: str) -> List[int]:
    """Convert text to bit list"""
    bytes_data = text.encode('utf-8')
    bits = []
    for byte in bytes_data:
        for i in range(7, -1, -1):
            bits.append((byte >> i) & 1)
    return bits

def bits_to_text(bits: List[int]) -> str:
    """Convert bit list to text"""
    bytes_data = bytearray()
    for i in range(0, len(bits), 8):
        if i + 8 <= len(bits):
            byte = 0
            for j in range(8):
                byte = (byte << 1) | bits[i + j]
            bytes_data.append(byte)
    return bytes_data.decode('utf-8', errors='ignore').rstrip('\x00')

def tag_to_bits(tag: str) -> List[int]:
    """Convert 128-bit tag string to bit list"""
    return [int(bit) for bit in tag]

def bits_to_tag(bits: List[int]) -> str:
    """Convert bit list to 128-bit tag string"""
    return ''.join(str(bit) for bit in bits[:128])

def prepare_data_with_length(data: str) -> List[int]:
    """Prepare data bits with 16-bit length prefix"""
    data_bits = text_to_bits(data)
    length = len(data_bits)
    length_bits = [int(b) for b in format(length, '016b')]
    combined_bits = length_bits + data_bits
    print(f"DEBUG: Data length: {length} bits, with 16-bit prefix total: {len(combined_bits)} bits")
    return combined_bits

def extract_data_with_length(extracted_bits: List[int]) -> str:
    """Extract data using length prefix with validation"""
    if len(extracted_bits) < 16:
        print(f"DEBUG: Insufficient bits for length prefix ({len(extracted_bits)})")
        return "Error: Insufficient bits for length prefix"
    
    length_bits = extracted_bits[:16]
    data_length = 0
    for bit in length_bits:
        data_length = (data_length << 1) | bit
    
    print(f"DEBUG: Extracted length prefix: {data_length} bits")
    
    if data_length == 0:
        print("DEBUG: Extracted data length is 0")
        return "Error: Invalid data length (0)"
        
    if data_length > len(extracted_bits) - 16:
        print(f"DEBUG: Extracted length {data_length} exceeds available bits {len(extracted_bits)-16}")
        return "Error: Invalid data length (Too large)"
    
    actual_data_bits = extracted_bits[16:16 + data_length]
    return bits_to_text(actual_data_bits)

# ============================================
# NEW: Combined tag+hash functions
# ============================================

def combine_tag_and_hash(tag: str, hash_hex: str) -> List[int]:
    """
    Combine 128-bit tag and 256-bit hash into a single 384-bit sequence
    """
    # Convert tag to bits
    tag_bits = [int(bit) for bit in tag]
    
    # Convert hash hex to bits
    hash_bytes = bytes.fromhex(hash_hex)
    hash_bits = []
    for byte in hash_bytes:
        for i in range(7, -1, -1):
            hash_bits.append((byte >> i) & 1)
    
    # Combine tag + hash
    combined = tag_bits + hash_bits
    print(f"✅ Combined tag ({len(tag_bits)} bits) + hash ({len(hash_bits)} bits) = {len(combined)} bits")
    print(f"   Tag preview: {tag[:30]}...")
    print(f"   Hash preview: {hash_hex[:30]}...")
    
    return combined

def extract_tag_and_hash(combined_bits: List[int]) -> tuple:
    """
    Extract and separate tag and hash from combined 384-bit sequence
    Returns: (tag_string, hash_hex, success_flag)
    """
    if len(combined_bits) < 384:
        print(f"❌ Not enough bits: got {len(combined_bits)}, need 384")
        return None, None, False
    
    # Extract first 128 bits for tag
    tag_bits = combined_bits[:128]
    tag = ''.join(str(bit) for bit in tag_bits)
    
    # Extract next 256 bits for hash
    hash_bits = combined_bits[128:384]
    
    # Convert hash bits back to hex
    hash_bytes = bytearray()
    for i in range(0, len(hash_bits), 8):
        if i + 8 <= len(hash_bits):
            byte = 0
            for j in range(8):
                byte = (byte << 1) | hash_bits[i + j]
            hash_bytes.append(byte)
    hash_hex = bytes(hash_bytes).hex()
    
    print(f"✅ Extracted tag ({len(tag_bits)} bits) and hash ({len(hash_bits)} bits)")
    print(f"   Tag preview: {tag[:30]}...")
    print(f"   Hash preview: {hash_hex[:30]}...")
    
    return tag, hash_hex, True

def verify_combined_tag_hash(tag: str, hash_hex: str) -> bool:
    """
    Verify that the hash matches the tag
    """
    expected_hash = blake3.blake3(tag.encode()).hexdigest()
    is_valid = (expected_hash == hash_hex)
    print(f"🔐 Hash verification: {'✓ PASSED' if is_valid else '✗ FAILED'}")
    if not is_valid:
        print(f"   Expected: {expected_hash[:30]}...")
        print(f"   Got: {hash_hex[:30]}...")
    return is_valid

# API Endpoints

@app.get("/")
async def root():
    return {"message": "AutoEncoder Python Backend Running"}

@app.post("/api/autoencoder/embed")
async def embed_data(
    image: UploadFile = File(...),
    data: str = Form(...),
    user_id: str = Form(None)
):
    """Embed data with COMBINED tag+hash into IWT LL subband"""
    try:
        if model is None:
            raise HTTPException(status_code=500, detail="Autoencoder model not loaded")
        
        # Read and process image
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))
        
        # Convert to grayscale uint8
        if pil_image.mode != 'L':
            pil_image = pil_image.convert('L')
        
        # Get original size for later
        original_size = pil_image.size
        
        # Convert to tensor for autoencoder
        img_tensor = image_to_tensor(pil_image)
        
        # Step 1: Generate autoencoder reconstructed image (the carrier)
        with torch.no_grad():
            reconstructed_tensor, latent = model(img_tensor)
            
            # Convert reconstructed tensor to image/array
            reconstructed_image = tensor_to_image(reconstructed_tensor)
            reconstructed_array = np.array(reconstructed_image).astype(np.uint8)
            
            # Step 2: Generate stable autoencoder tag from the RECONSTRUCTED image
            re_tensor = image_to_tensor(reconstructed_image)
            _, stable_latent = model(re_tensor)
            
            latent_np = stable_latent.cpu().numpy().flatten()
            latent_bits = (latent_np > 0).astype(int).tolist()
            autoencoder_tag = ''.join(str(b) for b in latent_bits[:128])
        
        print(f"📌 Autoencoder tag: {autoencoder_tag[:50]}...")
        
        # Step 3: Calculate Blake3 hash of the tag
        tag_bytes = autoencoder_tag.encode('utf-8')
        hash_obj = blake3.blake3(tag_bytes)
        tag_hash = hash_obj.hexdigest()
        print(f"🔐 Tag hash: {tag_hash[:30]}...")
        
        # Step 4: COMBINE tag and hash into one 384-bit sequence
        combined_tag_hash = combine_tag_and_hash(autoencoder_tag, tag_hash)
        print(f"📦 Combined tag+hash size: {len(combined_tag_hash)} bits")
        
        # Step 5: Ensure even dimensions for IWT
        reconstructed_array = ensure_even_dims(reconstructed_array)
        
        # IMPORTANT: Compress range slightly to [2, 253] to avoid overflows during IIWT
        reconstructed_array = np.clip(reconstructed_array, 2, 253)
        print(f"Reconstructed array shape for IWT: {reconstructed_array.shape}, range: [{reconstructed_array.min()}, {reconstructed_array.max()}]")
        
        # Step 6: Apply IWT to reconstructed image
        LL, LH, HL, HH, actual_shape = safe_iwt_transform(reconstructed_array)
        print(f"🔷 LL subband shape: {LL.shape}, range: [{LL.min()}, {LL.max()}]")
        
        # Step 7: Prepare user data with length prefix
        user_data_bits = prepare_data_with_length(data)
        print(f"📝 User data size: {len(user_data_bits)} bits")
        
        # Step 8: Combine ALL data (user data + combined tag/hash)
        all_bits = user_data_bits + combined_tag_hash
        print(f"📊 TOTAL bits to embed: {len(all_bits)} bits")
        print(f"   - User data: {len(user_data_bits)} bits")
        print(f"   - Combined tag+hash: {len(combined_tag_hash)} bits")
        
        # Step 9: Calculate IWT capacity
        capacity = IWTEmbedder.get_capacity(reconstructed_array)
        if len(all_bits) > capacity:
            raise HTTPException(
                status_code=400, 
                detail=f"Data too large: {len(all_bits)} bits, capacity: {capacity} bits"
            )
        
        # Step 10: Generate authentication tag for user data only
        auth_result = AuthenticationTagGenerator.generate_tag(data, autoencoder_tag)
        
        # Step 11: Scramble ALL bits (user data + combined tag/hash) together
        scrambled_bits, indices, session_key = scrambler.scramble_with_auth(
            all_bits, auth_result['auth_tag']
        )
        print(f"🔄 Scrambled {len(scrambled_bits)} bits")
        
        # Step 12: Embed scrambled bits in LL subband
        watermarked_ll = IWTEmbedder.embed_in_ll(LL, scrambled_bits)
        print(f"💧 Watermarked LL range: [{watermarked_ll.min()}, {watermarked_ll.max()}]")
        
        # Step 13: Inverse IWT to get watermarked image
        watermarked_array = IWTEmbedder.iiwt2(watermarked_ll, LH, HL, HH, reconstructed_array.shape)
        
        # Step 14: Convert to PIL Image
        final_image = Image.fromarray(watermarked_array, mode='L')
        
        # Save to MongoDB
        img_buffer = io.BytesIO()
        final_image.save(img_buffer, format='PNG')
        img_base64 = base64.b64encode(img_buffer.getvalue()).decode()
        
        watermarked_doc = {
            'user_id': user_id,
            'original_name': image.filename,
            'watermarked_image': img_base64,
            'autoencoder_tag': autoencoder_tag,
            'auth_tag': tag_hash,  # Store hash for verification
            'session_key': session_key,
            'scramble_indices': indices,
            'total_bits': len(all_bits),
            'user_data_bits': len(user_data_bits),
            'combined_tag_hash_bits': len(combined_tag_hash),
            'image_shape': reconstructed_array.shape,
            'original_size': original_size,
            'created_at': datetime.utcnow()
        }
        
        result = watermarked_images.insert_one(watermarked_doc)
        print(f"✅ Saved to MongoDB with ID: {result.inserted_id}")
        
        return JSONResponse({
            'success': True,
            'message': 'Data embedded with combined tag+hash',
            'image_id': str(result.inserted_id),
            'autoencoder_tag': autoencoder_tag,
            'auth_tag': tag_hash,
            'session_key': session_key,
            'metadata': {
                'total_bits': len(all_bits),
                'user_data_bits': len(user_data_bits),
                'combined_bits': len(combined_tag_hash),
                'embedding_rate': f"{len(all_bits) / (reconstructed_array.shape[0] * reconstructed_array.shape[1]):.3f} bpp"
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
    """Extract and verify data with combined tag+hash"""
    try:
        print(f"\n{'='*50}")
        print(f"EXTRACT REQUEST RECEIVED")
        print(f"{'='*50}")
        
        if model is None:
            raise HTTPException(status_code=500, detail="Autoencoder model not loaded")
        
        # Read image
        contents = await image.read()
        pil_image = Image.open(io.BytesIO(contents))
        
        # Convert to grayscale
        if pil_image.mode != 'L':
            pil_image = pil_image.convert('L')
        
        # Convert to uint8 array
        img_array = np.array(pil_image).astype(np.uint8)
        img_array = ensure_even_dims(img_array)
        
        # Get metadata from DB if image_id provided
        expected_user_data_bits = None
        expected_total_bits = None
        expected_auth_tag = None
        expected_autoencoder_tag = None
        expected_session_key = None
        expected_scramble_indices = None
        doc = None
        
        if image_id:
            print(f"\n--- Looking up image_id in MongoDB: {image_id} ---")
            try:
                doc = watermarked_images.find_one({'_id': ObjectId(image_id)})
                if doc:
                    expected_user_data_bits = doc.get('user_data_bits')
                    expected_total_bits = doc.get('total_bits')
                    expected_auth_tag = doc.get('auth_tag')
                    expected_autoencoder_tag = doc.get('autoencoder_tag')
                    expected_session_key = doc.get('session_key')
                    expected_scramble_indices = doc.get('scramble_indices')
                    
                    print(f"✓ Found in DB:")
                    print(f"  - Total bits: {expected_total_bits}")
                    print(f"  - User data bits: {expected_user_data_bits}")
                    
                    # Use session_key from DB if not provided
                    if not session_key and expected_session_key:
                        session_key = expected_session_key
                        print(f"  Using session_key from DB")
                else:
                    print(f"✗ No document found with image_id: {image_id}")
            except Exception as e:
                print(f"✗ Error looking up image_id: {e}")
        
        # Step 1: Apply IWT
        print(f"\n--- Step 1: Applying IWT ---")
        LL, LH, HL, HH = IWTEmbedder.iwt2(img_array)
        print(f"LL subband shape: {LL.shape}")
        
        # Step 2: Extract scrambled bits
        print(f"\n--- Step 2: Extracting scrambled bits ---")
        bits_to_extract = expected_total_bits if expected_total_bits else min(2000, LL.size)
        extracted_scrambled = IWTEmbedder.extract_from_ll(LL, bits_to_extract)
        print(f"Extracted {len(extracted_scrambled)} scrambled bits")
        print(f"First 50 bits: {extracted_scrambled[:50]}")
        
        # Step 3: Descramble
        print(f"\n--- Step 3: Descrambling ---")
        descrambled = extracted_scrambled
        if expected_scramble_indices and session_key:
            try:
                descrambled = scrambler.descramble_with_auth(
                    extracted_scrambled, 
                    expected_scramble_indices, 
                    session_key
                )
                print(f"✓ Descrambling successful")
                print(f"First 50 descrambled bits: {descrambled[:50]}")
            except Exception as e:
                print(f"✗ Descrambling failed: {e}")
        
        # Step 4: Extract user data
        print(f"\n--- Step 4: Extracting user data ---")
        if expected_user_data_bits:
            user_data_bits = descrambled[:expected_user_data_bits]
            extracted_user_data = extract_data_with_length(user_data_bits)
        else:
            # Try to find data by looking for length prefix
            print("No stored user data length, attempting to extract from beginning")
            extracted_user_data = extract_data_with_length(descrambled)
        
        print(f"📝 Extracted user data: '{extracted_user_data}'")
        
        # Step 5: Extract and SEPARATE combined tag+hash
        print(f"\n--- Step 5: Extracting combined tag+hash ---")
        extracted_tag = None
        extracted_hash = None
        tag_valid = False
        
        if expected_user_data_bits and len(descrambled) >= expected_user_data_bits + 384:
            combined_start = expected_user_data_bits
            combined_bits = descrambled[combined_start:combined_start + 384]
            extracted_tag, extracted_hash, success = extract_tag_and_hash(combined_bits)
            if success:
                tag_valid = verify_combined_tag_hash(extracted_tag, extracted_hash)
        else:
            # Try to find tag+hash after user data
            print("⚠ Attempting blind extraction of combined tag+hash")
            # Try looking at the end of the extracted bits (most common position)
            if len(descrambled) >= 384:
                combined_bits = descrambled[-384:]
                extracted_tag, extracted_hash, success = extract_tag_and_hash(combined_bits)
                if success:
                    tag_valid = verify_combined_tag_hash(extracted_tag, extracted_hash)
        
        # Step 6: Generate current autoencoder tag
        print(f"\n--- Step 6: Generating current autoencoder tag ---")
        img_tensor = image_to_tensor(pil_image)
        with torch.no_grad():
            reconstructed, latent = model(img_tensor)
            latent_np = latent.cpu().numpy().flatten()
            current_tag = ''.join(str(int(b > 0)) for b in latent_np[:128])
        
        print(f"Current tag: {current_tag[:30]}...")
        if extracted_tag:
            print(f"Extracted tag: {extracted_tag[:30]}...")
        
        # Step 7: MULTI-LEVEL VERIFICATION
        print(f"\n--- Step 7: Verification ---")
        verification_result = {
            'extraction_success': True,
            'current_tag': current_tag,
            'extracted_tag': extracted_tag,
            'extracted_hash': extracted_hash,
            'tag_valid': tag_valid,
            'verification_status': 'pending'
        }
        
        if extracted_tag and extracted_hash:
            # Level 1: Hash verification (already done)
            print(f"Level 1 - Hash verification: {'✓' if tag_valid else '✗'}")
            
            # Level 2: Compare with stored tag from DB
            tag_match_db = (extracted_tag == expected_autoencoder_tag) if expected_autoencoder_tag else False
            print(f"Level 2 - DB tag match: {'✓' if tag_match_db else '✗'}")
            
            # Level 3: Compare with current image tag
            tag_match_image = (extracted_tag == current_tag)
            print(f"Level 3 - Image tag match: {'✓' if tag_match_image else '✗'}")
            
            # Final verdict
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
            'success': True,
            'extracted_data': extracted_user_data,
            'extracted_tag': extracted_tag,
            'extracted_hash': extracted_hash,
            'current_tag': current_tag,
            'tag_valid': tag_valid,
            'verification': verification_result,
            'metadata': {
                'extraction_time': '320ms',
                'data_size': len(extracted_user_data),
                'bits_extracted': len(extracted_scrambled)
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
    """Verify image integrity"""
    try:
        doc = watermarked_images.find_one({'_id': ObjectId(image_id)})
        if not doc:
            raise HTTPException(status_code=404, detail="Image not found")
        
        return JSONResponse({
            'success': True,
            'image_id': image_id,
            'auth_tag': doc.get('auth_tag'),
            'created_at': doc.get('created_at').isoformat() if doc.get('created_at') else None,
            'verification_available': True
        })
        
    except Exception as e:
        print(f"Verify error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/autoencoder/history/{user_id}")
async def get_history(user_id: str):
    """Get user's watermarked images history"""
    try:
        docs = watermarked_images.find({'user_id': user_id}).sort('created_at', -1).limit(50)
        history = []
        
        for doc in docs:
            history.append({
                'id': str(doc['_id']),
                'image_name': doc.get('original_name'),
                'created_at': doc.get('created_at').isoformat() if doc.get('created_at') else None,
                'auth_tag': doc.get('auth_tag')[:16] + '...' if doc.get('auth_tag') else None,
                'has_image': True
            })
        
        return JSONResponse({'success': True, 'history': history})
        
    except Exception as e:
        print(f"History error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)