import os
import hashlib
from datetime import datetime
import logging
from typing import Dict, List, Any

logger = logging.getLogger("memora.scanner")

SUPPORTED_EXTENSIONS = {
    ".pdf", ".docx", ".doc",
    ".pptx", ".txt", ".md", ".csv", ".jpg", ".jpeg", ".png", ".webp",
    ".java", ".c", ".py",".class",".html",".htm",".js",".ts",".css",".scss",".sass",".php",".cpp",".hpp",".hxx",".cs",".swift",".kt",".kts",".rb",".go",".rs",".sh",".bash",".zsh",".fish",".ksh",".ps1",".bat",".cmd",".vbs",".jsb",".mjs",".cjs",".css",".scss",".sass",".less",".html",".htm",".js",".ts",".jsx",".tsx",
    ".json",".xml",".yml",".yaml",".toml",".cfg",".conf",".ini",".env",".log",".sql",".py",".java",".c",".cpp",".hpp",".hxx",".cs",".swift",".kt",".kts",".rb",".go",".rs",".sh",".bash",".zsh",
    ".fish",".ksh",".ps1",".bat",".cmd",".vbs",".jsb",".mjs",".cjs"
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


def scan_directory(folder_path: str, excluded_paths: set = None) -> List[Dict[str, Any]]:
    """
    Recursively scans folder_path for files matching supported extensions.
    Skips any subdirectory (or root) whose resolved path is inside an excluded folder.

    Args:
        folder_path: The root directory to scan.
        excluded_paths: Optional set of canonical (realpath) paths to skip.

    Returns list of dicts with file metadata.
    """
    found_files = []
    if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
        logger.error(f"Directory path does not exist or is not a directory: '{folder_path}'")
        return found_files

    excluded_real = set()
    if excluded_paths:
        for ep in excluded_paths:
            try:
                excluded_real.add(os.path.realpath(os.path.abspath(ep)))
            except Exception:
                pass

    def _is_excluded(path: str) -> bool:
        """Returns True if resolved path is inside any excluded folder."""
        if not excluded_real:
            return False
        try:
            real = os.path.realpath(os.path.abspath(path))
            for exc in excluded_real:
                try:
                    if os.path.commonpath([real, exc]) == exc:
                        return True
                except ValueError:
                    pass
        except Exception:
            pass
        return False

    for root, dirs, files in os.walk(folder_path):
        # Skip excluded directories (in-place mutation stops os.walk from descending)
        if _is_excluded(root):
            logger.info(f"Skipping excluded directory: '{root}'")
            dirs.clear()
            continue

        # Prune sub-dirs that are excluded before descending
        dirs[:] = [d for d in dirs if not _is_excluded(os.path.join(root, d))]

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

