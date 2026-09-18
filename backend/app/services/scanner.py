import os
import hashlib
import tempfile
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

TEMP_PATH_PATTERNS = [
    "memora_pdf_test_",
    "split_pages",
    "split_every_out",
    "split_sel_out",
    "split_range_out",
    "split_out",
    ".tmp",
    "__pycache__",
    ".git",
    "node_modules",
    "memoramain",
    "memoraai3",
    ".venv",
    "test_pdf_studio",
]

def is_temp_or_test_path(path: str) -> bool:
    """
    Returns True if path belongs to a system temp folder, PDF Studio test directory,
    or intermediate processing output directory.
    """
    if not path:
        return True

    try:
        norm = os.path.normcase(os.path.abspath(path))
        temp_dir = os.path.normcase(os.path.abspath(tempfile.gettempdir()))

        if os.path.commonpath([norm, temp_dir]) == temp_dir:
            return True
    except Exception:
        pass

    norm_lower = path.replace("\\", "/").lower()
    # Allow explicit test sample directories used by test suites
    for allowed in ["sample_documents", "test_media_samples", "test_ocr_samples"]:
        if allowed in norm_lower:
            return False

    for pattern in TEMP_PATH_PATTERNS:
        if pattern != "memoramain" and pattern != "memoraai3":
            if pattern.lower() in norm_lower:
                return True

    return False


def is_subpath(child_path: str, parent_path: str) -> bool:
    r"""
    Windows-safe path containment check.
    Returns True if child_path is strictly inside or equal to parent_path,
    handling drive-letter casing differences (e.g. c:\ vs C:\) safely.
    """
    try:
        norm_child = os.path.normcase(os.path.abspath(str(child_path)))
        norm_parent = os.path.normcase(os.path.abspath(str(parent_path)))
        return os.path.commonpath([norm_child, norm_parent]) == norm_parent
    except Exception:
        return False


def is_valid_user_file(file_obj: Any) -> bool:
    """
    Validates if a file record represents a legitimate physical user document.
    Rejects temporary/test paths, stale files missing on disk, and files unaligned with their watched folder.
    """
    if not file_obj or not getattr(file_obj, "path", None):
        return False
    fpath = file_obj.path
    if is_temp_or_test_path(fpath):
        return False
    if not os.path.exists(fpath):
        return False
    folder = getattr(file_obj, "folder", None)
    if folder and getattr(folder, "path", None):
        if not is_subpath(fpath, folder.path):
            return False
    return True


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
    Skips temporary, test, and system cache folders.
    Returns list of dicts with file metadata.
    """
    found_files = []
    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        logger.error(f"Directory path does not exist or is not a directory: '{folder_path}'")
        return found_files

    for root, dirs, files in os.walk(folder_path):
        # Prune temporary and system directories during walk
        dirs[:] = [d for d in dirs if not is_temp_or_test_path(os.path.join(root, d))]

        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in SUPPORTED_EXTENSIONS:
                full_path = os.path.abspath(os.path.join(root, file))

                if is_temp_or_test_path(full_path):
                    continue

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

