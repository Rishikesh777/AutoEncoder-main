"""
Payload Utilities
=================
Bit-level helpers for building and parsing the watermark payload, plus
tag/hash manipulation and image-integrity hashing.
"""

import numpy as np
import blake3
from typing import List, Optional, Tuple

from crypto.hashing import Blake3Hasher


# ---------------------------------------------------------------------------
#  Text <-> bit conversions
# ---------------------------------------------------------------------------

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
    """Encode *data* as UTF-8 bits with a 16-bit length prefix."""
    data_bits   = text_to_bits(data)
    length      = len(data_bits)
    length_bits = [int(b) for b in format(length, '016b')]
    combined    = length_bits + data_bits
    print(f"DEBUG: Data length: {length} bits, with 16-bit prefix total: {len(combined)} bits")
    return combined


def extract_data_with_length(extracted_bits: List[int]) -> str:
    """Decode bits that were encoded with prepare_data_with_length()."""
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


# ---------------------------------------------------------------------------
#  Tag + hash helpers
# ---------------------------------------------------------------------------

def combine_tag_and_hash(tag: str, hash_hex: str) -> List[int]:
    """Combine 128-bit tag + 256-bit hash into a 384-bit sequence."""
    tag_bits   = [int(bit) for bit in tag]
    hash_bytes = bytes.fromhex(hash_hex)
    hash_bits  = []
    for byte in hash_bytes:
        for i in range(7, -1, -1):
            hash_bits.append((byte >> i) & 1)
    combined = tag_bits + hash_bits
    print(f"✅ Combined tag ({len(tag_bits)} bits) + hash ({len(hash_bits)} bits) = {len(combined)} bits")
    return combined


def extract_tag_and_hash(combined_bits: List[int]) -> Tuple[Optional[str], Optional[str], bool]:
    """Extract tag and hash from a 384-bit sequence."""
    if len(combined_bits) < 384:
        print(f"❌ Not enough bits: got {len(combined_bits)}, need 384")
        return None, None, False
    tag        = ''.join(str(bit) for bit in combined_bits[:128])
    hash_bits  = combined_bits[128:384]
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
    is_valid      = (expected_hash == hash_hex)
    print(f"🔐 Hash verification: {'✓ PASSED' if is_valid else '✗ FAILED'}")
    return is_valid


# ---------------------------------------------------------------------------
#  Image integrity hashing
# ---------------------------------------------------------------------------

def hash_image_pixels(image_array: np.ndarray) -> str:
    """
    Compute a Blake3 hash of the raw pixel bytes of a grayscale image array.
    Any pixel change anywhere in the image produces a completely different hash.
    """
    pixel_bytes = image_array.astype(np.uint8).tobytes()
    return blake3.blake3(pixel_bytes).hexdigest()
