"""
Histogram Shifting  (Reversible Data Hiding)
============================================
Single-round algorithm:
  1. Find PEAK bin P  — most frequent pixel value in [0, 255].
  2. Find ZERO bin Z  — nearest pixel value with frequency 0,
     preferring the right side, then left.
  3. SHIFT all pixels strictly between P and Z toward Z by 1,
     creating an empty slot adjacent to P.
  4. EMBED: for each pixel == P:
       bit=0 → leave at P
       bit=1 → move to P+1 (side=right) or P-1 (side=left)

Extraction + perfect restoration (reverse round order):
  pixel == P   → bit=0, leave at P
  pixel == P±1 → bit=1, restore to P
  Undo the shift: move pixels between P±1 and Z back by 1.

Multi-round: repeat on the current image until all bits embedded.
Metadata stored in MongoDB: [(peak, zero_val, side, n_bits), ...].

Properties:
  ✓ Pixel-perfect reversibility — original values recovered exactly
  ✓ Max distortion = ±1 grey level per affected pixel
  ✓ Works directly on spatial image — no IWT required
  ✓ Capacity ≈ histogram peak height per round (typically 1 000 – 5 000 bits)
"""

import numpy as np
from typing import List, Tuple


# ---------------------------------------------------------------------------
#  Internal helpers
# ---------------------------------------------------------------------------

def _find_peak_and_zero(hist: np.ndarray) -> Tuple[int, int, str]:
    """
    Find the histogram peak and its nearest zero bin.

    Returns
    -------
    peak     : int   most-frequent value
    zero_val : int   nearest value with frequency 0
    side     : str   'right' or 'left'
    """
    peak = int(np.argmax(hist))

    for v in range(peak + 1, 256):
        if hist[v] == 0:
            return peak, v, 'right'
    for v in range(peak - 1, -1, -1):
        if hist[v] == 0:
            return peak, v, 'left'

    raise ValueError(
        "Histogram has no zero bin — cannot apply histogram shifting. "
        "Consider using a different image or reducing the payload size."
    )


def _hs_embed_round(
    flat: np.ndarray,
    bits: List[int],
    peak: int,
    zero_val: int,
    side: str,
) -> np.ndarray:
    """One round of HS embed on a flat int32 pixel array."""
    flat = flat.copy()

    if side == 'right':
        mask = (flat > peak) & (flat < zero_val)
        flat[mask] += 1
        peak_pos = np.where(flat == peak)[0]
        for i, pos in enumerate(peak_pos):
            if i < len(bits) and bits[i] == 1:
                flat[pos] = peak + 1
    else:
        mask = (flat > zero_val) & (flat < peak)
        flat[mask] -= 1
        peak_pos = np.where(flat == peak)[0]
        for i, pos in enumerate(peak_pos):
            if i < len(bits) and bits[i] == 1:
                flat[pos] = peak - 1

    return flat


def _hs_extract_round(
    flat: np.ndarray,
    peak: int,
    zero_val: int,
    side: str,
    n_bits: int,
) -> Tuple[List[int], np.ndarray]:
    """One round of HS extract + restore on a flat int32 pixel array."""
    flat = flat.copy()
    bits = []

    if side == 'right':
        for i in range(len(flat)):
            v = flat[i]
            if v == peak:
                bits.append(0)
            elif v == peak + 1:
                bits.append(1)
                flat[i] = peak
        mask = (flat > peak + 1) & (flat <= zero_val)
        flat[mask] -= 1
    else:
        for i in range(len(flat)):
            v = flat[i]
            if v == peak:
                bits.append(0)
            elif v == peak - 1:
                bits.append(1)
                flat[i] = peak
        mask = (flat >= zero_val) & (flat < peak - 1)
        flat[mask] += 1

    return bits[:n_bits], flat


# ---------------------------------------------------------------------------
#  Public API
# ---------------------------------------------------------------------------

def hs_embed(
    image: np.ndarray,
    payload_bits: List[int],
) -> Tuple[np.ndarray, List[tuple]]:
    """
    Multi-round histogram shifting embed.

    Parameters
    ----------
    image        : 2-D uint8 array  (original grayscale image)
    payload_bits : List[int]        bits to embed

    Returns
    -------
    watermarked : np.ndarray   modified image (uint8, same shape as input)
    rounds      : List[tuple]  [(peak, zero_val, side, n_bits), ...]
                               Save this in MongoDB for later extraction.
    """
    img    = image.copy().astype(np.int32)
    rounds = []
    idx    = 0

    while idx < len(payload_bits):
        hist                 = np.bincount(img.flatten(), minlength=256)
        peak, zero_val, side = _find_peak_and_zero(hist)
        capacity             = int(hist[peak])

        chunk      = payload_bits[idx: idx + capacity]
        n_embedded = len(chunk)

        flat = img.flatten()
        flat = _hs_embed_round(flat, chunk, peak, zero_val, side)
        img  = flat.reshape(img.shape)

        rounds.append((peak, zero_val, side, n_embedded))
        idx += n_embedded

    return np.clip(img, 0, 255).astype(np.uint8), rounds


def hs_extract(
    image: np.ndarray,
    rounds: List[tuple],
) -> Tuple[List[int], np.ndarray]:
    """
    Multi-round histogram shifting extract + perfect image restoration.

    Processes rounds in REVERSE order (LIFO) to correctly undo each
    embedding layer and recover the exact original image.

    Parameters
    ----------
    image  : 2-D uint8 array  (watermarked image)
    rounds : List[tuple]      [(peak, zero_val, side, n_bits), ...]

    Returns
    -------
    all_bits : List[int]    all extracted bits in original order
    restored : np.ndarray   original image — pixel-perfect
    """
    img              = image.copy().astype(np.int32)
    extracted_chunks = []

    for peak, zero_val, side, n_bits in reversed(rounds):
        flat = img.flatten()
        bits, flat = _hs_extract_round(flat, peak, zero_val, side, n_bits)
        img  = flat.reshape(img.shape)
        extracted_chunks.append(bits)

    all_bits = []
    for chunk in reversed(extracted_chunks):
        all_bits.extend(chunk)

    return all_bits, np.clip(img, 0, 255).astype(np.uint8)


def hs_capacity(image: np.ndarray, n_rounds: int = 5) -> int:
    """
    Estimate embedding capacity in BITS for the first *n_rounds* of HS.

    Parameters
    ----------
    image   : 2-D uint8 array
    n_rounds: int  (default 5)

    Returns
    -------
    estimated_bits : int
    """
    hist  = np.bincount(image.flatten(), minlength=256).astype(np.int64)
    total = 0

    for _ in range(n_rounds):
        try:
            peak, zero_val, side = _find_peak_and_zero(hist)
        except ValueError:
            break
        total += int(hist[peak])

        # Simulate histogram update (approximate)
        if side == 'right':
            for v in range(zero_val - 1, peak, -1):
                hist[v + 1] = hist[v]
            hist[peak + 1] = hist[peak]
        else:
            for v in range(zero_val + 1, peak):
                hist[v - 1] = hist[v]
            hist[peak - 1] = hist[peak]
        hist[peak] = hist[peak]  # peak count unchanged

    return total
