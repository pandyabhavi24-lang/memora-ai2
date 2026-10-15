"""
MEMORA AI — STORAGE EMAIL SHARING AUTOMATED TESTS
==================================================
Comprehensive automated test suite covering:
1. Correct MIME message structure and multiple attachments
2. ZIP attachment mode handling
3. Individual-file (originals) attachment mode handling
4. Invalid mode and empty selection rejection
5. Missing file record or missing source-file rejection
6. Excluded and encrypted file rejection according to project rules
7. Outside-approved-scope path rejection
8. Attachment-size rejection before SMTP transmission
9. Temporary ZIP cleanup after successful transmission
10. Temporary ZIP cleanup when SMTP transmission fails
11. SMTP connection/authentication/send failure handling
12. PIN recovery compatibility (send_reset_code preserved and functional)

ALL SMTP interactions are strictly mocked. NO real emails are transmitted.
"""

import os
import sys
import shutil
import tempfile
from datetime import datetime
from unittest.mock import MagicMock, patch

# Ensure backend package is in path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.database import SessionLocal, Base, engine
from app.models import Folder, File, ExcludedFolder
from app.services.storage_service import storage_service, StorageServiceError, calculate_sha256
from app.services.email_service import email_service
from app.routes.storage import share_files_via_email
from app.schemas import EmailShareRequest
from fastapi import HTTPException


def run_tests():
    print("==================================================")
    print("MEMORA AI — STORAGE EMAIL SHARING BACKEND TESTS")
    print("==================================================")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    test_dir = tempfile.mkdtemp(prefix="memora_email_test_")
    print(f"Temporary test directory: {test_dir}")

    passed = 0
    failed = 0

    def check(name: str, condition: bool, extra: str = ""):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name} {extra}")
            passed += 1
        else:
            print(f"  [FAIL] {name} {extra}")
            failed += 1

    try:
        # Create an authorized active test folder
        test_folder = Folder(path=test_dir, name="EmailTestFolder", is_active=True)
        db.add(test_folder)
        db.commit()
        db.refresh(test_folder)

        # Helper to create physical test files
        def make_test_file(filename: str, content: bytes = b"Sample file content for email testing", is_encrypted: bool = False) -> File:
            fpath = os.path.join(test_dir, filename)
            with open(fpath, "wb") as f:
                f.write(content)

            fstat = os.stat(fpath)
            ext = os.path.splitext(filename)[1].lower()
            rec = File(
                folder_id=test_folder.id,
                path=fpath,
                name=filename,
                extension=ext,
                size=fstat.st_size,
                modified_at=datetime.fromtimestamp(fstat.st_mtime),
                file_hash=calculate_sha256(fpath),
                mime_type="application/octet-stream" if ext not in (".pdf", ".txt") else ("application/pdf" if ext == ".pdf" else "text/plain"),
                extraction_status="pending",
                is_encrypted=is_encrypted
            )
            db.add(rec)
            db.commit()
            db.refresh(rec)
            return rec

        f1 = make_test_file("report.txt", b"Annual Report Content 2026")
        f2 = make_test_file("document.pdf", b"%PDF-1.4 Mocked PDF binary data")
        f3 = make_test_file("data.bin", b"\x00\x01\x02\x03\x04\x05Binary payload")

        # -----------------------------------------------------------------
        # TEST 1: MIME structure & Multiple Attachments via send_file_sharing_email
        # -----------------------------------------------------------------
        print("\n[Test 1] Testing MIME message construction and multiple attachments...")
        sent_messages = []
        mock_server = MagicMock()
        mock_server.send_message = MagicMock(side_effect=lambda msg, **kw: sent_messages.append((msg, kw)))

        with patch("smtplib.SMTP") as mock_smtp, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_HOST": "smtp.example.com", "SMTP_PORT": "587", "SMTP_FROM": "test@memora.ai"}):
            mock_smtp.return_value.__enter__.return_value = mock_server

            res = email_service.send_file_sharing_email(
                to_email="colleague@example.com",
                subject="Test Project Documents",
                message_body="Please review attached files.",
                attachments=[
                    (f1.path, "Report_Final.txt", "text/plain"),
                    (f2.path, "Doc_Final.pdf", "application/pdf")
                ],
                sender_name="Memora AI"
            )

            check("Status is success", res["status"] == "success")
            check("Attachments count matches", res["attachments_count"] == 2)
            check("SMTP send_message was called once", mock_server.send_message.call_count == 1)

            sent_msg = sent_messages[0][0]
            check("From header contains 'Memora AI'", "Memora AI" in sent_msg["From"])
            check("From header contains sender email", "test@memora.ai" in sent_msg["From"])
            check("To header matches recipient", sent_msg["To"] == "colleague@example.com")
            check("Subject header matches", sent_msg["Subject"] == "Test Project Documents")

            # Check MIME parts: 1 text/plain body + 2 attachments
            parts = sent_msg.get_payload()
            check("MIME multipart contains 3 parts (body + 2 attachments)", len(parts) == 3)
            check("First part is text body", parts[0].get_content_type() == "text/plain")
            check("Second part has filename Report_Final.txt", parts[1].get_filename() == "Report_Final.txt")
            check("Third part has filename Doc_Final.pdf", parts[2].get_filename() == "Doc_Final.pdf")

        # -----------------------------------------------------------------
        # TEST 2: ZIP Attachment Mode via API Endpoint
        # -----------------------------------------------------------------
        print("\n[Test 2] Testing ZIP mode packaging and delivery...")
        sent_messages.clear()
        mock_server.reset_mock()

        with patch("smtplib.SMTP") as mock_smtp, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_PORT": "587"}):
            mock_smtp.return_value.__enter__.return_value = mock_server

            req = EmailShareRequest(
                file_ids=[f1.id, f2.id],
                mode="zip",
                to_email="partner@example.com",
                subject="Shared Archive",
                zip_filename="custom_bundle.zip"
            )
            api_res = share_files_via_email(req, db=db)

            check("API status is success", api_res.status == "success")
            check("API mode is zip", api_res.mode == "zip")
            check("API attachments_count is 1 (ZIP bundle)", api_res.attachments_count == 1)

            sent_msg = sent_messages[0][0]
            parts = sent_msg.get_payload()
            zip_part = parts[1]
            check("Attachment filename is custom_bundle.zip", zip_part.get_filename() == "custom_bundle.zip")

        # -----------------------------------------------------------------
        # TEST 3: Individual-File (Originals) Mode via API Endpoint
        # -----------------------------------------------------------------
        print("\n[Test 3] Testing Originals mode with individual attachments...")
        sent_messages.clear()
        mock_server.reset_mock()

        with patch("smtplib.SMTP") as mock_smtp, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_PORT": "587"}):
            mock_smtp.return_value.__enter__.return_value = mock_server

            req = EmailShareRequest(
                file_ids=[f1.id, f2.id, f3.id],
                mode="originals",
                to_email="reviewer@example.com",
                subject="Individual Files"
            )
            api_res = share_files_via_email(req, db=db)

            check("API status is success", api_res.status == "success")
            check("API mode is originals", api_res.mode == "originals")
            check("API attachments_count is 3", api_res.attachments_count == 3)

            sent_msg = sent_messages[0][0]
            parts = sent_msg.get_payload()
            filenames = [p.get_filename() for p in parts[1:]]
            check("All 3 individual filenames attached", filenames == ["report.txt", "document.pdf", "data.bin"])

        # -----------------------------------------------------------------
        # TEST 4: Invalid Mode & Empty Selection Rejection
        # -----------------------------------------------------------------
        print("\n[Test 4] Testing invalid mode and empty file list rejection...")
        try:
            # Pydantic validation should reject empty file_ids
            EmailShareRequest(file_ids=[], mode="zip", to_email="test@example.com")
            check("Empty file_ids rejected", False)
        except Exception:
            check("Empty file_ids rejected by schema validation", True)

        try:
            # Pydantic validation should reject invalid mode
            EmailShareRequest(file_ids=[f1.id], mode="invalid_mode", to_email="test@example.com")
            check("Invalid mode rejected", False)
        except Exception:
            check("Invalid mode rejected by schema validation", True)

        # -----------------------------------------------------------------
        # TEST 5: Missing File Record & Missing Source-File Rejection
        # -----------------------------------------------------------------
        print("\n[Test 5] Testing missing file record and missing disk file rejection...")
        try:
            storage_service.prepare_email_attachments(db=db, file_ids=[999999], mode="zip")
            check("Non-existent DB file ID rejected", False)
        except StorageServiceError as e:
            check("Non-existent DB file ID raised StorageServiceError", "not found" in str(e).lower())

        # Test file in DB whose disk file is deleted
        ghost_path = os.path.join(test_dir, "ghost.txt")
        ghost_file = File(
            folder_id=test_folder.id,
            path=ghost_path,
            name="ghost.txt",
            extension=".txt",
            size=10,
            modified_at=datetime.utcnow(),
            file_hash="dummyhash",
            mime_type="text/plain"
        )
        db.add(ghost_file)
        db.commit()
        db.refresh(ghost_file)

        try:
            storage_service.prepare_email_attachments(db=db, file_ids=[ghost_file.id], mode="zip")
            check("Missing disk file rejected", False)
        except StorageServiceError as e:
            check("Missing disk file raised StorageServiceError", "does not exist on disk" in str(e).lower())
            check("Missing disk file does not leak absolute path", "ghost.txt" in str(e) and test_dir not in str(e))
        finally:
            db.delete(ghost_file)
            db.commit()

        # -----------------------------------------------------------------
        # TEST 6: Excluded and Encrypted File Rejection
        # -----------------------------------------------------------------
        print("\n[Test 6] Testing security-excluded and encrypted file rejection...")
        # 1. Encrypted file
        f_enc = make_test_file("confidential.dat", b"secret info", is_encrypted=True)
        try:
            storage_service.prepare_email_attachments(db=db, file_ids=[f_enc.id], mode="zip")
            check("Encrypted file rejected", False)
        except StorageServiceError as e:
            check("Encrypted file raised StorageServiceError", "encrypted" in str(e).lower())

        # 2. Excluded folder
        excluded_dir = os.path.join(test_dir, "excluded_vault")
        os.makedirs(excluded_dir, exist_ok=True)
        exc_row = ExcludedFolder(path=excluded_dir, item_type="folder")
        db.add(exc_row)
        db.commit()

        f_exc_path = os.path.join(excluded_dir, "private.txt")
        with open(f_exc_path, "wb") as f:
            f.write(b"private data")

        f_exc = File(
            folder_id=test_folder.id,
            path=f_exc_path,
            name="private.txt",
            extension=".txt",
            size=12,
            modified_at=datetime.utcnow(),
            file_hash="hash123",
            mime_type="text/plain"
        )
        db.add(f_exc)
        db.commit()

        try:
            storage_service.prepare_email_attachments(db=db, file_ids=[f_exc.id], mode="zip")
            check("Excluded file rejected", False)
        except StorageServiceError as e:
            check("Excluded file raised StorageServiceError", "excluded" in str(e).lower())
        finally:
            db.delete(exc_row)
            db.delete(f_exc)
            db.commit()

        # -----------------------------------------------------------------
        # TEST 7: Outside-Approved-Scope Path Rejection
        # -----------------------------------------------------------------
        print("\n[Test 7] Testing outside authorized storage scope rejection...")
        outside_dir = tempfile.mkdtemp(prefix="memora_unauthorized_")
        outside_file_path = os.path.join(outside_dir, "traversal.txt")
        with open(outside_file_path, "wb") as f:
            f.write(b"unauthorized outside file")

        f_outside = File(
            folder_id=test_folder.id,
            path=outside_file_path,
            name="traversal.txt",
            extension=".txt",
            size=25,
            modified_at=datetime.utcnow(),
            file_hash="hashout",
            mime_type="text/plain"
        )
        db.add(f_outside)
        db.commit()

        try:
            storage_service.prepare_email_attachments(db=db, file_ids=[f_outside.id], mode="zip")
            check("Outside authorized folder rejected", False)
        except StorageServiceError as e:
            check("Outside authorized folder rejected", "outside authorized storage" in str(e).lower())
        finally:
            db.delete(f_outside)
            db.commit()
            shutil.rmtree(outside_dir, ignore_errors=True)

        # -----------------------------------------------------------------
        # TEST 8: Attachment-Size Rejection Before SMTP Transmission
        # -----------------------------------------------------------------
        print("\n[Test 8] Testing attachment size limit enforcement...")
        # Test exceeding raw limit in prepare_email_attachments
        try:
            storage_service.prepare_email_attachments(
                db=db,
                file_ids=[f1.id],
                mode="originals",
                max_raw_bytes=5  # set artificially low to trigger raw check
            )
            check("Exceeding raw attachment limit rejected", False)
        except StorageServiceError as e:
            check("Exceeding raw attachment limit rejected", "exceeds the raw attachment limit" in str(e).lower())

        # Test exceeding total MIME message size in email_service
        with patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_PORT": "587"}):
            try:
                email_service.send_file_sharing_email(
                    to_email="test@example.com",
                    subject="Test Oversized MIME",
                    message_body="Body",
                    attachments=[(f1.path, "report.txt", "text/plain")],
                    max_message_bytes=50  # set artificially low to trigger MIME ceiling
                )
                check("Exceeding total MIME message size rejected", False)
            except ValueError as ve:
                check("Exceeding total MIME message size rejected", "exceeds the maximum email delivery limit" in str(ve).lower())

        # -----------------------------------------------------------------
        # TEST 9: Temporary ZIP Cleanup After Successful Transmission
        # -----------------------------------------------------------------
        print("\n[Test 9] Testing temporary ZIP cleanup after successful send...")
        temp_zip_captured = []
        original_prepare = storage_service.prepare_email_attachments

        def spy_prepare(*args, **kwargs):
            res = original_prepare(*args, **kwargs)
            temp_zip_captured.append(res[1])
            return res

        storage_service.prepare_email_attachments = spy_prepare

        with patch("smtplib.SMTP") as mock_smtp, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_PORT": "587"}):
            mock_smtp.return_value.__enter__.return_value = MagicMock()

            req = EmailShareRequest(file_ids=[f1.id], mode="zip", to_email="test@example.com")
            share_files_via_email(req, db=db)

            created_zip = temp_zip_captured[0]
            check("Temp ZIP path was created", created_zip is not None)
            check("Temp ZIP was deleted after successful send", not os.path.exists(created_zip))

        # -----------------------------------------------------------------
        # TEST 10: Temporary ZIP Cleanup When SMTP Transmission Fails
        # -----------------------------------------------------------------
        print("\n[Test 10] Testing temporary ZIP cleanup on SMTP delivery failure...")
        temp_zip_captured.clear()

        with patch("smtplib.SMTP") as mock_smtp, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_PORT": "587"}):
            mock_smtp.return_value.__enter__.side_effect = RuntimeError("SMTP connection timed out")

            req = EmailShareRequest(file_ids=[f1.id], mode="zip", to_email="test@example.com")
            try:
                share_files_via_email(req, db=db)
                check("SMTP error raised", False)
            except HTTPException as he:
                check("HTTPException raised on SMTP error", he.status_code == 502)
                check("HTTPException detail is sanitized", he.detail == "Email delivery failed. Please check your network connection and SMTP configuration.")
                check("Internal error details not in detail", "timed out" not in he.detail)

            failed_zip = temp_zip_captured[0]
            check("Temp ZIP was deleted after failed transmission", not os.path.exists(failed_zip))

        # Restore original function
        storage_service.prepare_email_attachments = original_prepare

        # -----------------------------------------------------------------
        # TEST 11: SMTP Connection & Authentication Failure Handling
        # -----------------------------------------------------------------
        print("\n[Test 11] Testing SMTP credential and connection failure handling...")
        with patch.dict(os.environ, {"SMTP_USER": "", "SMTP_PASS": ""}, clear=True):
            try:
                email_service.send_file_sharing_email(
                    to_email="test@example.com",
                    subject="Test Missing Config",
                    message_body="Body",
                    attachments=[(f1.path, "f1.txt", "text/plain")]
                )
                check("Missing SMTP config rejected", False)
            except RuntimeError as re_err:
                check("Missing SMTP config raises RuntimeError cleanly", "not configured" in str(re_err).lower())

        # -----------------------------------------------------------------
        # TEST 12: PIN Recovery Compatibility (send_reset_code)
        # -----------------------------------------------------------------
        print("\n[Test 12] Testing existing PIN recovery compatibility...")
        with patch("smtplib.SMTP") as mock_smtp, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_HOST": "smtp.example.com", "SMTP_PORT": "587"}):
            mock_server_pin = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server_pin

            ok, err = email_service.send_reset_code("user@example.com", "654321")
            check("send_reset_code succeeded", ok is True and err == "")
            check("send_reset_code invoked SMTP send_message", mock_server_pin.send_message.call_count == 1)

            pin_msg = mock_server_pin.send_message.call_args[0][0]
            check("PIN reset email subject intact", pin_msg["Subject"] == "Memora AI - PIN Reset Code")
            check("PIN reset code 654321 included in body", "654321" in pin_msg.as_string())

        # -----------------------------------------------------------------
        # TEST 13: Fail-Closed Scope Validation When Approved Folders List Is Empty
        # -----------------------------------------------------------------
        print("\n[Test 13] Testing fail-closed folder authorization when approved folders list is empty...")
        test_folder.is_active = False
        db.commit()

        try:
            storage_service.prepare_email_attachments(db=db, file_ids=[f1.id], mode="zip")
            check("Empty approved-folders list rejected", False)
        except StorageServiceError as e:
            check("Empty approved-folders list rejected (fail-closed)", "outside authorized storage folders" in str(e).lower())
        finally:
            test_folder.is_active = True
            db.commit()

        # -----------------------------------------------------------------
        # TEST 14: Valid File Inside Active Approved Folder Remains Shareable
        # -----------------------------------------------------------------
        print("\n[Test 14] Testing valid file in active approved folder remains shareable...")
        items, _, total_bytes = storage_service.prepare_email_attachments(db=db, file_ids=[f1.id], mode="originals")
        check("Valid file inside active approved folder accepted", len(items) == 1 and items[0][1] == "report.txt")
        check("Returned size matches", total_bytes == f1.size)

        # -----------------------------------------------------------------
        # TEST 15: Subject Line Header Injection Validation (\r and \n Rejection)
        # -----------------------------------------------------------------
        print("\n[Test 15] Testing email subject validation rejects newlines & header injection...")
        from pydantic import ValidationError

        # 1. Subject with \r\n
        try:
            EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", subject="Test\r\nBcc: evil@example.com")
            check("Subject with \\r\\n rejected", False)
        except ValidationError:
            check("Subject with \\r\\n rejected by schema validation (HTTP 422)", True)

        # 2. Subject with \n
        try:
            EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", subject="Line1\nLine2")
            check("Subject with \\n rejected", False)
        except ValidationError:
            check("Subject with \\n rejected by schema validation", True)

        # 3. Subject with \r
        try:
            EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", subject="Line1\rLine2")
            check("Subject with \\r rejected", False)
        except ValidationError:
            check("Subject with \\r rejected by schema validation", True)

        # 4. Valid clean subject passes
        clean_req = EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", subject="Quarterly Report Assets")
        check("Valid clean subject accepted", clean_req.subject == "Quarterly Report Assets")

        # -----------------------------------------------------------------
        # TEST 16: Sanitization of Internal Details on SMTP Failures
        # -----------------------------------------------------------------
        print("\n[Test 16] Testing SMTP exception detail sanitization...")
        with patch("smtplib.SMTP") as mock_smtp, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_PORT": "587"}):
            mock_smtp.return_value.__enter__.side_effect = RuntimeError("Failed to connect to 192.168.1.55:25 (internal-relay.corp.local)")

            req = EmailShareRequest(file_ids=[f1.id], mode="zip", to_email="test@example.com")
            try:
                share_files_via_email(req, db=db)
                check("SMTP error raised", False)
            except HTTPException as he:
                check("HTTPException status code is 502", he.status_code == 502)
                check("Response detail is clean generic message", he.detail == "Email delivery failed. Please check your network connection and SMTP configuration.")
                check("Internal IP not leaked in detail", "192.168.1.55" not in he.detail)
                check("Internal hostname not leaked in detail", "internal-relay" not in he.detail)

        # -----------------------------------------------------------------
        # TEST 17: Custom ZIP Filename Validation (CR/LF, NUL, Path Separators)
        # -----------------------------------------------------------------
        print("\n[Test 17] Testing custom ZIP filename validation...")
        # 1. CRLF injection
        try:
            EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", zip_filename="archive\r\nBcc: evil@example.com.zip")
            check("ZIP filename with CRLF rejected", False)
        except ValidationError:
            check("ZIP filename with CRLF rejected (HTTP 422)", True)

        # 2. NUL byte
        try:
            EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", zip_filename="archive\0evil.zip")
            check("ZIP filename with NUL rejected", False)
        except ValidationError:
            check("ZIP filename with NUL rejected", True)

        # 3. Forward slash path separator
        try:
            EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", zip_filename="../etc/evil.zip")
            check("ZIP filename with / separator rejected", False)
        except ValidationError:
            check("ZIP filename with / separator rejected", True)

        # 4. Backslash path separator
        try:
            EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", zip_filename="..\\windows\\evil.zip")
            check("ZIP filename with \\ separator rejected", False)
        except ValidationError:
            check("ZIP filename with \\ separator rejected", True)

        # 5. Quote characters
        try:
            EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", zip_filename='my"archive.zip')
            check("ZIP filename with quotes rejected", False)
        except ValidationError:
            check("ZIP filename with quotes rejected", True)

        # 6. Empty / pure dots
        try:
            EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", zip_filename="..")
            check("ZIP filename '..' rejected", False)
        except ValidationError:
            check("ZIP filename '..' rejected", True)

        # 7. Valid custom ZIP filename
        valid_zip_req = EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", zip_filename="custom_bundle.zip")
        check("Valid custom_bundle.zip accepted", valid_zip_req.zip_filename == "custom_bundle.zip")

        # 8. Valid custom name without extension
        valid_noext_req = EmailShareRequest(file_ids=[f1.id], to_email="test@example.com", zip_filename="my_documents")
        check("Valid custom name without extension accepted", valid_noext_req.zip_filename == "my_documents")

        # -----------------------------------------------------------------
        # TEST 18: Cross-Platform ZIP Entry Sanitization & Fallback
        # -----------------------------------------------------------------
        print("\n[Test 18] Testing cross-platform ZIP entry sanitization and fallback...")
        import zipfile as zf_module

        # Create temporary file with unusual name in DB
        unusual_path = os.path.join(test_dir, "unusual_file.txt")
        with open(unusual_path, "wb") as f:
            f.write(b"content for unusual entry test")

        f_unusual = File(
            folder_id=test_folder.id,
            path=unusual_path,
            name="subfolder\\nested/unusual_file.txt",
            extension=".txt",
            size=len(b"content for unusual entry test"),
            modified_at=datetime.utcnow(),
            file_hash="unusualhash",
            mime_type="text/plain"
        )
        db.add(f_unusual)
        db.commit()

        # Also file with empty-like name '..'
        dot_path = os.path.join(test_dir, "dot_file.txt")
        with open(dot_path, "wb") as f:
            f.write(b"content for dot fallback test")

        f_dot = File(
            folder_id=test_folder.id,
            path=dot_path,
            name="..",
            extension=".txt",
            size=len(b"content for dot fallback test"),
            modified_at=datetime.utcnow(),
            file_hash="dothash",
            mime_type="text/plain"
        )
        db.add(f_dot)
        db.commit()

        try:
            items, test_zip_path, _ = storage_service.prepare_email_attachments(
                db=db,
                file_ids=[f_unusual.id, f_dot.id],
                mode="zip",
                zip_filename="sanitized_test.zip"
            )
            check("ZIP attachment created", test_zip_path is not None and os.path.exists(test_zip_path))
            check("ZIP attachment display name sanitized", items[0][1] == "sanitized_test.zip")

            with zf_module.ZipFile(test_zip_path, "r") as zf:
                namelist = zf.namelist()
                check("Directory path separators stripped from entry name", "unusual_file.txt" in namelist)
                check("No subdirectories created in ZIP", not any("/" in name or "\\" in name for name in namelist))
                check("Fallback filename used for '..' entry", any(name.startswith("attachment_") for name in namelist))
                # Verify content integrity
                extracted = zf.read("unusual_file.txt")
                check("Extracted entry content matches disk file", extracted == b"content for unusual entry test")
        finally:
            if test_zip_path and os.path.exists(test_zip_path):
                os.remove(test_zip_path)
            db.delete(f_unusual)
            db.delete(f_dot)
            db.commit()
        # -----------------------------------------------------------------
        # TEST 19: 60s Timeout & Granular Failure-Phase Diagnostics
        # -----------------------------------------------------------------
        print("\n[Test 19] Testing 60s timeout and granular failure-phase diagnostics...")
        with patch("smtplib.SMTP") as mock_smtp, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_PORT": "587"}):
            mock_server = MagicMock()
            mock_smtp.return_value.__enter__.return_value = mock_server

            req = EmailShareRequest(file_ids=[f1.id], mode="originals", to_email="test@example.com")
            share_files_via_email(req, db=db)

            check("SMTP initialized with 60s timeout on port 587", mock_smtp.call_args[1].get("timeout") == 60)

        with patch("smtplib.SMTP_SSL") as mock_smtp_ssl, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_PORT": "465"}):
            mock_server_ssl = MagicMock()
            mock_smtp_ssl.return_value.__enter__.return_value = mock_server_ssl

            req = EmailShareRequest(file_ids=[f1.id], mode="originals", to_email="test@example.com")
            share_files_via_email(req, db=db)

            check("SMTP_SSL initialized with 60s timeout on port 465", mock_smtp_ssl.call_args[1].get("timeout") == 60)

        # Confirm send_reset_code timeout remains untouched at 10s
        with patch("smtplib.SMTP") as mock_smtp_pin, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_PORT": "587"}):
            mock_smtp_pin.return_value.__enter__.return_value = MagicMock()
            email_service.send_reset_code("user@example.com", "123456")
            check("PIN recovery send_reset_code preserves 10s timeout", mock_smtp_pin.call_args[1].get("timeout") == 10)

        # Test failure detail distinction for read operation timeout (waiting_for_server_response)
        with patch("smtplib.SMTP") as mock_smtp_fail, \
             patch("app.services.email_service.logger.error") as mock_log_err, \
             patch.dict(os.environ, {"SMTP_USER": "test@memora.ai", "SMTP_PASS": "testpassword", "SMTP_PORT": "587"}):
            mock_server_fail = MagicMock()
            mock_smtp_fail.return_value.__enter__.return_value = mock_server_fail
            mock_server_fail.send_message.side_effect = RuntimeError("Connection unexpectedly closed: The read operation timed out")

            req = EmailShareRequest(file_ids=[f1.id], mode="originals", to_email="test@example.com")
            try:
                share_files_via_email(req, db=db)
            except HTTPException:
                pass

            logged_detail = False
            for call in mock_log_err.call_args_list:
                args = call[0]
                if len(args) >= 3 and args[2] == "waiting_for_server_response":
                    logged_detail = True
                    break
            check("Read timeout tagged as waiting_for_server_response", logged_detail)

        print("\n==================================================")
        print(f"TEST RESULTS: {passed} PASSED, {failed} FAILED")
        print("==================================================")

        assert failed == 0, f"{failed} test(s) failed."

    finally:
        try:
            db.query(File).filter(File.folder_id == test_folder.id).delete(synchronize_session=False)
            db.query(Folder).filter(Folder.id == test_folder.id).delete(synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()
        db.close()
        shutil.rmtree(test_dir, ignore_errors=True)


if __name__ == "__main__":
    run_tests()
