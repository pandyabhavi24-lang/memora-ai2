import re
import logging

logger = logging.getLogger("memora.chunker")

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[dict]:
    """
    Splits input text into overlapping chunks of word count = `chunk_size` with `overlap` words.
    Returns list of dicts: [{'chunk_index': int, 'text': str, 'word_count': int}]
    """
    if not text or not text.strip():
        return []

    # Clean whitespace
    clean_text = re.sub(r'\s+', ' ', text).strip()
    words = clean_text.split()

    if len(words) == 0:
        return []

    if len(words) <= chunk_size:
        return [{
            "chunk_index": 0,
            "text": clean_text,
            "word_count": len(words)
        }]

    chunks = []
    step = chunk_size - overlap
    if step <= 0:
        step = chunk_size // 2 or 1

    chunk_idx = 0
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk_words = words[start:end]
        chunk_str = " ".join(chunk_words)

        chunks.append({
            "chunk_index": chunk_idx,
            "text": chunk_str,
            "word_count": len(chunk_words)
        })

        chunk_idx += 1
        start += step

        if end == len(words):
            break

    return chunks
