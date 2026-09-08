import os
import hashlib
from datetime import datetime
import logging
from typing import Dict, List, Any

logger = logging.getLogger("memora.scanner")

SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".doc",
    ".pptx", ".txt", ".md", ".csv",
    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".tif", ".gif",
    ".java", ".c", ".py", ".class", ".html", ".htm", ".js", ".ts", ".css", ".scss", ".sass", ".php", ".cpp", ".hpp", ".hxx", ".cs", ".swift", ".kt", ".kts", ".rb", ".go", ".rs", ".sh", ".bash", ".zsh", ".fish", ".ksh", ".ps1", ".bat", ".cmd", ".vbs", ".jsb", ".mjs", ".cjs", ".less", ".jsx", ".tsx",
    ".json", ".xml", ".yml", ".yaml", ".toml", ".cfg", ".conf", ".ini", ".env", ".log", ".sql"
}

def calculate_sha256(file_path: str, block_size: int = 65536) -> str:
    """Calculates SHA-256 hash of file content safely."""
    hasher = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(block_size), b""):
                hasher.update(chunk)
        return hasher.hexdigest()
    except Exception as e:
        logger.error(f"Error calculating hash for '{file_path}': {e}")
        return ""


def scan_directory(folder_path: str) -> List[Dict[str, Any]]:
    """
    Recursively scans folder_path for files matching supported extensions.
    Returns list of dicts with file metadata.
    """
    found_files = []
    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        logger.error(f"Directory path does not exist or is not a directory: '{folder_path}'")
        return found_files

    for root, _, files in os.walk(folder_path):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                full_path = os.path.abspath(os.path.join(root, file))
                try:
                    stat = os.stat(full_path)
                    modified_at = datetime.fromtimestamp(stat.st_mtime)
                    size = stat.st_size
                    file_hash = calculate_sha256(full_path)

                    found_files.append({
                        "path": full_path,
                        "name": file,
                        "extension": ext,
                        "size": size,
                        "modified_at": modified_at,
                        "file_hash": file_hash
                    })
                except PermissionError:
                    logger.warning(f"Permission denied for file '{full_path}'")
                except Exception as e:
                    logger.error(f"Error reading file stat for '{full_path}': {e}")

    return found_files
