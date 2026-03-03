import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

print("Testing imports...")
try:
    from autoencoder.model import get_autoencoder, WatermarkEmbeddingModule
    print("✓ autoencoder.model imported")
except ImportError as e:
    print(f"✗ autoencoder.model failed: {e}")

try:
    from crypto.hashing import Blake3Hasher, AuthenticationTagGenerator
    print("✓ crypto.hashing imported")
except ImportError as e:
    print(f"✗ crypto.hashing failed: {e}")

try:
    from watermarking.compression import DataCompressor, LSBEmbedder
    print("✓ watermarking.compression imported")
except ImportError as e:
    print(f"✗ watermarking.compression failed: {e}")

try:
    from watermarking.scrambler import PRNGScrambler, ScramblerWithAuth
    print("✓ watermarking.scrambler imported")
except ImportError as e:
    print(f"✗ watermarking.scrambler failed: {e}")

print("Import test finished.")
