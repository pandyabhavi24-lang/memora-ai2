"""
Memora AI - Module 5 Security Tests
=====================================
Tests PIN hashing, session management, path validation, excluded folders,
audit logging, data removal (FAISS/SQLite consistency), backup/restore,
and protected API endpoint enforcement.

Run from project root:
    .venv\\Scripts\\python.exe backend\\test_module5.py
"""

import hashlib
import json
import os
import secrets
import shutil
import sys
import tempfile
import time
import zipfile

# Ensure project root is on path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.app.database import Base, DB_PATH, DATA_DIR, SessionLocal, engine, init_db_schema
from backend.app.models import (
    AuditLog, Chunk, ExcludedFolder, File, Folder, SecuritySettings,
    VectorMapping,
)
from backend.app.services.security_service import SecurityService, security_service

PASS = "\033[32m[PASS]\033[0m"
FAIL = "\033[31m[FAIL]\033[0m"
_failures = []


def check(name, condition, detail=""):
    if condition:
        print(f"  {PASS} {name}")
    else:
        print(f"  {FAIL} {name}" + (f" — {detail}" if detail else ""))
        _failures.append(name)


# ---------------------------------------------------------------------------
# 1. PIN hashing
# ---------------------------------------------------------------------------
def test_pin_hashing():
    print("\n[1] PIN Hashing (PBKDF2-HMAC-SHA256)")
    svc = SecurityService()

    h, s = svc.hash_pin("1234")
    check("Hash is hex string", isinstance(h, str) and all(c in "0123456789abcdef" for c in h))
    check("Hash length (64 hex = 32 bytes)", len(h) == 64)
    check("Salt length (64 hex = 32 bytes)", len(s) == 64)
    check("Hash is NOT the PIN", h != "1234" and "1234" not in h)

    # Two hashes of same PIN must differ (different salts)
    h2, s2 = svc.hash_pin("1234")
    check("Different salts produce different hashes", h != h2)
    check("Salts are different", s != s2)

    # Verify correct
    ok = svc.verify_pin("1234", h, s, 260_000)
    check("Correct PIN verifies", ok)

    # Verify wrong
    bad = svc.verify_pin("wrong", h, s, 260_000)
    check("Wrong PIN rejected", not bad)

    # Verify empty
    empty = svc.verify_pin("", h, s, 260_000)
    check("Empty PIN rejected", not empty)

    # Verify that verification uses constant-time comparison (smoke check)
    # We can't time it precisely, but we verify it calls compare_digest internally
    import inspect
    src = inspect.getsource(svc.verify_pin)
    check("Uses secrets.compare_digest", "compare_digest" in src)


# ---------------------------------------------------------------------------
# 2. Progressive lockout
# ---------------------------------------------------------------------------
def test_lockout():
    print("\n[2] Progressive Lockout")
    svc = SecurityService()
    h, s = svc.hash_pin("correct")

    # Simulate failures
    for _ in range(4):
        svc.on_auth_failure()

    locked, remaining = svc.check_lockout()
    check("Not locked after 4 failures (threshold is 5)", not locked)

    svc.on_auth_failure()  # 5th failure
    locked, remaining = svc.check_lockout()
    check("Locked after 5 failures", locked)
    check("Lockout duration >= 30s", remaining >= 29)

    # Session must be invalidated on lockout
    tok = svc.create_session()
    svc.on_auth_failure()  # triggers another lockout window
    check("Session invalidated after lockout", not svc.validate_session(tok))

    # Reset
    svc.on_auth_success()
    locked2, _ = svc.check_lockout()
    check("Lockout cleared after success", not locked2)


# ---------------------------------------------------------------------------
# 3. Session management
# ---------------------------------------------------------------------------
def test_session():
    print("\n[3] Session Management")
    svc = SecurityService()

    tok = svc.create_session()
    check("Token is 32-char hex (128-bit)", len(tok) == 32)
    check("Valid session accepted", svc.validate_session(tok))

    # Second session invalidates first
    tok2 = svc.create_session()
    check("New session replaces old", not svc.validate_session(tok))
    check("New token valid", svc.validate_session(tok2))

    # Invalidate
    svc.invalidate_session()
    check("Session cleared after invalidate", not svc.validate_session(tok2))
    check("None token always invalid", not svc.validate_session(None))
    check("Empty token always invalid", not svc.validate_session(""))


# ---------------------------------------------------------------------------
# 4. Path validation & traversal prevention
# ---------------------------------------------------------------------------
def test_path_validation():
    print("\n[4] Path Validation & Traversal Prevention")
    svc = SecurityService()

    # Build approved set using a temp directory
    with tempfile.TemporaryDirectory() as tmpdir:
        approved = {os.path.realpath(tmpdir)}

        # Subdirectory inside approved
        subdir = os.path.join(tmpdir, "subdir")
        os.makedirs(subdir)
        check("Subdirectory inside approved is valid",
              svc.validate_path_in_approved(subdir, approved))

        # File path inside approved
        fpath = os.path.join(tmpdir, "file.txt")
        check("File inside approved is valid",
              svc.validate_path_in_approved(fpath, approved))

        # Path outside approved
        parent = os.path.dirname(tmpdir)
        check("Parent of approved folder is rejected",
              not svc.validate_path_in_approved(parent, approved))

        # Traversal: tmpdir + /subdir/../../outside
        traversal = os.path.join(tmpdir, "subdir", "..", "..", "outside")
        check("../.. traversal is rejected",
              not svc.validate_path_in_approved(traversal, approved))

        # Encoded traversal via realpath (Windows %2e%2e is not normally decoded at FS level,
        # but we test the commonpath logic)
        fake_child = tmpdir + "Evil"  # looks like child via prefix matching, not commonpath
        check("String-prefix trick rejected by commonpath",
              not svc.validate_path_in_approved(fake_child, approved))

        # is_inside boundary check
        check("Exact approved folder is_inside itself",
              svc.is_inside(tmpdir, tmpdir))
        check("Sibling folder not inside",
              not svc.is_inside(parent + "/other", parent + "/approved"))


# ---------------------------------------------------------------------------
# 5. Excluded folder integration with scanner
# ---------------------------------------------------------------------------
def test_excluded_folders_scanner():
    print("\n[5] Excluded Folders in Scanner")
    from backend.app.services.scanner import scan_directory

    test_dir = os.path.join(ROOT, "test_scan_tmp")
    os.makedirs(test_dir, exist_ok=True)
    try:
        pub = os.path.join(test_dir, "public")
        priv = os.path.join(test_dir, "private")
        os.makedirs(pub, exist_ok=True)
        os.makedirs(priv, exist_ok=True)

        open(os.path.join(pub, "visible.txt"), "w").close()
        open(os.path.join(priv, "secret.txt"), "w").close()

        # Scan without exclusions
        all_files = scan_directory(test_dir)
        all_names = [f["name"] for f in all_files]
        check("Both files found without exclusions",
              "visible.txt" in all_names and "secret.txt" in all_names)

        # Scan with private excluded
        excluded = {os.path.realpath(priv)}
        filtered = scan_directory(test_dir, excluded_paths=excluded)
        filt_names = [f["name"] for f in filtered]
        check("Public file found with exclusion", "visible.txt" in filt_names)
        check("Private file excluded", "secret.txt" not in filt_names)

        # Excluding the root itself
        nothing = scan_directory(test_dir, excluded_paths={os.path.realpath(test_dir)})
        check("Root exclusion yields no files", len(nothing) == 0)
    finally:
        shutil.rmtree(test_dir, ignore_errors=True)


# ---------------------------------------------------------------------------
# 6. Audit log creation
# ---------------------------------------------------------------------------
def test_audit_log():
    print("\n[6] Audit Log")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        initial_count = db.query(AuditLog).count()

        security_service.audit(db, "test_action", "success",
                               resource="test_resource",
                               details={"key": "value"},
                               error=None)
        db.commit()

        count_after = db.query(AuditLog).count()
        check("Audit log entry created", count_after == initial_count + 1)

        entry = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
        check("Action stored correctly", entry.action == "test_action")
        check("Status stored correctly", entry.status == "success")
        check("Resource stored", entry.resource == "test_resource")
        check("Details stored as JSON string", '"key"' in (entry.details or ""))

        # Must NOT contain sensitive data
        check("Timestamp is set", entry.timestamp is not None)

        # Failure entry with error
        security_service.audit(db, "test_fail", "failure", error="something went wrong")
        db.commit()
        fail_entry = db.query(AuditLog).order_by(AuditLog.id.desc()).first()
        check("Error stored on failure entry", fail_entry.error is not None)
        check("No PIN in error field",
              "1234" not in (fail_entry.error or "") and "pin" not in (fail_entry.error or "").lower())
    finally:
        db.close()


# ---------------------------------------------------------------------------
# 7. Data removal — FAISS / SQLite consistency
# ---------------------------------------------------------------------------
def test_data_removal():
    print("\n[7] Data Removal — FAISS/SQLite Consistency")
    from backend.app.ai.faiss_manager import faiss_manager
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Snapshot current state
        initial_vm = db.query(VectorMapping).count()
        initial_faiss = faiss_manager.index.ntotal

        # Remove vector data
        result = security_service.remove_vector_data(db)
        check("Vector data removal returns dict", isinstance(result, dict))
        check("FAISS reset to 0", faiss_manager.index.ntotal == 0)

        vm_after = db.query(VectorMapping).count()
        check("VectorMapping table cleared", vm_after == 0)

        # Verify SQLite and FAISS are consistent (both 0)
        faiss_mapping_count = len(faiss_manager.faiss_to_chunk)
        check("FAISS in-memory mapping also cleared", faiss_mapping_count == 0)

    finally:
        db.close()


# ---------------------------------------------------------------------------
# 8. Backup creation and validation
# ---------------------------------------------------------------------------
def test_backup():
    print("\n[8] Backup Creation & Validation")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    with tempfile.TemporaryDirectory() as dest:
        try:
            result = security_service.create_backup(db, dest)
            check("Backup returns dict with path", "backup_path" in result)
            backup_path = result["backup_path"]
            check("Backup file exists", os.path.isfile(backup_path))
            check("Backup is a ZIP", zipfile.is_zipfile(backup_path))

            # Validate manifest
            manifest = security_service.validate_backup(backup_path)
            check("Manifest has backup_format_version", "backup_format_version" in manifest)
            check("Manifest has created_at", "created_at" in manifest)
            check("Manifest has included_files list",
                  isinstance(manifest.get("included_files"), list))
            check("DB file included", any("memora.db" in f for f in manifest["included_files"]))

            # Validate corrupt backup
            corrupt_path = os.path.join(dest, "corrupt.zip")
            with open(corrupt_path, "wb") as f:
                f.write(b"not a zip")
            try:
                security_service.validate_backup(corrupt_path)
                check("Corrupt backup raises ValueError", False, "no error raised")
            except ValueError:
                check("Corrupt backup raises ValueError", True)

            # Destination inside data dir should fail
            try:
                security_service.create_backup(db, DATA_DIR)
                check("Self-inclusion prevented", False, "no error raised")
            except ValueError:
                check("Self-inclusion prevented", True)

            # Temp file atomic rename: if zip exists at final path, no .tmp should remain
            tmp_files = [f for f in os.listdir(dest) if f.endswith(".tmp")]
            check("No orphaned .tmp files after successful backup", len(tmp_files) == 0)

        finally:
            db.close()


# ---------------------------------------------------------------------------
# 9. Protected API endpoints (live server test if available)
# ---------------------------------------------------------------------------
def test_api_endpoints():
    print("\n[9] Protected API Endpoints")
    try:
        import requests
    except ImportError:
        print("  [SKIP] requests not available — skipping live API tests")
        return

    base = "http://127.0.0.1:8000"

    try:
        r = requests.get(f"{base}/", timeout=2)
        if r.status_code != 200:
            print("  [SKIP] Backend not responding")
            return
    except Exception:
        print("  [SKIP] Backend not responding — skipping live API tests")
        return

    # Clear existing PIN hash in DB so set_pin operates on a clean state
    _db = SessionLocal()
    _s = _db.query(SecuritySettings).filter(SecuritySettings.id == 1).first()
    if _s:
        _s.pin_hash = None
        _s.pin_salt = None
        _s.lock_enabled = False
        _db.commit()
    _db.close()

    # Set PIN for tests (pass recovery_email for first-time setup requirement)
    r_set = requests.post(f"{base}/api/security/pin/set", json={"pin": "test9999", "recovery_email": "test@example.com"})

    # Enable lock
    r = requests.post(f"{base}/api/security/pin/verify", json={"pin": "test9999"})
    token = r.json().get("session_token", "")
    requests.post(f"{base}/api/security/lock/enable",
                  json={"enabled": True}, headers={"X-Session-Token": token})

    # Protected without token → 401
    r = requests.get(f"{base}/api/security/excluded-folders")
    check("Protected endpoint 401 without token", r.status_code == 401)

    # Protected with valid token → 200
    r = requests.get(f"{base}/api/security/excluded-folders",
                     headers={"X-Session-Token": token})
    check("Protected endpoint 200 with valid token", r.status_code == 200)

    # Wrong token → 401
    r = requests.get(f"{base}/api/security/excluded-folders",
                     headers={"X-Session-Token": "deadbeef" * 4})
    check("Protected endpoint 401 with wrong token", r.status_code == 401)

    # Progressive lockout via API
    for _ in range(5):
        requests.post(f"{base}/api/security/pin/verify", json={"pin": "bad"})
    r = requests.post(f"{base}/api/security/pin/verify", json={"pin": "bad"})
    check("API returns 429 after lockout", r.status_code == 429)

    # Lock Now invalidates session server-side
    r2 = requests.post(f"{base}/api/security/pin/verify", json={"pin": "test9999"})
    tok2 = r2.json().get("session_token", "")
    requests.post(f"{base}/api/security/lock/lock-now",
                  headers={"X-Session-Token": tok2})
    r = requests.get(f"{base}/api/security/excluded-folders",
                     headers={"X-Session-Token": tok2})
    check("Session invalidated after Lock Now", r.status_code == 401)

    # Cleanup: disable lock
    r3 = requests.post(f"{base}/api/security/pin/verify", json={"pin": "test9999"})
    tok3 = r3.json().get("session_token", "")
    requests.post(f"{base}/api/security/lock/enable",
                  json={"enabled": False}, headers={"X-Session-Token": tok3})
    print("  (lock disabled for cleanup)")


# ---------------------------------------------------------------------------
# 10. Existing Modules 1–4 regression
# ---------------------------------------------------------------------------
def test_regression():
    print("\n[10] Modules 1-4 Regression")
    try:
        import requests
    except ImportError:
        print("  [SKIP] requests not available")
        return

    base = "http://127.0.0.1:8000"
    try:
        r = requests.get(f"{base}/", timeout=2)
        if r.status_code != 200:
            print("  [SKIP] Backend not responding")
            return
    except Exception:
        print("  [SKIP] Backend not responding")
        return

    endpoints = [
        ("GET", "/api/folders", None),
        ("GET", "/api/statistics", None),
        ("GET", "/api/scan/status", None),
        ("GET", "/api/organization/categories", None),
        ("GET", "/api/organization/overview", None),
    ]

    for method, path, body in endpoints:
        r = requests.request(method, f"{base}{path}", json=body, timeout=5)
        check(f"{method} {path} still works (2xx)", 200 <= r.status_code < 300)


# ---------------------------------------------------------------------------
# 11. Email-Based PIN Recovery & Masking
# ---------------------------------------------------------------------------
def test_email_recovery():
    print("\n[11] Email-Based PIN Recovery & Masking")
    svc = SecurityService()

    # 1. Reset code generation & hashing
    code = svc.generate_reset_code()
    check("Reset code is 6 digits", len(code) == 6 and code.isdigit())

    chash = svc.hash_reset_code(code)
    check("Code hash is SHA-256 (64 hex chars)", len(chash) == 64)
    check("Reset code is NOT stored plaintext", code not in chash)

    ok = svc.verify_reset_code(code, chash)
    check("Correct reset code verifies", ok)

    bad = svc.verify_reset_code("000000" if code != "000000" else "111111", chash)
    check("Incorrect reset code rejected", not bad)

    # 2. Email masking
    masked = svc.mask_email("user.name@example.com")
    check("Email masked correctly", masked.startswith("u") and "@example.com" in masked)
    check("Short email masked correctly", svc.mask_email("ab@c.com") == "a*@c.com")

    # 3. Mocked EmailService integration check
    from unittest.mock import MagicMock
    from backend.app.services.email_service import email_service

    sent_codes = []
    def mock_send(to_email, reset_code):
        sent_codes.append((to_email, reset_code))
        return True, ""

    original_send = email_service.send_reset_code
    email_service.send_reset_code = MagicMock(side_effect=mock_send)

    db = SessionLocal()
    try:
        settings = db.query(SecuritySettings).filter(SecuritySettings.id == 1).first()
        if not settings:
            settings = SecuritySettings(id=1)
            db.add(settings)

        settings.recovery_email = "test.recovery@memora.ai"
        new_hash, new_salt = svc.hash_pin("12345")
        settings.pin_hash = new_hash
        settings.pin_salt = new_salt
        db.commit()

        # Simulate forgot pin call using backend route logic
        from backend.app.routes.security import forgot_pin, ForgotPinRequest
        req = ForgotPinRequest(email="test.recovery@memora.ai")
        res = forgot_pin(req, db=db)

        check("Forgot PIN returns generic success message", "message" in res)
        check("Mocked email_service called once", email_service.send_reset_code.call_count == 1)
        check("Sent code recipient matches", len(sent_codes) > 0 and sent_codes[0][0] == "test.recovery@memora.ai")
        check("Sent code is 6 digits", len(sent_codes) > 0 and len(sent_codes[0][1]) == 6 and sent_codes[0][1].isdigit())

        sent_code = sent_codes[0][1]

        # Verify reset code
        from backend.app.routes.security import reset_pin, ResetPinRequest
        reset_req = ResetPinRequest(reset_code=sent_code, new_pin="new9999")
        reset_res = reset_pin(reset_req, db=db)
        check("Reset PIN succeeds", "successfully" in reset_res.get("message", ""))

        # Verify old PIN no longer works
        db.refresh(settings)
        old_ok = svc.verify_pin("12345", settings.pin_hash, settings.pin_salt, settings.pin_iterations)
        check("Old PIN rejected after reset", not old_ok)

        # Verify new PIN works
        new_ok = svc.verify_pin("new9999", settings.pin_hash, settings.pin_salt, settings.pin_iterations)
        check("New PIN accepted after reset", new_ok)

        # Verify reset code invalidated immediately
        check("Reset code hash cleared after use", settings.reset_code_hash is None)

    finally:
        db.close()
        email_service.send_reset_code = original_send


def test_file_and_folder_exclusion():
    print("\n[12] File and Folder Exclusion (Granular Privacy)")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    db.query(ExcludedFolder).delete()
    db.commit()
    svc = security_service

    tmp_dir = os.path.join(ROOT, "test_excl_tmp")
    os.makedirs(tmp_dir, exist_ok=True)
    try:
        norm_file = os.path.join(tmp_dir, "normal.pdf")
        priv_file = os.path.join(tmp_dir, "private.pdf")
        priv_dir = os.path.join(tmp_dir, "PrivateFolder")
        os.makedirs(priv_dir, exist_ok=True)
        sec_doc = os.path.join(priv_dir, "secret.docx")

        for fp in [norm_file, priv_file, sec_doc]:
            with open(fp, "w") as f:
                f.write("content")

        real_priv_file = svc.resolve_path(priv_file)
        excl_f = ExcludedFolder(path=real_priv_file, item_type="file")
        db.add(excl_f)

        real_priv_dir = svc.resolve_path(priv_dir)
        excl_d = ExcludedFolder(path=real_priv_dir, item_type="folder")
        db.add(excl_d)
        db.commit()

        excl_paths = svc.get_excluded_paths(db)
        check("get_excluded_paths returns both file and folder", real_priv_file in excl_paths and real_priv_dir in excl_paths)

        from backend.app.services.scanner import scan_directory
        scanned = scan_directory(tmp_dir, excluded_paths=excl_paths)
        scanned_paths = [s["path"] for s in scanned]

        check("Normal file is scanned", any(svc.resolve_path(p) == svc.resolve_path(norm_file) for p in scanned_paths))
        check("Excluded private file is NOT scanned", not any(svc.resolve_path(p) == real_priv_file for p in scanned_paths))
        check("Files inside excluded folder are NOT scanned", not any(svc.resolve_path(p) == svc.resolve_path(sec_doc) for p in scanned_paths))

        db.delete(excl_f)
        db.delete(excl_d)
        db.commit()
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        db.close()


def test_local_aes256_gcm_encryption_and_decryption():
    print("\n[13] Local AES-256-GCM Encryption & Decryption")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    svc = security_service

    with tempfile.TemporaryDirectory() as tmp_dir:
        folder_path = os.path.join(tmp_dir, "SecureDocs")
        os.makedirs(folder_path, exist_ok=True)
        file_path = os.path.join(folder_path, "confidential.txt")
        original_text = "Top Secret Personal Data 123456"
        with open(file_path, "w") as f:
            f.write(original_text)

        res_enc = svc.encrypt_file(db, file_path)
        check("encrypt_file returns status success", res_enc["status"] == "success")
        check("is_file_encrypted returns True", svc.is_file_encrypted(file_path))

        with open(file_path, "rb") as f:
            raw_data = f.read()
        check("File content starts with magic header MEMORA_ENC_v1", raw_data.startswith(b"MEMORA_ENC_v1"))
        check("Plaintext is NOT present in raw encrypted file", original_text.encode() not in raw_data)

        res_dec = svc.decrypt_file(db, file_path)
        check("decrypt_file returns status success", res_dec["status"] == "success")
        check("is_file_encrypted returns False after decryption", not svc.is_file_encrypted(file_path))

        with open(file_path, "r") as f:
            restored_text = f.read()
        check("Restored text matches original text exactly", restored_text == original_text)

        sub_file = os.path.join(folder_path, "sub.txt")
        with open(sub_file, "w") as f:
            f.write("sub content")

        f_enc = svc.encrypt_folder(db, folder_path)
        check("encrypt_folder encrypts all files", f_enc["encrypted_count"] == 2)
        check("All files in folder encrypted", svc.is_file_encrypted(file_path) and svc.is_file_encrypted(sub_file))

        f_dec = svc.decrypt_folder(db, folder_path)
        check("decrypt_folder decrypts all files", f_dec["decrypted_count"] == 2)

        svc.encrypt_file(db, file_path)
        with open(file_path, "r+b") as f:
            f.seek(30)
            f.write(b"X")

        try:
            svc.decrypt_file(db, file_path)
            check("Corrupted file decryption fails", False, "Expected ValueError")
        except ValueError as e:
            check("Corrupted file decryption rejected cleanly", "Corrupted encrypted data" in str(e) or "Decryption failed" in str(e))

    db.close()


def test_permanent_cascading_deletion_and_safety_checks():
    print("\n[14] Permanent Cascading Deletion & Path Safety Checks")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    svc = security_service

    with tempfile.TemporaryDirectory() as tmp_dir:
        app_folder = Folder(path=svc.resolve_path(tmp_dir), name="TestApproved")
        db.add(app_folder)
        db.commit()

        parent_dir = os.path.join(tmp_dir, "Parent")
        os.makedirs(parent_dir, exist_ok=True)
        f1 = os.path.join(parent_dir, "file1.pdf")
        child_dir = os.path.join(parent_dir, "Child")
        os.makedirs(child_dir, exist_ok=True)
        f2 = os.path.join(child_dir, "doc.txt")

        for fp in [f1, f2]:
            with open(fp, "w") as f:
                f.write("data")

        info = svc.inspect_delete_path(db, parent_dir)
        check("Inspect path returns folder info", info["is_folder"])
        check("Child file count calculated correctly", info["child_file_count"] == 2)
        check("Child folder count calculated correctly", info["child_folder_count"] == 1)
        check("Inside approved folder is True", info["is_inside_approved"])

        try:
            svc.delete_permanently(db, os.path.abspath(os.sep), confirm=True)
            check("System root deletion blocked", False, "Should have failed")
        except ValueError as e:
            check("System root deletion blocked with security policy error", "strictly prohibited" in str(e) or "protected" in str(e))

        res = svc.delete_permanently(db, parent_dir, confirm=True)
        check("Permanent deletion returned success", res["status"] == "success")
        check("Parent directory removed from disk", not os.path.exists(parent_dir))
        check("Child files removed from disk", not os.path.exists(f1) and not os.path.exists(f2))

        db.delete(app_folder)
        db.commit()

    db.close()


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def run_all():
    print("=" * 60)
    print("MEMORA AI - MODULE 5 SECURITY TEST SUITE")
    print("=" * 60)

    init_db_schema()

    test_pin_hashing()
    test_lockout()
    test_session()
    test_path_validation()
    test_excluded_folders_scanner()
    test_audit_log()
    test_data_removal()
    test_backup()
    test_api_endpoints()
    test_email_recovery()
    test_file_and_folder_exclusion()
    test_local_aes256_gcm_encryption_and_decryption()
    test_permanent_cascading_deletion_and_safety_checks()
    test_regression()

    print("\n" + "=" * 60)
    if _failures:
        print(f"\033[31mFAILED: {len(_failures)} test(s)\033[0m")
        for f in _failures:
            print(f"  - {f}")
        print("=" * 60)
        return False
    else:
        print("\033[32mALL MODULE 5 TESTS PASSED\033[0m")
        print("=" * 60)
        return True


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
