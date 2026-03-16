"""
Image Utilities
===============
Helpers for PIL <-> NumPy <-> Torch tensor conversions and
IWT dimension safety used by the embed / extract pipeline.
"""

import numpy as np
import torch
from PIL import Image
from typing import Tuple

from watermarking.iwt import IWTEmbedder


# Device is set by the caller (app.py) and injected at module load time
# via set_device().  Default to CPU so this module is importable standalone.
_device = torch.device('cpu')


def set_device(device: torch.device) -> None:
    """Called once from app.py after the autoencoder is loaded."""
    global _device
    _device = device


# ---------------------------------------------------------------------------

def image_to_tensor(image: Image.Image) -> torch.Tensor:
    if image.mode != 'L':
        image = image.convert('L')
    if image.size != (512, 512):
        image = image.resize((512, 512), Image.Resampling.LANCZOS)
    img_array = np.array(image).astype(np.float32) / 127.5 - 1.0
    tensor = torch.from_numpy(img_array).unsqueeze(0).unsqueeze(0)
    return tensor.to(_device)


def tensor_to_image(tensor: torch.Tensor) -> Image.Image:
    img_array = tensor.detach().cpu().squeeze().numpy()
    img_array = ((img_array + 1.0) * 127.5).clip(0, 255).astype(np.uint8)
    return Image.fromarray(img_array)


def ensure_even_dims(image: np.ndarray) -> np.ndarray:
    h, w = image.shape
    if h % 2 != 0:
        image = image[:-1, :]
    if w % 2 != 0:
        image = image[:, :-1]
    return image


def safe_iwt_transform(
    image_array: np.ndarray,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, Tuple[int, int]]:
    """Apply IWT with even-dimension safety; return all 4 subbands + shape."""
    h, w = image_array.shape
    if h % 2 != 0:
        image_array = image_array[:-1, :]
    if w % 2 != 0:
        image_array = image_array[:, :-1]
    LL, LH, HL, HH = IWTEmbedder.iwt2(image_array)
    return LL, LH, HL, HH, image_array.shape
