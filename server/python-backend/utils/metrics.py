"""
Image Quality Metrics
=====================
PSNR and SSIM computation for reversible watermarking evaluation.

Two comparisons served by app.py:
  1. (embed)   Original vs Watermarked  → finite PSNR (48-55 dB), SSIM ≈ 0.999
  2. (extract) Watermarked vs Restored  → PSNR = ∞, SSIM = 1.0  (pixel-perfect)
"""

import numpy as np
from typing import Union, Dict


def compute_psnr(original: np.ndarray, compared: np.ndarray, max_val: int = 255) -> Union[float, str]:
    """
    Compute Peak Signal-to-Noise Ratio.

    Returns "inf" (string) when images are pixel-identical,
    otherwise returns a rounded float (dB).
    """
    a = original.astype(np.float64)
    b = compared.astype(np.float64)

    if a.shape != b.shape:
        raise ValueError(f"Shape mismatch: {a.shape} vs {b.shape}")

    mse = np.mean((a - b) ** 2)
    if mse == 0.0:
        return "inf"

    return round(10.0 * np.log10((max_val ** 2) / mse), 4)


def compute_ssim(original: np.ndarray, compared: np.ndarray) -> float:
    """
    Compute Structural Similarity Index (SSIM).

    Uses the Wang et al. (2004) formula with global statistics.
    Returns exactly 1.0 for identical images.
    """
    a = original.astype(np.float64)
    b = compared.astype(np.float64)

    if a.shape != b.shape:
        raise ValueError(f"Shape mismatch: {a.shape} vs {b.shape}")

    C1 = (0.01 * 255) ** 2   # luminance stability
    C2 = (0.03 * 255) ** 2   # contrast stability

    mu_a     = np.mean(a)
    mu_b     = np.mean(b)
    sig_a2   = np.var(a)
    sig_b2   = np.var(b)
    sig_ab   = np.mean((a - mu_a) * (b - mu_b))

    num   = (2 * mu_a * mu_b + C1) * (2 * sig_ab + C2)
    denom = (mu_a**2 + mu_b**2 + C1) * (sig_a2 + sig_b2 + C2)

    return round(float(num / denom), 6)


def compute_all_metrics(
    original: np.ndarray,
    compared: np.ndarray,
    label: str = "comparison",
) -> Dict:
    """
    Compute PSNR, SSIM, MSE and max pixel deviation between two grayscale images.

    Returns a dict ready to embed in the API JSON response.
    """
    # Crop to common shape (safety — should never differ in practice)
    h = min(original.shape[0], compared.shape[0])
    w = min(original.shape[1], compared.shape[1])
    a = original[:h, :w].astype(np.uint8)
    b = compared[:h, :w].astype(np.uint8)

    psnr     = compute_psnr(a, b)
    ssim     = compute_ssim(a, b)
    mse      = round(float(np.mean((a.astype(np.float64) - b.astype(np.float64)) ** 2)), 6)
    max_diff = int(np.max(np.abs(a.astype(np.int32) - b.astype(np.int32))))
    identical = (mse == 0.0)

    # Human-readable strings
    if identical:
        psnr_display  = "∞ (infinity)"
        ssim_display  = "1.0 (perfect)"
        interpretation = "PERFECT — Images are pixel-identical. Reversibility confirmed."
    else:
        psnr_val = psnr if isinstance(psnr, float) else 0.0
        quality  = "Excellent" if psnr_val >= 50 else "Very Good" if psnr_val >= 45 else "Good" if psnr_val >= 40 else "Moderate"
        psnr_display   = f"{psnr} dB"
        ssim_display   = str(ssim)
        interpretation = (
            f"{quality} quality watermarking. "
            f"Maximum pixel deviation: ±{max_diff} grey level(s). "
            "Watermark is visually imperceptible."
        )

    return {
        "label":          label,
        "psnr":           psnr,           # float or "inf"
        "psnr_display":   psnr_display,
        "ssim":           ssim,
        "ssim_display":   ssim_display,
        "mse":            mse,
        "max_pixel_diff": max_diff,
        "identical":      identical,
        "interpretation": interpretation,
    }