import numpy as np
import random
from typing import List, Tuple
import hashlib

class PRNGScrambler:
    """Pseudo-random number generator for scrambling data"""
    
    def __init__(self, key: str = None):
        """Initialize with optional key"""
        if key:
            self.set_key(key)
        else:
            self.key = "default_scrambler_key_2024"
            self._init_prng()
    
    def set_key(self, key: str):
        """Set scrambling key"""
        self.key = key
        self._init_prng()
    
    def _init_prng(self):
        """Initialize PRNG with key"""
        # Use key to seed the PRNG
        seed_value = int(hashlib.sha256(self.key.encode()).hexdigest(), 16) % (2**32)
        self.random = random.Random(seed_value)
        self.np_random = np.random.RandomState(seed_value)
    
    def scramble_bits(self, bits: List[int]) -> List[int]:
        """
        Scramble bits using PRNG
        Returns scrambled bits and the permutation indices
        """
        n = len(bits)
        indices = list(range(n))
        self.random.shuffle(indices)
        
        scrambled = [bits[i] for i in indices]
        return scrambled, indices
    
    def descramble_bits(self, scrambled_bits: List[int], indices: List[int]) -> List[int]:
        """Descramble bits using the same permutation"""
        descrambled = [0] * len(scrambled_bits)
        for i, idx in enumerate(indices):
            descrambled[idx] = scrambled_bits[i]
        return descrambled
    
    def generate_scramble_map(self, length: int) -> List[int]:
        """Generate scramble mapping for given length"""
        indices = list(range(length))
        self.random.shuffle(indices)
        return indices
    
    def get_key_hash(self) -> str:
        """Get hash of current key for transmission"""
        return hashlib.sha256(self.key.encode()).hexdigest()


class ScramblerWithAuth:
    """Scrambler with authentication support"""
    
    def __init__(self, master_key: str):
        self.master_key = master_key
        self.scrambler = PRNGScrambler(master_key)
    
    def scramble_with_auth(self, data_bits: List[int], auth_tag: str) -> Tuple[List[int], List[int], str]:
        """
        Scramble data with authentication
        Returns scrambled bits, indices, and session key
        """
        # Generate session-specific key
        session_input = f"{self.master_key}{auth_tag}{len(data_bits)}"
        session_key = hashlib.sha256(session_input.encode()).hexdigest()[:16]
        
        # Use session key for scrambling
        self.scrambler.set_key(session_key)
        scrambled, indices = self.scrambler.scramble_bits(data_bits)
        
        return scrambled, indices, session_key
    
    def descramble_with_auth(self, scrambled_bits: List[int], indices: List[int], session_key: str) -> List[int]:
        """Descramble using session key"""
        self.scrambler.set_key(session_key)
        return self.scrambler.descramble_bits(scrambled_bits, indices)