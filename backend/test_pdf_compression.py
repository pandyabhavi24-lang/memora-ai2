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
from app.services.pdf_optimizer import pdf_optimizer
import pypdf

def run_pdf_compression_tests():
    print("==================================================")
    print("MEMORA AI — PDF COMPRESSION & COMPARISON TESTS")
    print("==================================================")

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    test_dir = tempfile.mkdtemp(prefix="memora_pdf_test_")
    print(f"Temporary test directory: {test_dir}")

    try:
        test_folder = Folder(path=test_dir, name="PdfTestFolder")
        db.add(test_folder)
        db.commit()
        db.refresh(test_folder)

        # Helper: Create a realistic large PDF containing high-resolution embedded images
        def make_large_pdf(filename, img_width=1600, img_height=1200):
            fpath = os.path.join(test_dir, filename)
            
            # Generate high-res image
            im1 = Image.new("RGB", (img_width, img_height), color=(140, 180, 220))
            for x in range(0, img_width, 15):
                for y in range(0, img_height, 15):
                    im1.putpixel((x, y), ((x * 4) % 255, (y * 3) % 255, (x + y) % 255))
            
            im2 = Image.new("RGB", (img_width, img_height), color=(220, 160, 140))
            for x in range(0, img_width, 20):
                for y in range(0, img_height, 20):
                    im2.putpixel((x, y), ((x * 5) % 255, (y * 2) % 255, (x * y) % 255))
            
            # Save 2-page PDF
            im1.save(fpath, "PDF", save_all=True, append_images=[im2], resolution=200.0)

            fstat = os.stat(fpath)
            rec = File(
                folder_id=test_folder.id,
                path=fpath,
                name=filename,
                extension=".pdf",
                size=fstat.st_size,
                modified_at=datetime.fromtimestamp(fstat.st_mtime),
                file_hash=calculate_sha256(fpath),
                mime_type="application/pdf",
                extraction_status="pending"
            )
            db.add(rec)
            db.commit()
            db.refresh(rec)
            return rec

        pdf_file = make_large_pdf("sample_large.pdf", 1600, 1200)
        orig_size = pdf_file.size
        print(f"Created large test PDF: {orig_size} bytes ({orig_size / 1024:.1f} KB)")

        # Test 1: Generate Balanced Lossy Candidate (Quality 75, max_dimension 1280)
        print("\n[Test 1] Testing PDF Candidate Generation (Lossy 75 + downsampling)...")
        cand_res = storage_service.create_optimization_candidate(
            db=db,
            file_id=pdf_file.id,
            mode="lossy",
            pdf_image_quality=75,
            max_dimension=1280
        )

        assert cand_res["status"] == "optimized", f"Expected 'optimized', got {cand_res['status']}"
        cand_size = cand_res["candidate_size"]
        pct_saved = cand_res["percentage_saved"]
        token = cand_res["candidate_token"]

        print(f"  -> Candidate size: {cand_size} bytes ({cand_size / 1024:.1f} KB)")
        print(f"  -> Bytes saved: {cand_res['bytes_saved']} ({pct_saved}%)")
        print(f"  -> Strategy: {cand_res['strategy_used']}")
        print(f"  -> Images found: {cand_res.get('images_count')}, optimized: {cand_res.get('images_optimized')}")
        print(f"  -> Pages: {cand_res.get('page_count')}")

        assert cand_size < orig_size, "Candidate must be smaller than original"
        assert pct_saved > 20.0, f"Expected substantial compression, got {pct_saved}%"
        assert cand_res.get("page_count") == 2, f"Expected 2 pages, got {cand_res.get('page_count')}"
        print("  -> PASSED: High-compression PDF candidate generated with significant size reduction!")

        # Test 2: Verify Candidate Record & Preview File Retrieval
        print("\n[Test 2] Testing Candidate Record lookup for Preview...")
        rec = storage_service.get_candidate_record(token)
        assert rec is not None, "Candidate record should exist in registry"
        assert os.path.exists(rec.candidate_path), "Candidate file must exist on disk"
        assert os.path.exists(rec.source_path), "Source file must exist on disk"
        print("  -> PASSED: Candidate record and files verified for comparison viewer.")

        # Test 3: Apply Optimization with replace_original=False (Make a Copy)
        print("\n[Test 3] Testing apply_optimization with replace_original=False (Make a Copy)...")
        apply_copy_res = storage_service.apply_optimization(
            db=db,
            file_id=pdf_file.id,
            candidate_token=token,
            replace_original=False
        )

        assert apply_copy_res["status"] == "success"
        copy_file_id = apply_copy_res["new_file_id"]
        assert copy_file_id is not None
        copy_rec = db.query(File).filter(File.id == copy_file_id).first()
        assert copy_rec is not None
        assert os.path.exists(copy_rec.path)
        assert copy_rec.name.endswith("_optimized.pdf")
        assert os.path.getsize(pdf_file.path) == orig_size, "Original file must be untouched"
        print(f"  -> PASSED: Created copy at '{copy_rec.name}', original preserved intact.")

        # Test 4: Verify Candidate PDF integrity using pypdf reader
        print("\n[Test 4] Verifying generated optimized PDF structural integrity...")
        reader = pypdf.PdfReader(copy_rec.path)
        assert len(reader.pages) == 2, "Page count must match original"
        for p in reader.pages:
            assert p.mediabox is not None
            assert float(p.mediabox.width) > 0
        print("  -> PASSED: PDF structure, pages, and mediaboxes 100% verified.")

        # Test 5: In-place Replacement (replace_original=True)
        print("\n[Test 5] Testing PDF Candidate Generation & In-place Replacement...")
        pdf_file2 = make_large_pdf("sample_replace.pdf", 1400, 1000)
        orig2_size = pdf_file2.size

        cand2 = storage_service.create_optimization_candidate(
            db=db,
            file_id=pdf_file2.id,
            mode="lossy",
            pdf_image_quality=70,
            max_dimension=1000
        )
        assert cand2["status"] == "optimized"

        apply_rep = storage_service.apply_optimization(
            db=db,
            file_id=pdf_file2.id,
            candidate_token=cand2["candidate_token"],
            replace_original=True
        )
        assert apply_rep["status"] == "success"
        assert os.path.getsize(pdf_file2.path) == apply_rep["final_size_bytes"]
        assert apply_rep["final_size_bytes"] < orig2_size
        print(f"  -> PASSED: In-place replacement updated file from {orig2_size} to {apply_rep['final_size_bytes']} bytes.")

        print("\n==================================================")
        print("ALL PDF COMPRESSION & COMPARISON TESTS PASSED!")
        print("==================================================")

    finally:
        db.close()
        shutil.rmtree(test_dir, ignore_errors=True)

if __name__ == "__main__":
    run_pdf_compression_tests()
