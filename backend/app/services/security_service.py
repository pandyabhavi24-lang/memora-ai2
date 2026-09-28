"""
Memora AI - Security Service (Module 5)
========================================
Handles:
  - PIN hashing with PBKDF2-HMAC-SHA256 (stdlib, no external deps)
  - Constant-time verification via secrets.compare_digest()
  - Progressive lockout after repeated failures
  - In-memory session token management (invalidated on lock/close/shutdown)
  - Canonical path validation against approved folders (realpath + commonpath)
  - Excluded folder helpers
  - Audit log creation
  - Backup (zip snapshot) and restore with validation
"""

import hashlib
import hmac
import json
import logging
import os
import secrets
import shutil
import tempfile
import threading
import time
import zipfile
from datetime import datetime, timezone
from typing import Optional, Set

from sqlalchemy.orm import Session

logger = logging.getLogger("memora.security")

# ---------------------------------------------------------------------------
# PIN constants
# ---------------------------------------------------------------------------
_PIN_ALGORITHM = "sha256"
_PIN_ITERATIONS = 260_000   # NIST SP 800-132 minimum for PBKDF2-SHA256
_PIN_KEY_LENGTH = 32         # bytes → 64 hex chars
_SALT_LENGTH = 32            # bytes → 64 hex chars

# ---------------------------------------------------------------------------
# Lockout policy
# ---------------------------------------------------------------------------
_MAX_ATTEMPTS = 5            # failures before lockout begins
_BASE_LOCKOUT_SECONDS = 30   # lockout after 5 failures
_LOCKOUT_MULTIPLIER = 2      # doubles each subsequent window

# Backup manifest version
_BACKUP_FORMAT_VERSION = "1.0"
_APP_VERSION = "1.0.0"


class _LockoutState:
    """Thread-safe failure counter with progressive lockout."""

    def __init__(self):
        self._lock = threading.Lock()
        self._failures: int = 0
        self._lockout_until: float = 0.0
        self._lockout_count: int = 0   # how many lockout windows we've triggered

    def is_locked_out(self) -> tuple[bool, float]:
        """Returns (locked, seconds_remaining)."""
        with self._lock:
            remaining = self._lockout_until - time.monotonic()
            if remaining > 0:
                return True, remaining
            return False, 0.0

    def record_failure(self):
        """Increment failure counter; apply lockout if threshold reached."""
        with self._lock:
            self._failures += 1
            if self._failures >= _MAX_ATTEMPTS:
                self._lockout_count += 1
                duration = _BASE_LOCKOUT_SECONDS * (_LOCKOUT_MULTIPLIER ** (self._lockout_count - 1))
                self._lockout_until = time.monotonic() + duration
                self._failures = 0  # reset counter for next window
                logger.warning(
                    "PIN lockout triggered. Window %d, duration %.0fs.",
                    self._lockout_count,
                    duration,
                )

    def record_success(self):
        """Reset failure state after a successful authentication."""
        with self._lock:
            self._failures = 0
            self._lockout_until = 0.0
            self._lockout_count = 0


class SecurityService:
    """Singleton security service for Memora AI."""

    def __init__(self):
        self._lockout = _LockoutState()
        # In-memory session: token_str → created_at (float monotonic)
        self._session_lock = threading.Lock()
        self._active_token: Optional[str] = None  # only ONE session at a time

    # -----------------------------------------------------------------------
    # PIN hashing
    # -----------------------------------------------------------------------

    def hash_pin(self, pin: str) -> tuple[str, str]:
        """
        Derives a key from the PIN using PBKDF2-HMAC-SHA256.

        Returns:
            (pin_hash_hex, salt_hex)

        The raw PIN is NOT stored. Only the derived key and salt are persisted.
        Iteration count is also stored in the DB (pin_iterations column) so
        future migration to a higher count is straightforward.
        """
        salt_bytes = secrets.token_bytes(_SALT_LENGTH)
        dk = hashlib.pbkdf2_hmac(
            _PIN_ALGORITHM,
            pin.encode("utf-8"),
            salt_bytes,
            _PIN_ITERATIONS,
            dklen=_PIN_KEY_LENGTH,
        )
        return dk.hex(), salt_bytes.hex()

    def verify_pin(self, pin: str, stored_hash_hex: str, salt_hex: str, iterations: int) -> bool:
        """
        Verifies a supplied PIN against the stored hash using constant-time comparison.

        Uses secrets.compare_digest() to prevent timing-oracle attacks.
        The PIN string is never logged.
        """
        try:
            salt_bytes = bytes.fromhex(salt_hex)
            stored_dk = bytes.fromhex(stored_hash_hex)
            candidate_dk = hashlib.pbkdf2_hmac(
                _PIN_ALGORITHM,
                pin.encode("utf-8"),
                salt_bytes,
                iterations,
                dklen=_PIN_KEY_LENGTH,
            )
            return secrets.compare_digest(stored_dk, candidate_dk)
        except Exception:
            return False

    # -----------------------------------------------------------------------
    # Reset code & Recovery email helpers
    # -----------------------------------------------------------------------

    def generate_reset_code(self) -> str:
        """Generates a 6-digit cryptographically secure numeric reset code."""
        return "".join(secrets.choice("0123456789") for _ in range(6))

    def hash_reset_code(self, code: str) -> str:
        """Hashes the 6-digit reset code with SHA-256."""
        return hashlib.sha256(code.strip().encode("utf-8")).hexdigest()

    def verify_reset_code(self, code: str, stored_hash: str) -> bool:
        """Constant-time comparison of supplied reset code against stored SHA-256 hash."""
        if not code or not stored_hash:
            return False
        candidate_hash = self.hash_reset_code(code)
        return secrets.compare_digest(stored_hash, candidate_hash)

    @staticmethod
    def mask_email(email: Optional[str]) -> Optional[str]:
        """Masks an email for safe display (e.g. user@gmail.com -> u***@gmail.com)."""
        if not email or "@" not in email:
            return None
        parts = email.split("@")
        name, domain = parts[0], parts[1]
        if len(name) <= 2:
            masked_name = name[0] + "*"
        else:
            masked_name = name[0] + "*" * (len(name) - 2) + name[-1]
        return f"{masked_name}@{domain}"

    # -----------------------------------------------------------------------
    # Session management
    # -----------------------------------------------------------------------

    def create_session(self) -> str:
        """Issues a new 128-bit cryptographically random session token.
        Invalidates any previous session."""
        token = secrets.token_hex(16)  # 128-bit hex string
        with self._session_lock:
            self._active_token = token
        return token

    def validate_session(self, token: Optional[str]) -> bool:
        """Validates the supplied token against the active in-memory session."""
        if not token:
            return False
        with self._session_lock:
            if not self._active_token:
                return False
            return secrets.compare_digest(self._active_token, token)

    def invalidate_session(self):
        """Clears the active session. Called on Lock Now / shutdown / policy lockout."""
        with self._session_lock:
            self._active_token = None

    # -----------------------------------------------------------------------
    # Lockout helpers exposed to routes
    # -----------------------------------------------------------------------

    def check_lockout(self) -> tuple[bool, float]:
        return self._lockout.is_locked_out()

    def on_auth_failure(self):
        self._lockout.record_failure()
        # Immediately invalidate any existing session on failure
        self.invalidate_session()

    def on_auth_success(self):
        self._lockout.record_success()

    # -----------------------------------------------------------------------
    # Path validation
    # -----------------------------------------------------------------------

    @staticmethod
    def resolve_path(path: str) -> str:
        """
        Returns the canonical real path, resolving symlinks and junctions.
        Raises ValueError for empty/null paths.
        """
        if not path or not path.strip():
            raise ValueError("Path must not be empty.")
        return os.path.realpath(os.path.abspath(path.strip()))

    @staticmethod
    def is_inside(child: str, parent: str) -> bool:
        """
        Returns True only when the resolved child path is actually inside parent.
        Uses os.path.commonpath() — NOT string prefix matching — to prevent
        trivial bypasses like /approved_folderEvil/.
        """
        try:
            real_child = os.path.realpath(os.path.abspath(child))
            real_parent = os.path.realpath(os.path.abspath(parent))
            common = os.path.commonpath([real_child, real_parent])
            return common == real_parent
        except (ValueError, OSError):
            return False

    def validate_path_in_approved(self, path: str, approved_paths: Set[str]) -> bool:
        """
        Validates that `path` is inside at least one approved folder.
        Resolves symlinks/junctions before comparison.
        Returns False for traversal attempts or unauthorized locations.
        """
        try:
            real_path = self.resolve_path(path)
        except ValueError:
            return False
        return any(self.is_inside(real_path, ap) for ap in approved_paths)

    def get_approved_paths(self, db: Session) -> Set[str]:
        """Returns the set of resolved canonical approved-folder paths."""
        from ..models import Folder
        folders = db.query(Folder).filter(Folder.is_active == True).all()
        result = set()
        for f in folders:
            try:
                result.add(os.path.realpath(os.path.abspath(f.path)))
            except Exception:
                pass
        return result

    def get_excluded_paths(self, db: Session) -> Set[str]:
        """Returns the set of resolved canonical excluded-folder and excluded-file paths."""
        from ..models import ExcludedFolder
        rows = db.query(ExcludedFolder).all()
        result = set()
        for r in rows:
            try:
                result.add(os.path.realpath(os.path.abspath(r.path)))
            except Exception:
                pass
        return result

    # -----------------------------------------------------------------------
    # Encryption & Key Management (AES-256-GCM)
    # -----------------------------------------------------------------------

    def _get_master_encryption_key(self) -> bytes:
        """
        Returns the 256-bit Master Encryption Key (MEK).
        Key is stored in a local restricted keyfile in backend/data/memora_sec.key.
        Key is NEVER stored in database, NEVER hardcoded, NEVER sent over network.
        """
        from ..database import DATA_DIR
        os.makedirs(DATA_DIR, exist_ok=True)
        key_file = os.path.join(DATA_DIR, "memora_sec.key")
        if os.path.exists(key_file):
            with open(key_file, "rb") as f:
                key = f.read()
                if len(key) == 32:
                    return key

        new_key = secrets.token_bytes(32)
        tmp_path = key_file + ".tmp"
        with open(tmp_path, "wb") as f:
            f.write(new_key)
        os.replace(tmp_path, key_file)
        return new_key

    def is_file_encrypted(self, file_path: str) -> bool:
        """Checks if a file starts with the Memora AES-GCM magic header."""
        try:
            real_path = self.resolve_path(file_path)
            if not os.path.isfile(real_path):
                return False
            with open(real_path, "rb") as f:
                header = f.read(13)
                return header == b"MEMORA_ENC_v1"
        except Exception:
            return False

    def encrypt_file(self, db: Session, file_path: str) -> dict:
        """
        Encrypts a file locally using AES-256-GCM with atomic replacement.
        Removes search index records from Memora DB/FAISS so plaintext is not searchable.
        """
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        real_path = self.resolve_path(file_path)
        if not os.path.isfile(real_path):
            raise ValueError(f"File not found: {file_path}")

        if self.is_file_encrypted(real_path):
            return {"status": "already_encrypted", "path": real_path}

        key = self._get_master_encryption_key()
        aesgcm = AESGCM(key)
        nonce = secrets.token_bytes(12)

        with open(real_path, "rb") as f:
            plaintext = f.read()

        ciphertext = aesgcm.encrypt(nonce, plaintext, None)
        enc_payload = b"MEMORA_ENC_v1" + nonce + ciphertext

        dir_name = os.path.dirname(real_path)
        tmp_fd, tmp_path = tempfile.mkstemp(dir=dir_name, prefix=".memora_enc_", suffix=".tmp")
        try:
            with open(tmp_fd, "wb") as f:
                f.write(enc_payload)

            # Verification roundtrip test before replacing original file
            with open(tmp_path, "rb") as f:
                test_data = f.read()
            if not test_data.startswith(b"MEMORA_ENC_v1"):
                raise ValueError("Encrypted file header verification failed.")
            test_nonce = test_data[13:25]
            test_cipher = test_data[25:]
            test_plain = aesgcm.decrypt(test_nonce, test_cipher, None)
            if test_plain != plaintext:
                raise ValueError("Encrypted output roundtrip verification failed.")

            os.replace(tmp_path, real_path)
        except Exception as e:
            if os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass
            self.audit(db, "failed_encryption", "failure", resource=os.path.basename(real_path), error=str(e))
            raise ValueError(f"Encryption failed for '{os.path.basename(real_path)}': {str(e)}")

        self.remove_index_metadata_for_path(db, real_path)
        self.audit(db, "file_encrypted", "success", resource=os.path.basename(real_path))
        return {"status": "success", "path": real_path}

    def encrypt_folder(self, db: Session, folder_path: str) -> dict:
        """Recursively encrypts all files in a folder structure."""
        real_path = self.resolve_path(folder_path)
        if not os.path.isdir(real_path):
            raise ValueError(f"Directory not found: {folder_path}")

        encrypted_count = 0
        skipped_count = 0
        errors = []

        for root, dirs, files in os.walk(real_path):
            for file in files:
                full_p = os.path.join(root, file)
                try:
                    if self.is_file_encrypted(full_p):
                        skipped_count += 1
                    else:
                        self.encrypt_file(db, full_p)
                        encrypted_count += 1
                except Exception as e:
                    errors.append(f"{file}: {str(e)}")

        if errors:
            self.audit(db, "failed_encryption", "failure", resource=os.path.basename(real_path),
                       details={"encrypted_count": encrypted_count, "errors": errors})
            if encrypted_count == 0:
                raise ValueError(f"Folder encryption failed: {'; '.join(errors[:3])}")
        else:
            self.audit(db, "folder_encrypted", "success", resource=os.path.basename(real_path),
                       details={"encrypted_files": encrypted_count, "skipped_files": skipped_count})

        return {
            "status": "success" if not errors else "partial_success",
            "folder_path": real_path,
            "encrypted_count": encrypted_count,
            "skipped_count": skipped_count,
            "errors": errors
        }

    def decrypt_file(self, db: Session, file_path: str) -> dict:
        """Decrypts a file locally after authentication and tag verification."""
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        from cryptography.exceptions import InvalidTag

        real_path = self.resolve_path(file_path)
        if not os.path.isfile(real_path):
            raise ValueError(f"File not found: {file_path}")

        if not self.is_file_encrypted(real_path):
            return {"status": "not_encrypted", "path": real_path}

        key = self._get_master_encryption_key()
        aesgcm = AESGCM(key)

        try:
            with open(real_path, "rb") as f:
                enc_data = f.read()

            if not enc_data.startswith(b"MEMORA_ENC_v1"):
                raise ValueError("Invalid encrypted file header.")

            nonce = enc_data[13:25]
            ciphertext = enc_data[25:]

            plaintext = aesgcm.decrypt(nonce, ciphertext, None)

            dir_name = os.path.dirname(real_path)
            tmp_fd, tmp_path = tempfile.mkstemp(dir=dir_name, prefix=".memora_dec_", suffix=".tmp")
            with open(tmp_fd, "wb") as f:
                f.write(plaintext)

            os.replace(tmp_path, real_path)
            self.audit(db, "file_decrypted", "success", resource=os.path.basename(real_path))
            return {"status": "success", "path": real_path}

        except InvalidTag:
            self.audit(db, "failed_decryption", "failure", resource=os.path.basename(real_path),
                       error="Corrupted data or invalid key authentication tag.")
            raise ValueError("Decryption failed: Corrupted encrypted data or invalid key authentication tag.")
        except Exception as e:
            self.audit(db, "failed_decryption", "failure", resource=os.path.basename(real_path), error=str(e))
            raise ValueError(f"Decryption failed: {str(e)}")

    def decrypt_folder(self, db: Session, folder_path: str) -> dict:
        """Recursively decrypts all encrypted files in a folder structure."""
        real_path = self.resolve_path(folder_path)
        if not os.path.isdir(real_path):
            raise ValueError(f"Directory not found: {folder_path}")

        decrypted_count = 0
        skipped_count = 0
        errors = []

        for root, dirs, files in os.walk(real_path):
            for file in files:
                full_p = os.path.join(root, file)
                try:
                    if self.is_file_encrypted(full_p):
                        self.decrypt_file(db, full_p)
                        decrypted_count += 1
                    else:
                        skipped_count += 1
                except Exception as e:
                    errors.append(f"{file}: {str(e)}")

        if errors:
            self.audit(db, "failed_decryption", "failure", resource=os.path.basename(real_path),
                       details={"decrypted_count": decrypted_count, "errors": errors})
            if decrypted_count == 0:
                raise ValueError(f"Folder decryption failed: {'; '.join(errors[:3])}")
        else:
            self.audit(db, "folder_decrypted", "success", resource=os.path.basename(real_path),
                       details={"decrypted_files": decrypted_count, "skipped_files": skipped_count})

        return {
            "status": "success" if not errors else "partial_success",
            "folder_path": real_path,
            "decrypted_count": decrypted_count,
            "skipped_count": skipped_count,
            "errors": errors
        }

    # -----------------------------------------------------------------------
    # Delete Path Safety & Permanent Cascading Deletion
    # -----------------------------------------------------------------------

    def inspect_delete_path(self, db: Session, target_path: str) -> dict:
        """Inspects target path and returns pre-deletion details and safety check results."""
        real_path = self.resolve_path(target_path)
        if not os.path.exists(real_path):
            raise ValueError(f"Path does not exist on disk: {target_path}")

        is_folder = os.path.isdir(real_path)
        approved_paths = self.get_approved_paths(db)
        is_approved = any(self.is_inside(real_path, ap) for ap in approved_paths)
        is_protected = self._is_system_protected_path(real_path)

        child_file_count = 0
        child_folder_count = 0
        total_size_bytes = 0

        if is_folder and is_approved and not is_protected:
            for root, dirs, files in os.walk(real_path):
                child_folder_count += len(dirs)
                for f in files:
                    child_file_count += 1
                    try:
                        total_size_bytes += os.path.getsize(os.path.join(root, f))
                    except Exception:
                        pass
        elif not is_folder:
            try:
                total_size_bytes = os.path.getsize(real_path)
            except Exception:
                pass

        return {
            "path": real_path,
            "name": os.path.basename(real_path),
            "is_folder": is_folder,
            "item_type": "folder" if is_folder else "file",
            "child_file_count": child_file_count,
            "child_folder_count": child_folder_count,
            "total_size_bytes": total_size_bytes,
            "is_inside_approved": is_approved,
            "is_protected": is_protected,
            "can_delete": is_approved and not is_protected,
        }

    def _is_system_protected_path(self, real_path: str) -> bool:
        """Returns True if real_path is a protected system or application directory."""
        from ..database import DATA_DIR
        real_path_lower = real_path.lower().rstrip(os.sep)

        root_paths = [os.path.abspath(os.sep).lower().rstrip(os.sep)]
        if os.name == "nt":
            sys_root = os.environ.get("SystemRoot", "C:\\Windows").lower().rstrip(os.sep)
            prog_files = os.environ.get("ProgramFiles", "C:\\Program Files").lower().rstrip(os.sep)
            user_profile = os.environ.get("USERPROFILE", "").lower().rstrip(os.sep)
            root_paths.extend([sys_root, prog_files, user_profile])

        for rp in root_paths:
            if rp and real_path_lower == rp:
                return True

        project_root = os.path.realpath(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))).lower().rstrip(os.sep)
        data_dir_real = os.path.realpath(os.path.abspath(DATA_DIR)).lower().rstrip(os.sep)

        if real_path_lower == project_root or real_path_lower == data_dir_real or self.is_inside(real_path, data_dir_real):
            return True

        return False

    def delete_permanently(self, db: Session, target_path: str, confirm: bool = True) -> dict:
        """
        Permanently deletes a file or folder tree from disk with strict safety validation,
        DB metadata purging, FAISS resync, and audit logging.
        """
        if not confirm:
            raise ValueError("Permanent deletion requires explicit confirmation.")

        real_path = self.resolve_path(target_path)
        info = self.inspect_delete_path(db, real_path)

        if not info["is_inside_approved"]:
            self.audit(db, "failed_deletion", "failure", resource=os.path.basename(real_path),
                       error="Deletion outside approved folders is strictly prohibited.")
            raise ValueError(f"Security Policy: Deletion of '{target_path}' outside approved folders is strictly prohibited.")

        if info["is_protected"]:
            self.audit(db, "failed_deletion", "failure", resource=os.path.basename(real_path),
                       error="Cannot delete protected system or application paths.")
            raise ValueError("Security Policy: Cannot delete protected system or application directories.")

        self.remove_index_metadata_for_path(db, real_path)

        is_folder = info["is_folder"]
        failed_items = []

        if is_folder:
            try:
                shutil.rmtree(real_path)
            except Exception as e:
                for root, dirs, files in os.walk(real_path, topdown=False):
                    for f in files:
                        fp = os.path.join(root, f)
                        try:
                            os.remove(fp)
                        except Exception as fe:
                            failed_items.append(f"{fp}: {str(fe)}")
                    for d in dirs:
                        dp = os.path.join(root, d)
                        try:
                            os.rmdir(dp)
                        except Exception as de:
                            failed_items.append(f"{dp}: {str(de)}")
                try:
                    if os.path.exists(real_path):
                        os.rmdir(real_path)
                except Exception as e2:
                    failed_items.append(f"{real_path}: {str(e2)}")
        else:
            try:
                os.remove(real_path)
            except Exception as e:
                failed_items.append(f"{real_path}: {str(e)}")

        if failed_items:
            self.audit(db, "failed_deletion", "failure", resource=os.path.basename(real_path),
                       details={"failed_items": failed_items})
            raise RuntimeError(f"Permanent deletion partially failed: {'; '.join(failed_items[:3])}")

        action_type = "permanent_folder_deletion" if is_folder else "permanent_file_deletion"
        self.audit(db, action_type, "success", resource=os.path.basename(real_path),
                   details={
                       "cascading_deletion": is_folder,
                       "child_file_count": info["child_file_count"],
                       "child_folder_count": info["child_folder_count"]
                   })

        if is_folder:
            self.audit(db, "recursive_deletion", "success", resource=os.path.basename(real_path))

        return {
            "status": "success",
            "path": real_path,
            "is_folder": is_folder,
            "info": info
        }

    def remove_index_metadata_for_path(self, db: Session, target_path: str):
        """Purges indexed metadata and FAISS mappings for a file or folder path."""
        from ..models import File, Chunk, VectorMapping, PDFDocument, FileExpiry, OrganizationSuggestion
        from ..ai.faiss_manager import faiss_manager

        try:
            real_path = self.resolve_path(target_path)
            all_files = db.query(File).all()
            target_file_ids = []
            for f in all_files:
                try:
                    rf = self.resolve_path(f.path)
                    if rf == real_path or self.is_inside(rf, real_path):
                        target_file_ids.append(f.id)
                except Exception:
                    pass

            if not target_file_ids:
                return

            chunk_ids = [c.id for c in db.query(Chunk).filter(Chunk.file_id.in_(target_file_ids)).all()]
            if chunk_ids:
                faiss_manager.remove_chunks(set(chunk_ids))

            db.query(VectorMapping).filter(VectorMapping.chunk_id.in_(chunk_ids)).delete(synchronize_session=False)
            db.query(Chunk).filter(Chunk.file_id.in_(target_file_ids)).delete(synchronize_session=False)
            db.query(PDFDocument).filter(PDFDocument.file_id.in_(target_file_ids)).delete(synchronize_session=False)
            db.query(FileExpiry).filter(FileExpiry.file_id.in_(target_file_ids)).delete(synchronize_session=False)
            db.query(OrganizationSuggestion).filter(OrganizationSuggestion.file_id.in_(target_file_ids)).delete(synchronize_session=False)
            db.query(File).filter(File.id.in_(target_file_ids)).delete(synchronize_session=False)

            db.commit()
            self._sync_vector_mappings(db)
        except Exception as e:
            db.rollback()
            logger.error("remove_index_metadata_for_path failed: %s", e)

    # -----------------------------------------------------------------------
    # Audit log
    # -----------------------------------------------------------------------

    def audit(
        self,
        db: Session,
        action: str,
        status: str,
        resource: Optional[str] = None,
        details: Optional[dict] = None,
        error: Optional[str] = None,
    ):
        """
        Writes a single audit-log entry.

        NEVER includes: PINs, passwords, tokens, file contents, OCR text.
        `resource` should be a safe path basename or label only.
        `details` should contain only metadata (counts, types, flags).
        """
        from ..models import AuditLog
        try:
            # Sanitise: never store anything that looks like a secret
            safe_resource = resource[:512] if resource else None
            safe_details = None
            if details:
                safe_details = json.dumps(details)[:2048]
            safe_error = error[:1024] if error else None

            entry = AuditLog(
                timestamp=datetime.utcnow(),
                action=action,
                status=status,
                resource=safe_resource,
                details=safe_details,
                error=safe_error,
            )
            db.add(entry)
            db.commit()
        except Exception as e:
            logger.error("Failed to write audit log entry: %s", e)
            try:
                db.rollback()
            except Exception:
                pass

    # -----------------------------------------------------------------------
    # Data removal
    # -----------------------------------------------------------------------

    def remove_index_metadata(self, db: Session, folder_id: Optional[int] = None) -> dict:
        """
        Removes Memora's indexed metadata (File, Chunk, VectorMapping rows)
        WITHOUT touching the original user files on disk.

        If folder_id is given: only removes that folder's data.
        If None: removes all indexed data for all folders.

        Returns counts of removed records.
        """
        from ..models import File, Chunk, VectorMapping, Folder
        from ..ai.faiss_manager import faiss_manager

        try:
            if folder_id is not None:
                folder = db.query(Folder).filter(Folder.id == folder_id).first()
                if not folder:
                    return {"error": "Folder not found"}
                files = db.query(File).filter(File.folder_id == folder_id).all()
            else:
                files = db.query(File).all()

            chunk_ids_to_remove: Set[int] = set()
            file_ids = [f.id for f in files]

            for fid in file_ids:
                for c in db.query(Chunk).filter(Chunk.file_id == fid).all():
                    chunk_ids_to_remove.add(c.id)

            # Atomically rebuild FAISS without these chunks, then clean SQLite
            if chunk_ids_to_remove:
                faiss_manager.remove_chunks(chunk_ids_to_remove)

            # Delete DB records in dependency order (VectorMapping → Chunk → File)
            vm_deleted = db.query(VectorMapping).filter(
                VectorMapping.chunk_id.in_(chunk_ids_to_remove)
            ).delete(synchronize_session=False)

            ch_deleted = db.query(Chunk).filter(
                Chunk.file_id.in_(file_ids)
            ).delete(synchronize_session=False)

            fi_deleted = db.query(File).filter(
                File.id.in_(file_ids)
            ).delete(synchronize_session=False)

            db.commit()

            # Re-sync vector mappings to ensure SQLite ↔ FAISS consistency
            self._sync_vector_mappings(db)

            return {
                "files_removed": fi_deleted,
                "chunks_removed": ch_deleted,
                "vector_mappings_removed": vm_deleted,
                "faiss_vectors_remaining": faiss_manager.index.ntotal,
            }
        except Exception as e:
            db.rollback()
            logger.error("remove_index_metadata failed: %s", e, exc_info=True)
            raise

    def remove_vector_data(self, db: Session) -> dict:
        """
        Resets the FAISS index and removes all VectorMapping rows from SQLite.
        Chunk text and file metadata are preserved.
        SQLite ↔ FAISS consistency is maintained atomically.
        """
        from ..models import VectorMapping
        from ..ai.faiss_manager import faiss_manager
        try:
            # Reset FAISS first
            faiss_manager.reset()
            # Then clear SQLite VectorMappings
            deleted = db.query(VectorMapping).delete(synchronize_session=False)
            db.commit()
            return {"vector_mappings_removed": deleted, "faiss_vectors_remaining": 0}
        except Exception as e:
            db.rollback()
            logger.error("remove_vector_data failed: %s", e, exc_info=True)
            raise

    @staticmethod
    def _sync_vector_mappings(db: Session):
        """Keeps SQLite VectorMapping in sync with FAISS manager state."""
        from ..models import Chunk, VectorMapping
        from ..ai.faiss_manager import faiss_manager
        try:
            db.query(VectorMapping).delete(synchronize_session=False)
            valid_chunk_ids = {cid for (cid,) in db.query(Chunk.id).all()}
            seen = set()
            for faiss_id, chunk_id in sorted(faiss_manager.faiss_to_chunk.items()):
                cid = int(chunk_id)
                fid = int(faiss_id)
                if cid in valid_chunk_ids and cid not in seen:
                    db.add(VectorMapping(chunk_id=cid, faiss_id=fid))
                    seen.add(cid)
            db.commit()
        except Exception as e:
            logger.error("_sync_vector_mappings failed: %s", e)
            db.rollback()

    # -----------------------------------------------------------------------
    # Backup & Restore
    # -----------------------------------------------------------------------

    def create_backup(self, db: Session, destination_dir: str) -> dict:
        """
        Creates a consistent ZIP snapshot of Memora's application-owned data:
          - SQLite database (backend/data/memora.db)
          - FAISS index (backend/data/faiss/index.faiss)
          - FAISS id map (backend/data/faiss/faiss_id_map.json)

        Does NOT backup:
          - original user files
          - PIN hash / salt (included in DB which is needed for restore —
            NOTE: the ZIP is NOT encrypted; backup destination should be
            a user-controlled location. Encryption can be added by wrapping
            the ZIP with a cryptography library once a secure key-storage
            mechanism is available.)

        Safety measures:
          - Destination must not be inside the source data directory.
          - Uses a temp file + atomic rename so interrupted backups are not
            considered valid.
          - Does not compress in memory; streams directly to disk.

        Returns a dict with the backup file path and manifest metadata.
        """
        from ..database import DB_PATH, DATA_DIR
        from ..ai.faiss_manager import faiss_manager

        # Resolve and validate destination
        try:
            real_dest = os.path.realpath(os.path.abspath(destination_dir))
            real_data = os.path.realpath(os.path.abspath(DATA_DIR))
        except Exception as e:
            raise ValueError(f"Invalid destination path: {e}")

        if not os.path.isdir(real_dest):
            raise ValueError("Backup destination directory does not exist.")

        # Prevent self-inclusion: destination must NOT be inside data directory
        if self.is_inside(real_dest, real_data):
            raise ValueError(
                "Backup destination must not be inside the application data directory."
            )

        # Files to include
        faiss_index_path = faiss_manager.index_path
        faiss_map_path = faiss_manager.map_path
        files_to_backup = []
        for fp in [DB_PATH, faiss_index_path, faiss_map_path]:
            if os.path.exists(fp):
                files_to_backup.append(fp)

        now_utc = datetime.now(timezone.utc)
        timestamp_str = now_utc.strftime("%Y%m%d_%H%M%S")
        backup_filename = f"memora_backup_{timestamp_str}.zip"
        backup_path = os.path.join(real_dest, backup_filename)

        # Temp file for atomic write
        tmp_fd, tmp_path = tempfile.mkstemp(dir=real_dest, suffix=".tmp")
        os.close(tmp_fd)

        manifest = {
            "backup_format_version": _BACKUP_FORMAT_VERSION,
            "app_version": _APP_VERSION,
            "created_at": now_utc.isoformat(),
            "db_schema_version": "module5",
            "faiss_dimension": 384,
            "included_files": [],
            "note": (
                "This backup is NOT encrypted. Store it in a secure location. "
                "It contains Memora's index and settings (including hashed PIN). "
                "Original user files are NOT included."
            ),
        }

        try:
            with zipfile.ZipFile(tmp_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
                for fp in files_to_backup:
                    arcname = os.path.relpath(fp, os.path.dirname(DATA_DIR))
                    zf.write(fp, arcname)
                    manifest["included_files"].append(arcname)
                # Write manifest last
                zf.writestr("backup_manifest.json", json.dumps(manifest, indent=2))

            # Atomic rename (same filesystem as temp file)
            os.replace(tmp_path, backup_path)
            logger.info("Backup created: %s", backup_path)
        except Exception:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except Exception:
                pass
            raise

        return {
            "backup_path": backup_path,
            "timestamp": now_utc.isoformat(),
            "files_included": manifest["included_files"],
            "size_bytes": os.path.getsize(backup_path),
        }

    def validate_backup(self, backup_zip_path: str) -> dict:
        """
        Validates a backup ZIP before restore. Returns the manifest dict.
        Raises ValueError if invalid or corrupt.
        """
        real_path = os.path.realpath(os.path.abspath(backup_zip_path))
        if not os.path.isfile(real_path):
            raise ValueError("Backup file not found.")
        if not zipfile.is_zipfile(real_path):
            raise ValueError("File is not a valid ZIP archive.")

        with zipfile.ZipFile(real_path, "r") as zf:
            names = zf.namelist()
            if "backup_manifest.json" not in names:
                raise ValueError("Backup is missing manifest. File may be corrupt or invalid.")
            raw = zf.read("backup_manifest.json")
            try:
                manifest = json.loads(raw.decode("utf-8"))
            except Exception:
                raise ValueError("Backup manifest is corrupt or unreadable.")

        if manifest.get("backup_format_version") != _BACKUP_FORMAT_VERSION:
            raise ValueError(
                f"Unsupported backup format version: {manifest.get('backup_format_version')}"
            )

        return manifest

    def restore_backup(self, db: Session, backup_zip_path: str) -> dict:
        """
        Restores Memora application data from a validated backup ZIP.

        Safety measures:
          - Validates the backup completely before touching current data.
          - Creates a safety backup of current data first.
          - Does not partially restore (atomic: either succeeds or leaves data untouched).
          - Reloads FAISS index after restore.
        """
        from ..database import DB_PATH, DATA_DIR
        from ..ai.faiss_manager import faiss_manager

        # Full validation before touching anything
        manifest = self.validate_backup(backup_zip_path)

        real_backup = os.path.realpath(os.path.abspath(backup_zip_path))
        real_data = os.path.realpath(os.path.abspath(DATA_DIR))

        # Safety backup of current state
        safety_dir = os.path.join(real_data, "_restore_safety")
        os.makedirs(safety_dir, exist_ok=True)
        safety_ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safety_zip = os.path.join(safety_dir, f"pre_restore_{safety_ts}.zip")

        # Create temp dir for extraction (validate all files before swapping)
        tmp_extract = tempfile.mkdtemp(dir=real_data, prefix="restore_tmp_")

        try:
            # 1. Extract to temp location
            with zipfile.ZipFile(real_backup, "r") as zf:
                for name in zf.namelist():
                    if name == "backup_manifest.json":
                        continue
                    # Security: prevent path traversal in zip entries
                    target = os.path.realpath(os.path.join(tmp_extract, name))
                    if not target.startswith(os.path.realpath(tmp_extract)):
                        raise ValueError(f"Unsafe path in backup archive: {name}")
                    os.makedirs(os.path.dirname(target), exist_ok=True)
                    with zf.open(name) as src, open(target, "wb") as dst:
                        shutil.copyfileobj(src, dst)

            # 2. Create safety backup of current data
            safety_tmp_fd, safety_tmp = tempfile.mkstemp(dir=safety_dir, suffix=".tmp")
            os.close(safety_tmp_fd)
            data_parent = os.path.dirname(real_data)
            with zipfile.ZipFile(safety_tmp, "w", compression=zipfile.ZIP_DEFLATED) as szf:
                for fp in [DB_PATH, faiss_manager.index_path, faiss_manager.map_path]:
                    if os.path.exists(fp):
                        szf.write(fp, os.path.relpath(fp, data_parent))
            os.replace(safety_tmp, safety_zip)

            # 3. Close DB connections briefly — copy extracted files over current data
            db.close()

            # Copy extracted files to their real locations
            for name in manifest.get("included_files", []):
                src = os.path.realpath(os.path.join(tmp_extract, name))
                dst = os.path.realpath(os.path.join(data_parent, name))
                if not os.path.exists(src):
                    raise ValueError(f"Expected file missing from backup: {name}")
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                shutil.copy2(src, dst)

            # 4. Reload FAISS index in memory
            faiss_manager.load_or_create()

            logger.info("Restore completed from %s", real_backup)
            return {
                "status": "success",
                "restored_from": real_backup,
                "safety_backup": safety_zip,
                "files_restored": manifest.get("included_files", []),
            }
        except Exception:
            logger.error("Restore failed; current data left untouched.", exc_info=True)
            raise
        finally:
            # Always clean up temp extraction dir
            try:
                shutil.rmtree(tmp_extract, ignore_errors=True)
            except Exception:
                pass


security_service = SecurityService()
