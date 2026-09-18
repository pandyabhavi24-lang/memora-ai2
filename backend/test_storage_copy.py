import os
import sys
import shutil
import tempfile
from datetime import datetime
from PIL import Image

# Ensure backend package is in path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.database import SessionLocal, Base, engine
from app.models import Folder, File
from app.services.storage_service import storage_service, StorageServiceError, calculate_sha256

def run_focused_tests():
    print("==================================================")
    print("MEMORA AI — STORAGE OPTIMIZATION STEP 2A TESTS")
    print("==================================================")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    test_dir = tempfile.mkdtemp(prefix="memora_storage_test_")
    print(f"Temporary test directory: {test_dir}")

    try:
        # Create a test folder record
        test_folder = Folder(path=test_dir, name="TestFolder")
        db.add(test_folder)
        db.commit()
        db.refresh(test_folder)

        # -------------------------------------------------------------
        # Helper: create large compressible JPEG (approx 300-500 KB)
        # -------------------------------------------------------------
        def create_test_jpeg(filename):
            fpath = os.path.join(test_dir, filename)
            # Create colorful noise pattern image
            img = Image.new("RGB", (1200, 900), color="blue")
            for x in range(0, 1200, 20):
                for y in range(0, 900, 20):
                    img.putpixel((x, y), ((x * 2) % 255, (y * 3) % 255, (x + y) % 255))
            # Save unoptimized high quality
            img.save(fpath, "JPEG", quality=98)
            fstat = os.stat(fpath)
            fhash = calculate_sha256(fpath)

            file_rec = File(
                folder_id=test_folder.id,
                path=fpath,
                name=filename,
                extension=".jpg",
                size=fstat.st_size,
                modified_at=datetime.fromtimestamp(fstat.st_mtime),
                file_hash=fhash,
                mime_type="image/jpeg",
                extraction_status="pending"
            )
            db.add(file_rec)
            db.commit()
            db.refresh(file_rec)
            return file_rec

        # -------------------------------------------------------------
        # Helper: create uncompressed BMP
        # -------------------------------------------------------------
        def create_test_bmp(filename):
            fpath = os.path.join(test_dir, filename)
            img = Image.new("RGB", (400, 400), color="red")
            img.save(fpath, "BMP")
            fstat = os.stat(fpath)
            fhash = calculate_sha256(fpath)

            file_rec = File(
                folder_id=test_folder.id,
                path=fpath,
                name=filename,
                extension=".bmp",
                size=fstat.st_size,
                modified_at=datetime.fromtimestamp(fstat.st_mtime),
                file_hash=fhash,
                mime_type="image/bmp",
                extraction_status="pending"
            )
            db.add(file_rec)
            db.commit()
            db.refresh(file_rec)
            return file_rec

        # =============================================================
        # TEST 1: replace_original=False creates a new file & preserves original
        # TEST 2: original file remains unchanged (content, hash, size, DB record)
        # TEST 3: new file gets a new database ID with correct size/hash/mtime
        # =============================================================
        print("\n[Test 1, 2, 3] Testing replace_original=False (Create New Copy)...")
        f1 = create_test_jpeg("nature.jpg")
        orig_f1_path = f1.path
        orig_f1_size = f1.size
        orig_f1_hash = f1.file_hash
        orig_f1_mtime = f1.modified_at

        cand1 = storage_service.create_optimization_candidate(db, f1.id, mode="lossy", lossy_quality=75)
        assert cand1["status"] == "optimized", f"Candidate generation failed: {cand1}"
        token1 = cand1["candidate_token"]

        apply1 = storage_service.apply_optimization(db, f1.id, token1, replace_original=False)
        assert apply1["status"] == "success"
        assert apply1["new_file_id"] is not None
        assert apply1["new_file_id"] != f1.id
        assert apply1["final_path"] == os.path.join(test_dir, "nature_optimized.jpg")
        assert os.path.exists(orig_f1_path), "Original file must exist!"
        assert os.path.exists(apply1["final_path"]), "New copy must exist!"

        # Verify original physical file untouched
        assert os.path.getsize(orig_f1_path) == orig_f1_size, "Original physical size changed!"
        assert calculate_sha256(orig_f1_path) == orig_f1_hash, "Original physical hash changed!"

        # Verify original DB record untouched
        db.refresh(f1)
        assert f1.size == orig_f1_size
        assert f1.file_hash == orig_f1_hash
        assert f1.path == orig_f1_path

        # Verify new file DB record
        new_rec1 = db.query(File).filter(File.id == apply1["new_file_id"]).first()
        assert new_rec1 is not None
        assert new_rec1.name == "nature_optimized.jpg"
        assert new_rec1.folder_id == test_folder.id
        assert new_rec1.size == os.path.getsize(apply1["final_path"])
        assert new_rec1.file_hash == calculate_sha256(apply1["final_path"])
        assert new_rec1.extension == ".jpg"
        assert new_rec1.mime_type == "image/jpeg"
        print("  -> PASSED: New copy created with distinct DB record; original 100% untouched.")

        # =============================================================
        # TEST 4: Destination collision produces _optimized (1), (2), etc.
        # =============================================================
        print("\n[Test 4] Testing destination collision handling...")
        # Create candidate 2 for same f1
        cand2 = storage_service.create_optimization_candidate(db, f1.id, mode="lossy", lossy_quality=75)
        apply2 = storage_service.apply_optimization(db, f1.id, cand2["candidate_token"], replace_original=False)
        assert apply2["final_path"] == os.path.join(test_dir, "nature_optimized (1).jpg")
        assert os.path.exists(apply2["final_path"])

        # Create candidate 3 for same f1
        cand3 = storage_service.create_optimization_candidate(db, f1.id, mode="lossy", lossy_quality=75)
        apply3 = storage_service.apply_optimization(db, f1.id, cand3["candidate_token"], replace_original=False)
        assert apply3["final_path"] == os.path.join(test_dir, "nature_optimized (2).jpg")
        assert os.path.exists(apply3["final_path"])
        print("  -> PASSED: Sequential non-colliding names _optimized (1), (2) created safely.")

        # =============================================================
        # TEST 5: replace_original=True still behaves exactly as before
        # =============================================================
        print("\n[Test 5] Testing replace_original=True (Staged in-place replacement)...")
        f2 = create_test_jpeg("replace_me.jpg")
        f2_orig_path = f2.path
        f2_orig_size = f2.size

        cand_rep = storage_service.create_optimization_candidate(db, f2.id, mode="lossy", lossy_quality=75)
        apply_rep = storage_service.apply_optimization(db, f2.id, cand_rep["candidate_token"], replace_original=True)
        assert apply_rep["status"] == "success"
        assert apply_rep["new_file_id"] is None
        assert apply_rep["final_path"] == f2_orig_path

        db.refresh(f2)
        assert f2.size < f2_orig_size
        assert f2.file_hash == calculate_sha256(f2_orig_path)
        print("  -> PASSED: replace_original=True updated existing file and DB record in place.")

        # =============================================================
        # TEST 6: BMP -> PNG with replace_original=False creates new PNG file identity
        # =============================================================
        print("\n[Test 6] Testing BMP -> PNG conversion with replace_original=False...")
        fbmp = create_test_bmp("sample_graphic.bmp")
        bmp_orig_path = fbmp.path
        bmp_orig_size = fbmp.size

        cand_bmp = storage_service.create_optimization_candidate(db, fbmp.id)
        assert cand_bmp["status"] == "optimized"

        apply_bmp = storage_service.apply_optimization(db, fbmp.id, cand_bmp["candidate_token"], replace_original=False)
        assert apply_bmp["status"] == "success"
        assert apply_bmp["is_format_conversion"] is True
        assert apply_bmp["final_path"] == os.path.join(test_dir, "sample_graphic_optimized.png")

        # Original BMP must remain on disk and in DB
        assert os.path.exists(bmp_orig_path)
        db.refresh(fbmp)
        assert fbmp.extension == ".bmp"
        assert fbmp.mime_type == "image/bmp"

        # New PNG record must exist with image/png mime
        new_png_rec = db.query(File).filter(File.id == apply_bmp["new_file_id"]).first()
        assert new_png_rec is not None
        assert new_png_rec.extension == ".png"
        assert new_png_rec.mime_type == "image/png"
        print("  -> PASSED: BMP preserved; new optimized PNG created with valid PNG identity.")

        # =============================================================
        # TEST 7: Missing candidate token / expired candidate fails safely
        # =============================================================
        print("\n[Test 7] Testing invalid/missing candidate token...")
        try:
            storage_service.apply_optimization(db, f1.id, "cand_nonexistent_token", replace_original=False)
            assert False, "Should have raised StorageServiceError"
        except StorageServiceError as e:
            assert "Invalid or expired" in str(e)
            print("  -> PASSED: Invalid candidate token rejected cleanly.")

        # =============================================================
        # TEST 8: Modified source file before apply fails safely
        # =============================================================
        print("\n[Test 8] Testing source tamper detection...")
        f_tamper = create_test_jpeg("tamper_test.jpg")
        cand_t = storage_service.create_optimization_candidate(db, f_tamper.id, mode="lossy", lossy_quality=75)
        # Tamper with the source file
        with open(f_tamper.path, "ab") as f:
            f.write(b"EXTRABYTES")
        try:
            storage_service.apply_optimization(db, f_tamper.id, cand_t["candidate_token"], replace_original=False)
            assert False, "Should have detected source modification"
        except StorageServiceError as e:
            assert "modified after" in str(e)
            print("  -> PASSED: Source modification detected; apply aborted safely.")

        # =============================================================
        # TEST 9: Temporary candidate files are cleaned up
        # =============================================================
        print("\n[Test 9] Testing candidate temp cleanup...")
        tmp_files = [f for f in os.listdir(test_dir) if f.endswith(".tmp") or ".cand_" in f]
        assert len(tmp_files) == 0, f"Found orphan temp files: {tmp_files}"
        print("  -> PASSED: Zero orphan candidate temporary files left on disk.")

        # =============================================================
        # TEST 10: Database failure does not damage original
        # =============================================================
        print("\n[Test 10] Testing database failure handling during create copy...")
        f_db_fail = create_test_jpeg("db_fail_test.jpg")
        f_db_orig_size = f_db_fail.size
        f_db_orig_hash = f_db_fail.file_hash
        cand_db = storage_service.create_optimization_candidate(db, f_db_fail.id, mode="lossy", lossy_quality=75)

        # Mock db.add to raise an exception simulating DB transaction failure
        original_db_add = db.add
        def failing_db_add(item):
            raise RuntimeError("Simulated Database Disk Error")
        db.add = failing_db_add

        try:
            storage_service.apply_optimization(db, f_db_fail.id, cand_db["candidate_token"], replace_original=False)
            assert False, "Should have raised StorageServiceError on DB failure"
        except StorageServiceError as e:
            assert "Database registration failed" in str(e) or "Simulated" in str(e)
            print("  -> PASSED: DB failure safely handled with error.")
        finally:
            db.add = original_db_add

        # Verify original file untouched
        assert os.path.exists(f_db_fail.path)
        assert os.path.getsize(f_db_fail.path) == f_db_orig_size
        assert calculate_sha256(f_db_fail.path) == f_db_orig_hash
        # Verify no orphan copy left on disk
        assert not os.path.exists(os.path.join(test_dir, "db_fail_test_optimized.jpg"))
        print("  -> PASSED: Original file 100% untouched after DB failure, copy cleaned up.")


        print("\n==================================================")
        print("ALL 9 FOCUSED TESTS PASSED SUCCESSFULLY!")
        print("==================================================")

    finally:
        # Clean up database records created for test
        try:
            db.query(File).filter(File.folder_id == test_folder.id).delete(synchronize_session=False)
            db.query(Folder).filter(Folder.id == test_folder.id).delete(synchronize_session=False)
            db.commit()
        except Exception:
            db.rollback()
        db.close()

        # Clean up disk
        shutil.rmtree(test_dir, ignore_errors=True)

if __name__ == "__main__":
    run_focused_tests()
