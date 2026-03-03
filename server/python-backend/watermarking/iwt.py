import numpy as np
from typing import List, Tuple, Optional

class IWTEmbedder:
    """
    Integer Wavelet Transform (IWT) using CDF 5/3 wavelet
    Perfect reconstruction guaranteed
    """
    
    @staticmethod
    def iwt2(image: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Forward Integer Wavelet Transform (2D)
        Using CDF 5/3 wavelet (lossless integer transform)
        
        Args:
            image: Input image as uint8 array
            
        Returns:
            LL, LH, HL, HH subbands as int32
        """
        # Convert to int32 for processing
        img = image.astype(np.int32)
        h, w = img.shape
        
        # Ensure even dimensions
        if h % 2 != 0:
            img = img[:-1, :]
            h -= 1
        if w % 2 != 0:
            img = img[:, :-1]
            w -= 1
        
        # Horizontal transform (along rows)
        even_rows = img[0::2, :].copy()  # Even rows (0,2,4...)
        odd_rows = img[1::2, :].copy()   # Odd rows (1,3,5...)
        
        # Prediction step (predict odd from even)
        # For boundaries, use nearest neighbor
        for i in range(odd_rows.shape[0]):
            if i < even_rows.shape[0] - 1:
                predicted = (even_rows[i, :] + even_rows[i+1, :]) // 2
            else:
                # Last odd row - use previous even row only
                predicted = even_rows[i, :]
            odd_rows[i, :] = odd_rows[i, :] - predicted
        
        # Update step (update even using odd)
        for i in range(1, even_rows.shape[0] - 1):
            even_rows[i, :] = even_rows[i, :] + (odd_rows[i-1, :] + odd_rows[i, :] + 2) // 4
        
        # Reconstruct temporary image
        temp = np.zeros_like(img)
        temp[0::2, :] = even_rows
        temp[1::2, :] = odd_rows[:temp[1::2].shape[0], :]
        
        # Vertical transform (along columns)
        even_cols = temp[:, 0::2].copy()
        odd_cols = temp[:, 1::2].copy()
        
        # Prediction step for columns
        for j in range(odd_cols.shape[1]):
            if j < even_cols.shape[1] - 1:
                predicted = (even_cols[:, j] + even_cols[:, j+1]) // 2
            else:
                predicted = even_cols[:, j]
            odd_cols[:, j] = odd_cols[:, j] - predicted
        
        # Update step for columns
        for j in range(1, even_cols.shape[1] - 1):
            even_cols[:, j] = even_cols[:, j] + (odd_cols[:, j-1] + odd_cols[:, j] + 2) // 4
        
        # Assemble subbands
        # Row 0,2,4... are LL/LH, row 1,3,5... are HL/HH
        LL = even_cols[0::2, :].copy()
        LH = odd_cols[0::2, :].copy()
        HL = even_cols[1::2, :].copy()
        HH = odd_cols[1::2, :].copy()
        
        return LL, LH, HL, HH
    
    @staticmethod
    def iiwt2(LL: np.ndarray, LH: np.ndarray, HL: np.ndarray, HH: np.ndarray, original_shape: Tuple[int, int]) -> np.ndarray:
        """
        Inverse Integer Wavelet Transform
        Perfect reconstruction from subbands
        """
        h, w = original_shape
        h_half, w_half = h // 2, w // 2
        
        # Reconstruct even and odd columns by interleaving rows
        # LL and HL go into even_cols (horizontal low components)
        # LH and HH go into odd_cols (horizontal high components)
        even_cols = np.zeros((h, w_half), dtype=np.int32)
        odd_cols = np.zeros((h, w_half), dtype=np.int32)
        
        even_cols[0::2, :] = LL[:even_cols[0::2].shape[0], :even_cols.shape[1]]
        even_cols[1::2, :] = HL[:even_cols[1::2].shape[0], :even_cols.shape[1]]
        
        odd_cols[0::2, :] = LH[:odd_cols[0::2].shape[0], :odd_cols.shape[1]]
        odd_cols[1::2, :] = HH[:odd_cols[1::2].shape[0], :odd_cols.shape[1]]
        
        # Inverse horizontal transform (along rows, but it's processing columns)
        # Inverse update for columns
        for j in range(1, even_cols.shape[1] - 1):
            even_cols[:, j] = even_cols[:, j] - (odd_cols[:, j-1] + odd_cols[:, j] + 2) // 4
        
        # Inverse prediction for columns
        for j in range(odd_cols.shape[1]):
            if j < even_cols.shape[1] - 1:
                predicted = (even_cols[:, j] + even_cols[:, j+1]) // 2
            else:
                predicted = even_cols[:, j]
            odd_cols[:, j] = odd_cols[:, j] + predicted
        
        # Combine columns to get temp
        temp = np.zeros((h, w), dtype=np.int32)
        temp[:, 0::2] = even_cols
        temp[:, 1::2] = odd_cols[:, :temp[:, 1::2].shape[1]]
        
        # Inverse vertical transform (along rows)
        even_rows = temp[0::2, :].copy()
        odd_rows = temp[1::2, :].copy()
        
        # Inverse update for rows
        for i in range(1, even_rows.shape[0] - 1):
            even_rows[i, :] = even_rows[i, :] - (odd_rows[i-1, :] + odd_rows[i, :] + 2) // 4
        
        # Inverse prediction for rows
        for i in range(odd_rows.shape[0]):
            if i < even_rows.shape[0] - 1:
                predicted = (even_rows[i, :] + even_rows[i+1, :]) // 2
            else:
                predicted = even_rows[i, :]
            odd_rows[i, :] = odd_rows[i, :] + predicted
        
        # Reconstruct final image
        result = np.zeros_like(temp)
        result[0::2, :] = even_rows
        result[1::2, :] = odd_rows[:result[1::2].shape[0], :]
        
        # Clip to valid range
        return np.clip(result, 0, 255).astype(np.uint8)
    
    @staticmethod
    def embed_in_ll(ll_band: np.ndarray, data_bits: List[int]) -> np.ndarray:
        """
        Embed data bits into LL subband coefficients
        Uses LSB modification of coefficients
        """
        watermarked_ll = ll_band.copy()
        ll_flat = watermarked_ll.flatten()
        
        if len(data_bits) > len(ll_flat):
            raise ValueError(f"Data too large: {len(data_bits)} bits, capacity: {len(ll_flat)} bits")
        
        # Embed data in LSB of coefficients
        for i, bit in enumerate(data_bits):
            if bit == 1:
                # Make coefficient odd
                if ll_flat[i] % 2 == 0:
                    ll_flat[i] += 1
            else:
                # Make coefficient even
                if ll_flat[i] % 2 == 1:
                    ll_flat[i] -= 1
        
        return ll_flat.reshape(watermarked_ll.shape)
    
    @staticmethod
    def extract_from_ll(ll_band: np.ndarray, num_bits: int) -> List[int]:
        """
        Extract data bits from LL subband coefficients
        Reads LSB of coefficients
        """
        ll_flat = ll_band.flatten()
        extracted_bits = []
        
        for i in range(min(num_bits, len(ll_flat))):
            extracted_bits.append(int(ll_flat[i] % 2))
        
        return extracted_bits
    
    @staticmethod
    def get_capacity(image: np.ndarray) -> int:
        """
        Calculate embedding capacity in bits
        LL subband is 1/4 of image size
        """
        h, w = image.shape
        h_even = h - (h % 2)
        w_even = w - (w % 2)
        ll_size = (h_even // 2) * (w_even // 2)
        return ll_size


class AdaptiveIWTEmbedder:
    """
    Enhanced IWT embedder with adaptive strength based on coefficient magnitude
    """
    
    @staticmethod
    def embed_adaptive(ll_band: np.ndarray, data_bits: List[int]) -> np.ndarray:
        """
        Adaptive embedding - stronger modifications for larger coefficients
        """
        watermarked_ll = ll_band.copy()
        ll_flat = watermarked_ll.flatten()
        
        for i, bit in enumerate(data_bits):
            if i >= len(ll_flat):
                break
            
            coeff = ll_flat[i]
            magnitude = abs(coeff)
            
            # Adaptive strength based on coefficient magnitude
            if magnitude > 100:
                # Use 2-bit embedding for large coefficients
                if bit == 1:
                    target = (coeff // 4) * 4 + 2
                else:
                    target = (coeff // 4) * 4
            elif magnitude > 50:
                # Use 1-bit embedding for medium coefficients
                if bit == 1:
                    target = (coeff // 2) * 2 + 1
                else:
                    target = (coeff // 2) * 2
            else:
                # Simple LSB for small coefficients
                if bit == 1:
                    target = coeff | 1
                else:
                    target = coeff & ~1
            
            watermarked_ll.flat[i] = target
        
        return watermarked_ll
    
    @staticmethod
    def extract_adaptive(ll_band: np.ndarray, num_bits: int) -> List[int]:
        """
        Extract bits using adaptive strength detection
        """
        ll_flat = ll_band.flatten()
        extracted_bits = []
        
        for i in range(min(num_bits, len(ll_flat))):
            coeff = ll_flat[i]
            magnitude = abs(coeff)
            
            if magnitude > 100:
                # Extract 2-bit embedding
                bit = 1 if (coeff % 4) >= 2 else 0
            elif magnitude > 50:
                # Extract 1-bit embedding
                bit = 1 if (coeff % 2) == 1 else 0
            else:
                # Simple LSB
                bit = int(coeff % 2)
            
            extracted_bits.append(bit)
        
        return extracted_bits