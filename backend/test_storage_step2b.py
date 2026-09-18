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
from app.services.image_optimizer import image_optimizer

def run_step2b_tests():
    print("==================================================")
    print("MEMORA AI — STORAGE OPTIMIZATION STEP 2B TESTS")
    print("==================================================")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    test_dir = tempfile.mkdtemp(prefix="memora_step2b_test_")
    print(f"Temporary test directory: {test_dir}")

    try:
        test_folder = Folder(path=test_dir, name="Step2BFolder")
        db.add(test_folder)
        db.commit()
        db.refresh(test_folder)

        def make_jpeg(filename, width=1600, height=1200, quality=98):
            fpath = os.path.join(test_dir, filename)
            img = Image.new("RGB", (width, height), color="green")
            for x in range(0, width, 30):
                for y in range(0, height, 30):
                    img.putpixel((x, y), ((x * 3) % 255, (y * 2) % 255, (x + y) % 255))
            img.save(fpath, "JPEG", quality=quality)
            fstat = os.stat(fpath)
            rec = File(
                folder_id=test_folder.id,
                path=fpath,
                name=filename,
                extension=".jpg",
                size=fstat.st_size,
                modified_at=datetime.fromtimestamp(fstat.st_mtime),
                file_hash=calculate_sha256(fpath),
                mime_type="image/jpeg",
                extraction_status="pending"
            )
            db.add(rec)
            db.commit()
            db.refresh(rec)
            return rec

        def make_png_rgba(filename, width=1200, height=800):
            fpath = os.path.join(test_dir, filename)
            img = Image.new("RGBA", (width, height), color=(255, 0, 0, 0)) # transparent background
            for x in range(100, width - 100):
                for y in range(100, height - 100):
                    img.putpixel((x, y), (x % 256, y % 256, (x * y) % 256, 150)) # varied semi-transparent pattern
            img.save(fpath, "PNG")
            fstat = os.stat(fpath)
            rec = File(
                folder_id=test_folder.id,
                path=fpath,
                name=filename,
                extension=".png",
                size=fstat.st_size,
                modified_at=datetime.fromtimestamp(fstat.st_mtime),
                file_hash=calculate_sha256(fpath),
                mime_type="image/png",
                extraction_status="pending"
            )
            db.add(rec)
            db.commit()
            db.refresh(rec)
            return rec

        def make_bmp(filename, width=800, height=600):
            fpath = os.path.join(test_dir, filename)
            img = Image.new("RGB", (width, height), color="orange")
            img.save(fpath, "BMP")
            fstat = os.stat(fpath)
            rec = File(
                folder_id=test_folder.id,
                path=fpath,
                name=filename,
                extension=".bmp",
                size=fstat.st_size,
                modified_at=datetime.fromtimestamp(fstat.st_mtime),
                file_hash=calculate_sha256(fpath),
                mime_type="image/bmp",
                extraction_status="pending"
            )
            db.add(rec)
            db.commit()
            db.refresh(rec)
            return rec

        # -------------------------------------------------------------
        # TEST 1: JPEG without max_dimension preserves dimensions
        # -------------------------------------------------------------
        print("\n[Test 1] Testing JPEG without max_dimension preserves dimensions...")
        j1 = make_jpeg("landscape_orig.jpg", width=1600, height=1200)
        cand1 = storage_service.create_optimization_candidate(db, j1.id, mode="lossy", lossy_quality=75)
        assert cand1["status"] == "optimized"
        assert cand1["original_dimensions"] == "1600x1200"
        assert cand1["candidate_dimensions"] == "1600x1200"
        print("  -> PASSED: Dimensions preserved as 1600x1200.")

        # -------------------------------------------------------------
        # TEST 2: JPEG with max_dimension reduces dimensions proportionally
        # -------------------------------------------------------------
        print("\n[Test 2] Testing JPEG with max_dimension downscaling...")
        # 1600x1200 with max_dimension=800 -> 800x600
        cand2 = storage_service.create_optimization_candidate(db, j1.id, mode="lossy", lossy_quality=75, max_dimension=800)
        assert cand2["status"] == "optimized"
        assert cand2["original_dimensions"] == "1600x1200"
        assert cand2["candidate_dimensions"] == "800x600"
        print("  -> PASSED: 1600x1200 scaled down proportionally to 800x600.")

        # -------------------------------------------------------------
        # TEST 3: Portrait image scales correctly
        # -------------------------------------------------------------
        print("\n[Test 3] Testing portrait image proportional scaling...")
        # Portrait: 900x1500 with max_dimension=500 -> 300x500
        j_port = make_jpeg("portrait.jpg", width=900, height=1500)
        cand_port = storage_service.create_optimization_candidate(db, j_port.id, mode="lossy", lossy_quality=75, max_dimension=500)
        assert cand_port["status"] == "optimized"
        assert cand_port["original_dimensions"] == "900x1500"
        assert cand_port["candidate_dimensions"] == "300x500"
        print("  -> PASSED: Portrait 900x1500 scaled correctly to 300x500.")

        # -------------------------------------------------------------
        # TEST 4: Smaller image is not upscaled
        # -------------------------------------------------------------
        print("\n[Test 4] Testing smaller image is NOT upscaled...")
        # 1000x800 with max_dimension=1500 -> remains 1000x800
        j_small = make_jpeg("small.jpg", width=1000, height=800)
        cand_small = storage_service.create_optimization_candidate(db, j_small.id, mode="lossy", lossy_quality=75, max_dimension=1500)
        assert cand_small["status"] == "optimized"
        assert cand_small["original_dimensions"] == "1000x800"
        assert cand_small["candidate_dimensions"] == "1000x800"
        print("  -> PASSED: 1000x800 not upscaled when max_dimension=1500.")

        # -------------------------------------------------------------
        # TEST 5: PNG with max_dimension preserves transparency
        # -------------------------------------------------------------
        print("\n[Test 5] Testing PNG transparency preservation with max_dimension...")
        p_rgba = make_png_rgba("transparent.png", width=1200, height=800)
        cand_png = storage_service.create_optimization_candidate(db, p_rgba.id, max_dimension=600)
        assert cand_png["status"] == "optimized"
        assert cand_png["original_dimensions"] == "1200x800"
        assert cand_png["candidate_dimensions"] == "600x400"

        # Apply candidate as copy and inspect transparency channel
        apply_png = storage_service.apply_optimization(db, p_rgba.id, cand_png["candidate_token"], replace_original=False)
        with Image.open(apply_png["final_path"]) as cand_img:
            assert cand_img.mode == "RGBA"
            assert cand_img.size == (600, 400)
            # Sample transparent corner (0, 0)
            pixel_corner = cand_img.getpixel((0, 0))
            assert pixel_corner[3] == 0, f"Alpha was lost: {pixel_corner}"
        print("  -> PASSED: PNG RGBA transparency preserved after Lanczos downsampling.")

        # -------------------------------------------------------------
        # TEST 6: BMP -> PNG with max_dimension
        # -------------------------------------------------------------
        print("\n[Test 6] Testing BMP -> PNG conversion with max_dimension...")
        bmp1 = make_bmp("chart.bmp", width=800, height=600)
        cand_bmp = storage_service.create_optimization_candidate(db, bmp1.id, max_dimension=400)
        assert cand_bmp["status"] == "optimized"
        assert cand_bmp["original_dimensions"] == "800x600"
        assert cand_bmp["candidate_dimensions"] == "400x300"

        apply_bmp = storage_service.apply_optimization(db, bmp1.id, cand_bmp["candidate_token"], replace_original=False)
        assert apply_bmp["is_format_conversion"] is True
        with Image.open(apply_bmp["final_path"]) as converted_img:
            assert converted_img.format == "PNG"
            assert converted_img.size == (400, 300)
        print("  -> PASSED: BMP converted to PNG with 400x300 dimensions.")

        # -------------------------------------------------------------
        # TEST 7: Original image remains unchanged
        # -------------------------------------------------------------
        print("\n[Test 7] Testing original files remain untouched...")
        orig_stat = os.stat(j1.path)
        assert orig_stat.st_size == j1.size
        assert calculate_sha256(j1.path) == j1.file_hash
        with Image.open(j1.path) as orig_img:
            assert orig_img.size == (1600, 1200)
        print("  -> PASSED: Original file 100% untouched.")

        # -------------------------------------------------------------
        # TEST 8: Dimension data returned correctly in API format
        # -------------------------------------------------------------
        print("\n[Test 8] Testing dimension response format...")
        assert isinstance(cand2["original_dimensions"], str)
        assert isinstance(cand2["candidate_dimensions"], str)
        assert "x" in cand2["original_dimensions"]
        assert "x" in cand2["candidate_dimensions"]
        print("  -> PASSED: Dimensions formatted as '<w>x<h>'.")

        # -------------------------------------------------------------
        # TEST 9: Existing Lossless JPEG behavior still works
        # -------------------------------------------------------------
        print("\n[Test 9] Testing existing lossless JPEG optimization...")
        j_lossless = make_jpeg("lossless_sample.jpg", width=1200, height=900)
        cand_ll = storage_service.create_optimization_candidate(db, j_lossless.id, mode="lossless")
        # In lossless mode without max_dimension, lossless Huffman strategy is used
        assert cand_ll["strategy_used"] == "jpeg_lossless_huffman_optimization"
        assert cand_ll["is_lossless"] is True
        assert cand_ll["candidate_dimensions"] == "1200x900"
        print("  -> PASSED: Lossless Huffman JPEG optimization intact.")

        # -------------------------------------------------------------
        # TEST 10: Step 2A Create New Copy still passes
        # -------------------------------------------------------------
        print("\n[Test 10] Testing Step 2A Create New Copy integration...")
        apply_copy = storage_service.apply_optimization(db, j1.id, cand2["candidate_token"], replace_original=False)
        assert apply_copy["status"] == "success"
        assert apply_copy["new_file_id"] is not None
        assert os.path.exists(j1.path)
        assert os.path.exists(apply_copy["final_path"])
        print("  -> PASSED: Step 2A Create New Copy completely functional.")

        print("\n==================================================")
        print("ALL STEP 2B FOCUSED TESTS PASSED SUCCESSFULLY!")
        print("==================================================")

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
    run_step2b_tests()
