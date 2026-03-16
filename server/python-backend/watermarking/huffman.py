"""
Huffman Codec
=============
Self-describing Huffman encoding/decoding used to compress the watermark
payload before it is embedded in the image.

Bitstream layout produced by encode():
  [32-bit total_length] [frequency-table header] [Huffman-coded payload]

The 32-bit length field makes the bitstream self-describing, so extraction
does not need to know the payload size in advance.
"""

import heapq
import struct
from collections import Counter
from typing import List


# ---------------------------------------------------------------------------
#  Internal heap node — __lt__ gives a stable, deterministic tree
# ---------------------------------------------------------------------------

class StableNode:
    def __init__(self, char, freq, uid):
        self.char  = char
        self.freq  = freq
        self.uid   = uid
        self.left  = None
        self.right = None

    def __lt__(self, other):
        if self.freq == other.freq:
            return self.uid < other.uid
        return self.freq < other.freq


# ---------------------------------------------------------------------------
#  HuffmanCodec
# ---------------------------------------------------------------------------

class HuffmanCodec:

    @staticmethod
    def encode(data_bytes: bytes) -> List[int]:
        """Encode *data_bytes* to a self-describing Huffman bit list."""
        if not data_bytes:
            return [0] * 32

        freqs       = Counter(data_bytes)
        uid_counter = 0
        heap        = []
        for char in sorted(freqs.keys()):
            heap.append(StableNode(char, freqs[char], uid_counter))
            uid_counter += 1
        heapq.heapify(heap)

        if len(heap) == 1:
            node        = heapq.heappop(heap)
            root        = StableNode(None, node.freq, uid_counter)
            uid_counter += 1
            root.left   = node
            heap.append(root)

        while len(heap) > 1:
            left   = heapq.heappop(heap)
            right  = heapq.heappop(heap)
            parent = StableNode(None, left.freq + right.freq, uid_counter)
            uid_counter  += 1
            parent.left   = left
            parent.right  = right
            heapq.heappush(heap, parent)

        root  = heap[0]
        codes = {}

        def traverse(node, code):
            if node.char is not None:
                codes[node.char] = code
            else:
                traverse(node.left,  code + "0")
                traverse(node.right, code + "1")

        traverse(root, "")
        encoded_str  = "".join(codes[b] for b in data_bytes)
        payload_bits = [int(x) for x in encoded_str]

        header_bytes = bytearray()
        unique_chars = len(freqs)
        header_bytes.append(unique_chars if unique_chars < 256 else 0)
        for char in sorted(freqs.keys()):
            header_bytes.append(char)
            header_bytes.extend(struct.pack(">I", freqs[char]))

        header_bits = []
        for b in header_bytes:
            for i in range(7, -1, -1):
                header_bits.append((b >> i) & 1)

        total_length = len(header_bits) + len(payload_bits)
        length_bits  = [int(x) for x in format(total_length, '032b')]
        return length_bits + header_bits + payload_bits

    @staticmethod
    def decode(bits: List[int]) -> bytes:
        """Decode a Huffman bit list (with 32-bit length header) back to bytes."""
        if len(bits) < 32:
            return b""

        total_length = 0
        for i in range(32):
            total_length = (total_length << 1) | int(bits[i])

        if total_length == 0 or len(bits) < 32 + total_length:
            return b""

        bits_body = bits[32: 32 + total_length]

        def read_byte(offset):
            val = 0
            for i in range(8):
                val = (val << 1) | bits_body[offset + i]
            return val, offset + 8

        unique_chars, curr = read_byte(0)
        if unique_chars == 0:
            unique_chars = 256

        freqs       = {}
        uid_counter = 0
        for _ in range(unique_chars):
            char, curr = read_byte(curr)
            f          = 0
            for i in range(32):
                f = (f << 1) | bits_body[curr + i]
            curr += 32
            freqs[char] = f

        heap = []
        for char in sorted(freqs.keys()):
            heap.append(StableNode(char, freqs[char], uid_counter))
            uid_counter += 1
        heapq.heapify(heap)

        if len(heap) == 1:
            node        = heapq.heappop(heap)
            root        = StableNode(None, node.freq, uid_counter)
            uid_counter += 1
            root.left   = node
            heap.append(root)

        while len(heap) > 1:
            left   = heapq.heappop(heap)
            right  = heapq.heappop(heap)
            parent = StableNode(None, left.freq + right.freq, uid_counter)
            uid_counter  += 1
            parent.left   = left
            parent.right  = right
            heapq.heappush(heap, parent)

        root        = heap[0]
        total_chars = root.freq
        out_bytes   = bytearray()
        node        = root

        for i in range(curr, len(bits_body)):
            bit  = bits_body[i]
            node = node.right if bit == 1 else node.left
            if node.char is not None:
                out_bytes.append(node.char)
                node = root
                if len(out_bytes) == total_chars:
                    break

        return bytes(out_bytes)
