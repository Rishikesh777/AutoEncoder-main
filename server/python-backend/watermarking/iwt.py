import numpy as np
from typing import List, Tuple, Optional


class IWTEmbedder:
    """
    Integer Wavelet Transform (IWT) using CDF 5/3 wavelet.
    Perfect reconstruction guaranteed.

    Embedding target: HH subband (high-frequency diagonal detail).
    HH contains the least perceptually significant information,
    making modifications less visible than in LL (approximation).
    """

    @staticmethod
    def iwt2(image: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Forward Integer Wavelet Transform (2D).
        Using CDF 5/3 wavelet (lossless integer transform).

        Args:
            image: Input image as uint8 array

        Returns:
            LL, LH, HL, HH subbands as int32
        """
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
        even_rows = img[0::2, :].copy()
        odd_rows  = img[1::2, :].copy()

        # Prediction step (predict odd from even)
        for i in range(odd_rows.shape[0]):
            if i < even_rows.shape[0] - 1:
                predicted = (even_rows[i, :] + even_rows[i + 1, :]) // 2
            else:
                predicted = even_rows[i, :]
            odd_rows[i, :] = odd_rows[i, :] - predicted

        # Update step (update even using odd)
        for i in range(1, even_rows.shape[0] - 1):
            even_rows[i, :] = even_rows[i, :] + (odd_rows[i - 1, :] + odd_rows[i, :] + 2) // 4

        # Reconstruct temporary image
        temp = np.zeros_like(img)
        temp[0::2, :] = even_rows
        temp[1::2, :] = odd_rows[:temp[1::2].shape[0], :]

        # Vertical transform (along columns)
        even_cols = temp[:, 0::2].copy()
        odd_cols  = temp[:, 1::2].copy()

        # Prediction step for columns
        for j in range(odd_cols.shape[1]):
            if j < even_cols.shape[1] - 1:
                predicted = (even_cols[:, j] + even_cols[:, j + 1]) // 2
            else:
                predicted = even_cols[:, j]
            odd_cols[:, j] = odd_cols[:, j] - predicted

        # Update step for columns
        for j in range(1, even_cols.shape[1] - 1):
            even_cols[:, j] = even_cols[:, j] + (odd_cols[:, j - 1] + odd_cols[:, j] + 2) // 4

        # Assemble subbands
        # LL: low-low  (even rows,  even cols) — approximation
        # LH: low-high (even rows,  odd  cols) — horizontal edges
        # HL: high-low (odd  rows,  even cols) — vertical edges
        # HH: high-high(odd  rows,  odd  cols) — diagonal details  ← embedding target
        LL = even_cols[0::2, :].copy()
        LH = odd_cols[0::2, :].copy()
        HL = even_cols[1::2, :].copy()
        HH = odd_cols[1::2, :].copy()

        return LL, LH, HL, HH

    @staticmethod
    def iiwt2(
        LL: np.ndarray,
        LH: np.ndarray,
        HL: np.ndarray,
        HH: np.ndarray,
        original_shape: Tuple[int, int],
    ) -> np.ndarray:
        """
        Inverse Integer Wavelet Transform.
        Perfect reconstruction from subbands.
        """
        h, w = original_shape
        h_half, w_half = h // 2, w // 2

        # Reconstruct even and odd columns by interleaving rows
        even_cols = np.zeros((h, w_half), dtype=np.int32)
        odd_cols  = np.zeros((h, w_half), dtype=np.int32)

        even_cols[0::2, :] = LL[:even_cols[0::2].shape[0], :even_cols.shape[1]]
        even_cols[1::2, :] = HL[:even_cols[1::2].shape[0], :even_cols.shape[1]]

        odd_cols[0::2, :] = LH[:odd_cols[0::2].shape[0], :odd_cols.shape[1]]
        odd_cols[1::2, :] = HH[:odd_cols[1::2].shape[0], :odd_cols.shape[1]]

        # Inverse update for columns
        for j in range(1, even_cols.shape[1] - 1):
            even_cols[:, j] = even_cols[:, j] - (odd_cols[:, j - 1] + odd_cols[:, j] + 2) // 4

        # Inverse prediction for columns
        for j in range(odd_cols.shape[1]):
            if j < even_cols.shape[1] - 1:
                predicted = (even_cols[:, j] + even_cols[:, j + 1]) // 2
            else:
                predicted = even_cols[:, j]
            odd_cols[:, j] = odd_cols[:, j] + predicted

        # Combine columns to get temp
        temp = np.zeros((h, w), dtype=np.int32)
        temp[:, 0::2] = even_cols
        temp[:, 1::2] = odd_cols[:, :temp[:, 1::2].shape[1]]

        # Inverse vertical transform (along rows)
        even_rows = temp[0::2, :].copy()
        odd_rows  = temp[1::2, :].copy()

        # Inverse update for rows
        for i in range(1, even_rows.shape[0] - 1):
            even_rows[i, :] = even_rows[i, :] - (odd_rows[i - 1, :] + odd_rows[i, :] + 2) // 4

        # Inverse prediction for rows
        for i in range(odd_rows.shape[0]):
            if i < even_rows.shape[0] - 1:
                predicted = (even_rows[i, :] + even_rows[i + 1, :]) // 2
            else:
                predicted = even_rows[i, :]
            odd_rows[i, :] = odd_rows[i, :] + predicted

        # Reconstruct final image
        result = np.zeros_like(temp)
        result[0::2, :] = even_rows
        result[1::2, :] = odd_rows[:result[1::2].shape[0], :]

        return np.clip(result, 0, 255).astype(np.uint8)

    # ------------------------------------------------------------------
    # HH-subband embedding  (replaces the old LL-based methods)
    # ------------------------------------------------------------------

    @staticmethod
    def embed_in_hh(hh_band: np.ndarray, data_bits: List[int]) -> np.ndarray:
        """
        Embed data bits into HH subband coefficients via LSB modification.

        HH holds the high-frequency diagonal detail of the image.
        These coefficients are small in magnitude and perceptually
        invisible to the human eye, making them the least-obtrusive
        embedding target while still being fully reversible via IIWT.

        Args:
            hh_band:   HH subband as returned by iwt2() — int32 array
            data_bits: List of 0/1 integers to embed

        Returns:
            Modified HH subband with bits embedded in LSB of each coefficient.

        Raises:
            ValueError: if data_bits length exceeds HH subband capacity.
        """
        if len(data_bits) > hh_band.size:
            raise ValueError(
                f"Data too large for HH subband: need {len(data_bits)} bits, "
                f"capacity is {hh_band.size} bits."
            )

        watermarked_hh = hh_band.copy()
        hh_flat = watermarked_hh.flatten()

        for i, bit in enumerate(data_bits):
            if bit == 1:
                # Make coefficient odd (set LSB to 1)
                if hh_flat[i] % 2 == 0:
                    hh_flat[i] += 1
            else:
                # Make coefficient even (set LSB to 0)
                if hh_flat[i] % 2 != 0:
                    hh_flat[i] -= 1

        return hh_flat.reshape(watermarked_hh.shape)

    @staticmethod
    def extract_from_hh(hh_band: np.ndarray, num_bits: int) -> List[int]:
        """
        Extract data bits from HH subband coefficients.

        Reads the LSB of each coefficient — the mirror operation of
        embed_in_hh().

        Args:
            hh_band:  HH subband (possibly watermarked) — int32 array
            num_bits: Number of bits to extract

        Returns:
            List of 0/1 integers representing extracted bits.
        """
        hh_flat = hh_band.flatten()
        num_bits = min(num_bits, len(hh_flat))

        # LSB parity: odd coefficient → bit 1, even coefficient → bit 0
        return [int(hh_flat[i] % 2) for i in range(num_bits)]

    @staticmethod
    def get_capacity(image: np.ndarray) -> int:
        """
        Calculate embedding capacity of the HH subband in bits.

        Both HH and LL share the same size: 1/4 of the (even-cropped) image.
        One bit is stored per coefficient (LSB modification).

        Args:
            image: The carrier image (before IWT) as a 2-D numpy array.

        Returns:
            Number of bits that can be embedded in the HH subband.
        """
        h, w = image.shape
        h_even = h - (h % 2)
        w_even = w - (w % 2)
        hh_size = (h_even // 2) * (w_even // 2)
        return hh_size

    # ------------------------------------------------------------------
    # Legacy LL methods kept for reference / backwards compatibility.
    # New code should use embed_in_hh / extract_from_hh.
    # ------------------------------------------------------------------

    @staticmethod
    def embed_in_ll(ll_band: np.ndarray, data_bits: List[int]) -> np.ndarray:
        """
        [DEPRECATED] Embed in LL subband.
        Use embed_in_hh() instead for less-visible watermarking.
        """
        watermarked_ll = ll_band.copy()
        ll_flat = watermarked_ll.flatten()

        if len(data_bits) > len(ll_flat):
            raise ValueError(
                f"Data too large: {len(data_bits)} bits, capacity: {len(ll_flat)} bits"
            )

        for i, bit in enumerate(data_bits):
            if bit == 1:
                if ll_flat[i] % 2 == 0:
                    ll_flat[i] += 1
            else:
                if ll_flat[i] % 2 != 0:
                    ll_flat[i] -= 1

        return ll_flat.reshape(watermarked_ll.shape)

    @staticmethod
    def extract_from_ll(ll_band: np.ndarray, num_bits: int) -> List[int]:
        """
        [DEPRECATED] Extract from LL subband.
        Use extract_from_hh() instead.
        """
        ll_flat = ll_band.flatten()
        return [int(ll_flat[i] % 2) for i in range(min(num_bits, len(ll_flat)))]


class AdaptiveIWTEmbedder:
    """
    Enhanced IWT embedder with adaptive strength based on coefficient magnitude.
    Operates on the HH subband.
    """

    @staticmethod
    def embed_adaptive(hh_band: np.ndarray, data_bits: List[int]) -> np.ndarray:
        """
        Adaptive embedding in HH subband.
        Uses stronger modifications for larger-magnitude HH coefficients,
        improving robustness while keeping changes imperceptible.
        """
        watermarked_hh = hh_band.copy()
        hh_flat = watermarked_hh.flatten()

        for i, bit in enumerate(data_bits):
            if i >= len(hh_flat):
                break

            coeff = hh_flat[i]
            magnitude = abs(coeff)

            if magnitude > 100:
                # 2-bit embedding for large-magnitude coefficients
                if bit == 1:
                    target = (coeff // 4) * 4 + 2
                else:
                    target = (coeff // 4) * 4
            elif magnitude > 50:
                # 1-bit embedding for medium coefficients
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

            hh_flat[i] = target

        return hh_flat.reshape(watermarked_hh.shape)

    @staticmethod
    def extract_adaptive(hh_band: np.ndarray, num_bits: int) -> List[int]:
        """
        Extract bits from HH subband using adaptive strength detection.
        Mirror of embed_adaptive().
        """
        hh_flat = hh_band.flatten()
        extracted_bits = []

        for i in range(min(num_bits, len(hh_flat))):
            coeff = hh_flat[i]
            magnitude = abs(coeff)

            if magnitude > 100:
                bit = 1 if (coeff % 4) >= 2 else 0
            elif magnitude > 50:
                bit = 1 if (coeff % 2) == 1 else 0
            else:
                bit = int(coeff % 2)

            extracted_bits.append(bit)

        return extracted_bits