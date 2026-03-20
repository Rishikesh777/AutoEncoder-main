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
import base64


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
    #  PEE embed — IWT → HH → Prediction Error Expansion → Inverse IWT
    # ------------------------------------------------------------------
    @staticmethod
    def embed_in_hh(
        carrier_image: np.ndarray,
        data_bytes: bytes,
    ) -> Tuple[np.ndarray, int, dict]:
        """
        Embed data_bytes into the HH subband using Prediction Error Expansion (PEE).

        Key design: embed only at ODD-indexed HH pixels, using EVEN-indexed
        pixels as predictors. Even pixels are NEVER modified, so their values
        are identical in both the original and stego arrays — guaranteeing that
        the predictor value is always known exactly during extraction without
        any cascading errors.

        For odd pixel i:
          pred = flat[i-1]   (even — never modified)
          e    = flat[i] - pred
          e==0  → embed bit: 0 stays 0, 1 becomes 1   (location_map[i]=1)
          e==1  → shift to 2 to vacate the e=1 slot    (shift_map[i]=1)
          else  → leave untouched

        Returns
        -------
        watermarked  : np.ndarray  stego image (uint8, same shape as input)
        n_bits       : int         number of payload bits embedded
        pee_metadata : dict        everything needed for extraction + restoration
        """
        original_shape = carrier_image.shape

        # Step 1 — Forward IWT
        LL, LH, HL, HH = IWTEmbedder.iwt2(carrier_image)
        hh_shape = HH.shape
        flat     = HH.astype(np.int32).flatten()
        n        = len(flat)

        # Step 2 — Huffman compress
        compressed_bits = HuffmanCodec.encode(data_bytes)
        n_bits_needed   = len(compressed_bits)
        print(f"  PEE: payload = {n_bits_needed} bits after Huffman compression")

        # Step 3 — PEE embed (odd indices only)
        location_map  = np.zeros(n, dtype=np.uint8)  # 1 = bit embedded (e=0 expanded)
        shift_map     = np.zeros(n, dtype=np.uint8)  # 1 = pixel shifted (e=1 → e=2)
        modified_flat = flat.copy()
        bit_idx       = 0

        for i in range(1, n, 2):   # ODD indices only
            if bit_idx >= n_bits_needed:
                break
            pred = flat[i - 1]     # EVEN predictor — never modified
            e    = flat[i] - pred

            if e == 0:
                # Expand: embed bit by shifting e from 0 to 0 or 1
                modified_flat[i] = pred + compressed_bits[bit_idx]
                location_map[i]  = 1
                bit_idx         += 1
            elif e == 1:
                # Shift e=1 → e=2 to vacate the embedding slot
                modified_flat[i] = flat[i] + 1
                shift_map[i]     = 1

        n_bits_embedded = bit_idx
        print(f"  PEE: embedded {n_bits_embedded} / {n_bits_needed} bits")
        if n_bits_embedded < n_bits_needed:
            raise ValueError(
                f"PEE capacity insufficient: needed {n_bits_needed} bits, "
                f"only {n_bits_embedded} available. Use a larger image or shorter data."
            )

        # Step 4 — Reconstruct IWT array with modified HH
        new_HH = modified_flat.reshape(hh_shape).astype(np.int32)

        # Step 5 — Inverse IWT → stego image
        stego = IWTEmbedder.iiwt2(LL, LH, HL, new_HH, original_shape)

        # Encode maps as base64 for MongoDB storage
        location_b64 = base64.b64encode(np.packbits(location_map).tobytes()).decode()
        shift_b64    = base64.b64encode(np.packbits(shift_map).tobytes()).decode()

        pee_metadata = {
            'n_bits_embedded':  n_bits_embedded,
            'n_pixels':         n,
            'hh_shape':         list(hh_shape),
            'original_shape':   list(original_shape),
            'location_map_b64': location_b64,
            'shift_map_b64':    shift_b64,
        }

        return stego, n_bits_embedded, pee_metadata

    # ------------------------------------------------------------------
    #  PEE extract — Inverse of embed_in_hh
    # ------------------------------------------------------------------
    @staticmethod
    def extract_from_hh(
        watermarked_image: np.ndarray,
        pee_metadata: dict,
    ) -> Tuple[bytes, np.ndarray]:
        """
        Extract embedded payload and restore the original image pixel-perfectly.

        Pipeline (reverse of embed):
            1. Forward IWT on stego image → get modified HH
            2. Using location_map and overflow_map, extract bits and undo expansion
            3. Using overflow_map, undo the shifts on overflow pixels
            4. Reconstruct original HH → Inverse IWT → original image

        Returns
        -------
        payload  : bytes         recovered payload bytes (Huffman-encoded bits decoded)
        restored : np.ndarray    original image — pixel-perfect
        """
        n_bits_embedded = pee_metadata['n_bits_embedded']
        n_pixels        = pee_metadata['n_pixels']
        hh_shape        = tuple(pee_metadata['hh_shape'])
        original_shape  = tuple(pee_metadata['original_shape'])

        # Decode maps from base64
        location_packed = np.frombuffer(
            base64.b64decode(pee_metadata['location_map_b64']), dtype=np.uint8)
        shift_packed    = np.frombuffer(
            base64.b64decode(pee_metadata['shift_map_b64']), dtype=np.uint8)
        location_map    = np.unpackbits(location_packed)[:n_pixels]
        shift_map       = np.unpackbits(shift_packed)[:n_pixels]

        # Step 1 — Forward IWT on stego image
        LL, LH, HL, HH_stego = IWTEmbedder.iwt2(watermarked_image)
        flat_stego    = HH_stego.astype(np.int32).flatten()
        restored_flat = flat_stego.copy()

        # Step 2 — Extract bits and undo modifications (odd indices only)
        # Even pixels are predictor-only and were never modified during embed,
        # so flat_stego[i-1] == flat_orig[i-1] always — no cascade errors.
        extracted_bits = []

        for i in range(1, n_pixels, 2):   # ODD indices only — mirrors embed
            pred = flat_stego[i - 1]      # EVEN predictor — identical to original
            e    = flat_stego[i] - pred

            if location_map[i] == 1:
                # Bit was embedded at this position
                # e==0 → bit=0 was embedded, e==1 → bit=1 was embedded
                extracted_bits.append(1 if e == 1 else 0)
                restored_flat[i] = pred   # restore: original error was 0 → orig = pred
            elif shift_map[i] == 1:
                # Pixel was shifted e=1 → e=2 to make room, undo by subtracting 1
                restored_flat[i] = flat_stego[i] - 1
            # else: pixel untouched — restored_flat[i] stays as flat_stego[i]

        # Decode Huffman
        payload_bytes = HuffmanCodec.decode(extracted_bits[:n_bits_embedded])

        # Step 3 — Reconstruct original HH and Inverse IWT
        orig_HH  = restored_flat.reshape(hh_shape).astype(np.int32)
        restored = IWTEmbedder.iiwt2(LL, LH, HL, orig_HH, original_shape)

        return payload_bytes, restored

    # ------------------------------------------------------------------
    #  get_capacity — estimated safe byte capacity via PEE on HH
    # ------------------------------------------------------------------
    @staticmethod
    def get_capacity(image: np.ndarray) -> int:
        """
        Estimate safe embedding capacity in BYTES using PEE on the HH subband.
        Counts ODD-indexed HH pixels where prediction error == 0 (embeddable).
        Takes 80% as a conservative safe estimate to account for Huffman overhead.
        """
        try:
            _, _, _, HH = IWTEmbedder.iwt2(image)
            flat = HH.astype(np.int32).flatten()
            n    = len(flat)
            # Count odd-indexed pixels where e==0 (the actual embeddable positions)
            zero_errors = sum(
                1 for i in range(1, n, 2)
                if flat[i] - flat[i - 1] == 0
            )
            safe_bits = int(zero_errors * 0.8)
            return max(0, int(safe_bits * 0.9) // 8)
        except Exception:
            # If IWT fails, return zero capacity
            return 0


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