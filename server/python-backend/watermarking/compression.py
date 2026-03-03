import zlib
import numpy as np
from typing import List

class DataCompressor:
    """Lossless compression using zlib"""
    
    @staticmethod
    def compress_bits(data_bits: List[int], target_ratio: float = 0.1) -> List[int]:
        """
        Losslessly compress bits using zlib
        Returns compressed bits that can be perfectly decompressed
        """
        # Convert bits to bytes
        bytes_data = bytearray()
        for i in range(0, len(data_bits), 8):
            if i + 8 <= len(data_bits):
                byte = 0
                for j in range(8):
                    byte = (byte << 1) | data_bits[i + j]
                bytes_data.append(byte)
        
        # Handle any remaining bits (pad to 8)
        remaining = len(data_bits) % 8
        if remaining > 0:
            last_byte = 0
            for j in range(remaining):
                last_byte = (last_byte << 1) | data_bits[-(remaining - j)]
            last_byte <<= (8 - remaining)
            bytes_data.append(last_byte)
        
        # Compress using zlib (lossless)
        compressed_bytes = zlib.compress(bytes_data, level=9)
        
        # Convert compressed bytes back to bits
        compressed_bits = []
        for byte in compressed_bytes:
            for i in range(7, -1, -1):
                compressed_bits.append((byte >> i) & 1)
        
        # Store original length for decompression
        compressed_bits.extend([int(b) for b in format(len(data_bits), '032b')])
        
        return compressed_bits
    
    @staticmethod
    def decompress_bits(compressed_bits: List[int], original_length: int = None) -> List[int]:
        """
        Losslessly decompress bits back to original
        """
        # Extract original length from the end if not provided
        if original_length is None and len(compressed_bits) > 32:
            length_bits = compressed_bits[-32:]
            original_length = 0
            for bit in length_bits:
                original_length = (original_length << 1) | bit
            compressed_bits = compressed_bits[:-32]
        
        # Convert bits to bytes
        bytes_data = bytearray()
        for i in range(0, len(compressed_bits), 8):
            if i + 8 <= len(compressed_bits):
                byte = 0
                for j in range(8):
                    byte = (byte << 1) | compressed_bits[i + j]
                bytes_data.append(byte)
        
        # Decompress
        decompressed_bytes = zlib.decompress(bytes_data)
        
        # Convert back to bits
        decompressed_bits = []
        for byte in decompressed_bytes:
            for i in range(7, -1, -1):
                decompressed_bits.append((byte >> i) & 1)
        
        # Truncate to original length if specified
        if original_length:
            decompressed_bits = decompressed_bits[:original_length]
        
        return decompressed_bits


class LSBEmbedder:
    """Lossless LSB embedding (1-bit)"""
    
    @staticmethod
    def embed_data(image_array: np.ndarray, data_bits: List[int]) -> np.ndarray:
        """
        Embed data into LSB of image pixels
        Uses 1 LSB bit per pixel
        """
        if len(data_bits) > image_array.size:
            raise ValueError(f"Data too large for image capacity. Image has {image_array.size} pixels, need {len(data_bits)} bits")
        
        watermarked = image_array.copy().flatten()
        
        # Store original LSBs for restoration (for verification)
        original_lsbs = [int(watermarked[i] & 1) for i in range(len(data_bits))]
        
        # Clear LSB and embed data
        for i, bit in enumerate(data_bits):
            watermarked[i] = (watermarked[i] & ~1) | bit
        
        return watermarked.reshape(image_array.shape)
    
    @staticmethod
    def extract_data(image_array: np.ndarray, num_bits: int = None) -> List[int]:
        """Extract data from LSB of image pixels"""
        flattened = image_array.flatten()
        if num_bits is None:
            num_bits = len(flattened)
        return [int(flattened[i] & 1) for i in range(num_bits)]
    
    @staticmethod
    def restore_image(watermarked: np.ndarray, original_lsbs: List[int]) -> np.ndarray:
        """Restore original image by replacing LSBs"""
        restored = watermarked.copy().flatten()
        for i, lsb in enumerate(original_lsbs):
            restored[i] = (restored[i] & ~1) | lsb
        return restored.reshape(watermarked.shape)