"""
IWT Embedder
============
Integer Wavelet Transform (CDF 5/3) utilities, plus thin embed/extract
wrappers that delegate to Huffman coding + Histogram Shifting.

Public surface used by app.py:
  IWTEmbedder.iwt2()           – forward IWT
  IWTEmbedder.iiwt2()          – inverse IWT
  IWTEmbedder.embed_in_hh()    – Huffman-compress then HS-embed
  IWTEmbedder.extract_from_hh()– HS-extract then Huffman-decode
  IWTEmbedder.get_capacity()   – estimated safe byte capacity

AdaptiveIWTEmbedder – legacy, kept for reference only.
"""

import numpy as np
from typing import List, Tuple

from watermarking.huffman          import HuffmanCodec
from watermarking.histogram_shift  import hs_embed, hs_extract, hs_capacity


class IWTEmbedder:
    """
    Integer Wavelet Transform utilities + histogram-shifting embed wrapper.

    The IWT (iwt2 / iiwt2) is kept intact and is still called by
    safe_iwt_transform() in app.py for any subband work.

    embed_in_hh() and extract_from_hh() use HISTOGRAM SHIFTING on the
    spatial image, giving pixel-perfect reversibility.
    """

    # ------------------------------------------------------------------
    #  Forward IWT — CDF 5/3
    # ------------------------------------------------------------------
    @staticmethod
    def iwt2(image: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        img = image.astype(np.int32)
        h, w = img.shape

        if h % 2 != 0: img = img[:-1, :]; h -= 1
        if w % 2 != 0: img = img[:, :-1]; w -= 1

        even_r = img[0::2, :].copy()
        odd_r  = img[1::2, :].copy()

        for i in range(odd_r.shape[0]):
            pred      = (even_r[i] + even_r[i+1]) // 2 if i < even_r.shape[0]-1 else even_r[i]
            odd_r[i] -= pred
        for i in range(1, even_r.shape[0]-1):
            even_r[i] += (odd_r[i-1] + odd_r[i] + 2) // 4

        temp = np.zeros_like(img)
        temp[0::2, :] = even_r
        temp[1::2, :] = odd_r[:temp[1::2].shape[0], :]

        even_c = temp[:, 0::2].copy()
        odd_c  = temp[:, 1::2].copy()

        for j in range(odd_c.shape[1]):
            pred        = (even_c[:, j] + even_c[:, j+1]) // 2 if j < even_c.shape[1]-1 else even_c[:, j]
            odd_c[:, j] -= pred
        for j in range(1, even_c.shape[1]-1):
            even_c[:, j] += (odd_c[:, j-1] + odd_c[:, j] + 2) // 4

        LL = even_c[0::2, :].copy()
        LH = odd_c[0::2,  :].copy()
        HL = even_c[1::2, :].copy()
        HH = odd_c[1::2,  :].copy()

        return LL, LH, HL, HH

    # ------------------------------------------------------------------
    #  Inverse IWT — CDF 5/3
    # ------------------------------------------------------------------
    @staticmethod
    def iiwt2(
        LL: np.ndarray, LH: np.ndarray,
        HL: np.ndarray, HH: np.ndarray,
        original_shape: Tuple[int, int],
    ) -> np.ndarray:
        h, w   = original_shape
        w_half = w // 2

        even_c = np.zeros((h, w_half), dtype=np.int32)
        odd_c  = np.zeros((h, w_half), dtype=np.int32)

        even_c[0::2, :] = LL[:even_c[0::2].shape[0], :w_half]
        even_c[1::2, :] = HL[:even_c[1::2].shape[0], :w_half]
        odd_c[0::2,  :] = LH[:odd_c[0::2].shape[0],  :w_half]
        odd_c[1::2,  :] = HH[:odd_c[1::2].shape[0],  :w_half]

        for j in range(1, even_c.shape[1]-1):
            even_c[:, j] -= (odd_c[:, j-1] + odd_c[:, j] + 2) // 4
        for j in range(odd_c.shape[1]):
            pred = (even_c[:, j] + even_c[:, j+1]) // 2 if j < even_c.shape[1]-1 else even_c[:, j]
            odd_c[:, j] += pred

        temp = np.zeros((h, w), dtype=np.int32)
        temp[:, 0::2] = even_c
        temp[:, 1::2] = odd_c[:, :temp[:, 1::2].shape[1]]

        even_r = temp[0::2, :].copy()
        odd_r  = temp[1::2, :].copy()

        for i in range(1, even_r.shape[0]-1):
            even_r[i] -= (odd_r[i-1] + odd_r[i] + 2) // 4
        for i in range(odd_r.shape[0]):
            pred = (even_r[i] + even_r[i+1]) // 2 if i < even_r.shape[0]-1 else even_r[i]
            odd_r[i] += pred

        result = np.zeros_like(temp)
        result[0::2, :] = even_r
        result[1::2, :] = odd_r[:result[1::2].shape[0], :]

        return np.clip(result, 0, 255).astype(np.uint8)

    # ------------------------------------------------------------------
    #  embed_in_hh — Huffman-compress then histogram-shift embed
    # ------------------------------------------------------------------
    @staticmethod
    def embed_in_hh(
        carrier_image: np.ndarray,
        data_bytes: bytes,
    ) -> Tuple[np.ndarray, int, List[tuple]]:
        """
        Huffman-compress *data_bytes* then embed via histogram shifting.

        Returns
        -------
        watermarked : np.ndarray   watermarked image (uint8, same shape)
        n_bits      : int          bits written
        hs_rounds   : List[tuple]  HS metadata — save in MongoDB.
                                   Format: [(peak, zero_val, side, n_bits), ...]
        """
        compressed_bits        = HuffmanCodec.encode(data_bytes)
        watermarked, hs_rounds = hs_embed(carrier_image, compressed_bits)
        return watermarked, len(compressed_bits), hs_rounds

    # ------------------------------------------------------------------
    #  extract_from_hh — histogram-shift extract + Huffman decode
    # ------------------------------------------------------------------
    @staticmethod
    def extract_from_hh(
        watermarked_image: np.ndarray,
        hs_rounds: List[tuple],
    ) -> Tuple[bytes, np.ndarray]:
        """
        Extract payload and restore the original image pixel-perfectly.

        Returns
        -------
        payload  : bytes         recovered payload bytes
        restored : np.ndarray    original image — pixel-perfect
        """
        total_bits         = sum(r[3] for r in hs_rounds)
        all_bits, restored = hs_extract(watermarked_image, hs_rounds)
        payload_bytes      = HuffmanCodec.decode(all_bits[:total_bits])
        return payload_bytes, restored

    # ------------------------------------------------------------------
    #  get_capacity — estimated safe byte capacity via HS
    # ------------------------------------------------------------------
    @staticmethod
    def get_capacity(image: np.ndarray) -> int:
        """Estimate safe embedding capacity in BYTES using histogram shifting."""
        bits = hs_capacity(image, n_rounds=5)
        return max(0, int(bits * 0.9) // 8)


class AdaptiveIWTEmbedder:
    """Legacy adaptive HH-subband embedder — kept for reference only."""

    @staticmethod
    def embed_adaptive(hh_band: np.ndarray, data_bits: List[int]) -> np.ndarray:
        wm   = hh_band.copy()
        flat = wm.flatten()
        for i, bit in enumerate(data_bits):
            if i >= len(flat): break
            c = flat[i]; m = abs(c)
            if   m > 100: flat[i] = (c//4)*4 + (2 if bit else 0)
            elif m > 50:  flat[i] = (c//2)*2 + (1 if bit else 0)
            else:         flat[i] = (c | 1)   if bit else (c & ~1)
        return flat.reshape(wm.shape)

    @staticmethod
    def extract_adaptive(hh_band: np.ndarray, num_bits: int) -> List[int]:
        flat = hh_band.flatten()
        out  = []
        for i in range(min(num_bits, len(flat))):
            c = flat[i]; m = abs(c)
            if   m > 100: out.append(1 if (c%4) >= 2 else 0)
            elif m > 50:  out.append(1 if (c%2) == 1 else 0)
            else:         out.append(int(c % 2))
        return out