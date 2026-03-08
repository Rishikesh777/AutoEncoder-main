import blake3
import numpy as np
from typing import Union


class Blake3Hasher:
    """Blake3 hashing - consistent with app.py usage"""

    @staticmethod
    def hash_data(data: Union[str, bytes, np.ndarray]) -> str:
        """Generate Blake3 hash of input data"""
        if isinstance(data, np.ndarray):
            data = data.tobytes()
        elif isinstance(data, str):
            data = data.encode('utf-8')

        return blake3.blake3(data).hexdigest()

    @staticmethod
    def verify_hash(data: Union[str, bytes, np.ndarray], hash_value: str) -> bool:
        """Verify data against hash"""
        computed = Blake3Hasher.hash_data(data)
        return computed == hash_value


class AuthenticationTagGenerator:
    """Generate authentication tags for medical data"""

    @staticmethod
    def generate_tag(patient_data: str, autoencoder_tag: str, key: bytes = None) -> dict:
        """
        Generate authentication tag: Blake3(PatientData + A + Blake3(A))
        Where A is the autoencoder-generated 128-bit tag
        """
        # Hash the autoencoder tag with Blake3
        a_hash = Blake3Hasher.hash_data(autoencoder_tag)

        # Combine patient data, autoencoder tag, and its hash
        combined = f"{patient_data}{autoencoder_tag}{a_hash}".encode('utf-8')

        # Final authentication tag using Blake3
        auth_tag = Blake3Hasher.hash_data(combined)

        return {
            'auth_tag': auth_tag,
            'a_hash': a_hash,
            'autoencoder_tag': autoencoder_tag
        }

    @staticmethod
    def verify_tag(patient_data: str, autoencoder_tag: str, auth_tag: str) -> bool:
        """Verify authentication tag"""
        a_hash = Blake3Hasher.hash_data(autoencoder_tag)
        combined = f"{patient_data}{autoencoder_tag}{a_hash}".encode('utf-8')
        computed = Blake3Hasher.hash_data(combined)
        return computed == auth_tag