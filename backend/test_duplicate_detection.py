import os
import sys
import shutil
import tempfile
from datetime import datetime
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app
from app.database import SessionLocal, init_db_schema
from app.models import Base, Folder, File, DuplicateGroup
from app.services.duplicate_service import (
    duplicate_service,
    normalize_extracted_text,
    calculate_lexical_similarity,
    calculate_semantic_similarity,
    compare_file_pair
)
from app.services.scanner import calculate_sha256

client = TestClient(app)


def test_suite_duplicate_detection():
    print("\n==================================================")
    print("STARTING TEST SUITE: DUPLICATE DETECTION & SIMILARITY")
    print("==================================================")

    temp_test_dir = os.path.join(backend_dir, "sample_documents_dup_test")
    os.makedirs(temp_test_dir, exist_ok=True)
    test_folder = None
    file_db_a = None
    file_db_b = None
    file_db_c = None
    file_db_d = None
    db = SessionLocal()

    try:
        init_db_schema()

        # -------------------------------------------------------------
        # TEST 1: Two byte-for-byte identical PDFs -> 100%, Exact duplicate
        # -------------------------------------------------------------
        print("\n[TEST 1] Two byte-for-byte identical PDFs...")
        pdf1_path = os.path.join(temp_test_dir, "doc1.pdf")
        pdf2_path = os.path.join(temp_test_dir, "doc1_copy.pdf")
        
        content_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n"
        with open(pdf1_path, "wb") as f:
            f.write(content_bytes)
        with open(pdf2_path, "wb") as f:
            f.write(content_bytes)

        hash1 = calculate_sha256(pdf1_path)
        hash2 = calculate_sha256(pdf2_path)
        assert hash1 == hash2

        file1 = File(name="doc1.pdf", path=pdf1_path, file_hash=hash1, size=len(content_bytes), extracted_text="Quarterly Financial Report Q1 2026")
        file2 = File(name="doc1_copy.pdf", path=pdf2_path, file_hash=hash2, size=len(content_bytes), extracted_text="Quarterly Financial Report Q1 2026")
        
        comp1 = compare_file_pair(
            file_a=file1, file_b=file2,
            norm_a=normalize_extracted_text(file1.extracted_text),
            norm_b=normalize_extracted_text(file2.extracted_text),
            vec_a=None, vec_b=None
        )
        assert comp1 is not None
        assert comp1["detection_type"] == "Exact duplicate"
        assert comp1["similarity"] == 100.0
        assert comp1["is_hash_match"] is True
        print(f"  PASS: {comp1['detection_type']} - {comp1['similarity']}% (Hash Match: {comp1['is_hash_match']})")

        # -------------------------------------------------------------
        # TEST 2: Two different PDF files with identical extracted text
        # -> Identical text content, not byte-identical
        # -------------------------------------------------------------
        print("\n[TEST 2] Two different PDF files with identical extracted text...")
        pdf3_path = os.path.join(temp_test_dir, "doc_v1.pdf")
        pdf4_path = os.path.join(temp_test_dir, "doc_v2_resaved.pdf")

        with open(pdf3_path, "wb") as f:
            f.write(content_bytes + b"\n% Creator: Software A\n")
        with open(pdf4_path, "wb") as f:
            f.write(content_bytes + b"\n% Creator: Software B (Modified)\n")

        hash3 = calculate_sha256(pdf3_path)
        hash4 = calculate_sha256(pdf4_path)
        assert hash3 != hash4

        common_text = "Comprehensive Employee Handbook for Year 2026. All company workplace policies apply."
        file3 = File(name="doc_v1.pdf", path=pdf3_path, file_hash=hash3, size=len(content_bytes) + 20, extracted_text=common_text)
        file4 = File(name="doc_v2_resaved.pdf", path=pdf4_path, file_hash=hash4, size=len(content_bytes) + 30, extracted_text=common_text)

        comp2 = compare_file_pair(
            file_a=file3, file_b=file4,
            norm_a=normalize_extracted_text(file3.extracted_text),
            norm_b=normalize_extracted_text(file4.extracted_text),
            vec_a=None, vec_b=None
        )
        assert comp2 is not None
        assert comp2["detection_type"] == "Identical text content"
        assert comp2["similarity"] == 99.0
        assert comp2["is_hash_match"] is False
        assert comp2["is_text_match"] is True
        print(f"  PASS: {comp2['detection_type']} - {comp2['similarity']}% (Hash Match: {comp2['is_hash_match']}, Text Match: {comp2['is_text_match']})")

        # -------------------------------------------------------------
        # TEST 3: Two PDFs with completely different meaningful text
        # -> Must not be marked as an exact duplicate (None / below threshold)
        # -------------------------------------------------------------
        print("\n[TEST 3] Two PDFs with completely different meaningful text...")
        text_work = "this my work page, this is my photo and video collection page"
        text_hobby = "hello this my hobbi page, this my song collection page"

        file_work = File(name="Module2_New_Report_f9c602.pdf", path="dummy1.pdf", file_hash="hash_a", size=18000, extracted_text=text_work)
        file_hobby = File(name="Module2_Course_Report_Copy.pdf", path="dummy2.pdf", file_hash="hash_b", size=19000, extracted_text=text_hobby)

        comp3 = compare_file_pair(
            file_a=file_work, file_b=file_hobby,
            norm_a=normalize_extracted_text(text_work),
            norm_b=normalize_extracted_text(text_hobby),
            vec_a=None, vec_b=None
        )
        assert comp3 is None  # Below 70% threshold!
        print("  PASS: Files with distinct contents correctly rejected from duplicate candidates (Score < 70%).")

        # -------------------------------------------------------------
        # TEST 4: Two PDFs with partially shared content -> Intermediate score
        # -------------------------------------------------------------
        print("\n[TEST 4] Two PDFs with partially shared content...")
        shared_prefix = "International Standard for Software Testing, Verification and Quality Assurance Architecture. "
        text_a = shared_prefix + "Chapter 1 introduces dynamic testing methodologies and code coverage matrices."
        text_b = shared_prefix + "Chapter 1 introduces static code analysis techniques and coverage metrics."

        file_pa = File(name="spec_v1.pdf", path="p1.pdf", file_hash="h1", size=1000, extracted_text=text_a)
        file_pb = File(name="spec_v2.pdf", path="p2.pdf", file_hash="h2", size=1000, extracted_text=text_b)

        comp4 = compare_file_pair(
            file_a=file_pa, file_b=file_pb,
            norm_a=normalize_extracted_text(text_a),
            norm_b=normalize_extracted_text(text_b),
            vec_a=None, vec_b=None
        )
        assert comp4 is not None
        assert comp4["detection_type"] in ["Highly similar", "Similar content"]
        assert 70.0 <= comp4["similarity"] < 100.0
        assert comp4["is_hash_match"] is False
        print(f"  PASS: Intermediate similarity scored at {comp4['similarity']}% ({comp4['detection_type']}).")

        # -------------------------------------------------------------
        # TEST 5: PDFs with similar filenames but unrelated content
        # -> Must NOT be marked as exact duplicates or 100%
        # -------------------------------------------------------------
        print("\n[TEST 5] PDFs with similar filenames but unrelated content...")
        file_fn1 = File(name="Annual_Report_2025_Final.pdf", path="f1.pdf", file_hash="ha", size=5000, extracted_text="Astronomy astrophysics stars and planetary galaxies nebula telescope.")
        file_fn2 = File(name="Annual_Report_2025_Final_v2.pdf", path="f2.pdf", file_hash="hb", size=5000, extracted_text="Culinary recipes baking sourdough bread and Italian pasta ingredients.")

        comp5 = compare_file_pair(
            file_a=file_fn1, file_b=file_fn2,
            norm_a=normalize_extracted_text(file_fn1.extracted_text),
            norm_b=normalize_extracted_text(file_fn2.extracted_text),
            vec_a=None, vec_b=None
        )
        assert comp5 is None
        print("  PASS: Filename similarity alone does not trigger duplicate detection on unrelated content.")

        # -------------------------------------------------------------
        # TEST 6: PDFs with different metadata but identical visible content
        # -------------------------------------------------------------
        print("\n[TEST 6] PDFs with different metadata but identical visible text...")
        text_id = "Memorandum of Understanding between University Department and Research Institute on AI Research."
        file_meta1 = File(name="mou_scan.pdf", path="m1.pdf", file_hash="meta_h1", size=12000, extracted_text=text_id)
        file_meta2 = File(name="mou_signed.pdf", path="m2.pdf", file_hash="meta_h2", size=13500, extracted_text=text_id)

        comp6 = compare_file_pair(
            file_a=file_meta1, file_b=file_meta2,
            norm_a=normalize_extracted_text(text_id),
            norm_b=normalize_extracted_text(text_id),
            vec_a=None, vec_b=None
        )
        assert comp6 is not None
        assert comp6["detection_type"] == "Identical text content"
        assert comp6["similarity"] == 99.0
        assert comp6["is_hash_match"] is False
        assert comp6["is_text_match"] is True
        print(f"  PASS: Correctly classified as {comp6['detection_type']} (99%).")

        # -------------------------------------------------------------
        # TEST 7: Unreadable / empty text PDF -> Never silently 100%
        # -------------------------------------------------------------
        print("\n[TEST 7] Unreadable or image-only PDF without hash match...")
        file_empty1 = File(name="empty1.pdf", path="e1.pdf", file_hash="h_empty1", size=1000, extracted_text="")
        file_empty2 = File(name="empty2.pdf", path="e2.pdf", file_hash="h_empty2", size=2000, extracted_text=None)

        comp7 = compare_file_pair(
            file_a=file_empty1, file_b=file_empty2,
            norm_a="", norm_b="",
            vec_a=None, vec_b=None
        )
        assert comp7 is None
        print("  PASS: Unreadable files with different hashes safely rejected (never returns 100%).")

        # -------------------------------------------------------------
        # TEST 8: File modified after previous scan -> Stale result invalidated
        # -------------------------------------------------------------
        print("\n[TEST 8] File modified after previous scan -> Stale result invalidated...")
        # Create a folder in DB for testing sync
        test_folder = Folder(path=temp_test_dir, name="TempTestFolder", is_active=True)
        db.add(test_folder)
        db.commit()

        # Step 8a: Create initial identical pair
        now = datetime.utcnow()
        file_db_a = File(folder_id=test_folder.id, name="sync_doc_a.pdf", extension=".pdf", path=pdf1_path, file_hash=hash1, size=len(content_bytes), extracted_text="Initial text content identical in both documents.", modified_at=now)
        file_db_b = File(folder_id=test_folder.id, name="sync_doc_b.pdf", extension=".pdf", path=pdf2_path, file_hash=hash1, size=len(content_bytes), extracted_text="Initial text content identical in both documents.", modified_at=now)
        db.add_all([file_db_a, file_db_b])
        db.commit()

        groups_init = duplicate_service.find_and_record_duplicates(db)
        found_exact = any(
            ((g.file_a_id == file_db_a.id and g.file_b_id == file_db_b.id) or
             (g.file_a_id == file_db_b.id and g.file_b_id == file_db_a.id))
            and g.detection_type == "Exact duplicate"
            for g in groups_init
        )
        assert found_exact is True
        print("  Step 8a: Initially detected as Exact duplicate (100%).")

        # Step 8b: Modify file B on disk and in DB to completely different content
        with open(pdf2_path, "wb") as f:
            f.write(b"Completely different modified content for Document B!")
        new_hash_b = calculate_sha256(pdf2_path)
        file_db_b.file_hash = new_hash_b
        file_db_b.extracted_text = "Completely different text in document B about biology and ecosystems."
        db.commit()

        # Step 8c: Re-run duplicate detection -> Must invalidate and delete the stale duplicate group!
        groups_after = duplicate_service.find_and_record_duplicates(db)
        pair_still_present = any(
            (g.file_a_id == file_db_a.id and g.file_b_id == file_db_b.id) or
            (g.file_a_id == file_db_b.id and g.file_b_id == file_db_a.id)
            for g in groups_after
        )
        assert pair_still_present is False
        print("  Step 8b & 8c: PASS - Stale duplicate group successfully invalidated and deleted upon file modification!")

        # -------------------------------------------------------------
        # TEST 9: Missing or invalid score handling
        # -------------------------------------------------------------
        print("\n[TEST 9] Missing or invalid score handling...")
        # Normalization safety
        assert normalize_extracted_text(None) == ""
        assert normalize_extracted_text(12345) == ""
        assert calculate_lexical_similarity("", "") == 0.0
        assert calculate_semantic_similarity("", "", None, None) == 0.0
        print("  PASS: None/invalid values safely handled without exceptions.")

        # -------------------------------------------------------------
        # TEST 10: Two pairs of files with different scores retain distinct scores
        # -------------------------------------------------------------
        print("\n[TEST 10] Multiple pairs retain their own correct individual scores...")
        # Pair 1: Exact duplicate
        # Pair 2: Similar content
        text_p3 = "Advanced Machine Learning Algorithms and Neural Network Architectures. This comprehensive overview covers supervised learning, gradient descent optimization, convolutional networks, deep neural nets and transformers architecture with self-attention."
        text_p4 = "Advanced Machine Learning Concepts and Neural Network Architectures. This comprehensive overview covers supervised learning, gradient descent optimization, convolutional networks, deep neural nets and recurrent sequence models with transformers."
        ml_a_path = os.path.join(temp_test_dir, "ml_a.pdf")
        ml_b_path = os.path.join(temp_test_dir, "ml_b.pdf")
        with open(ml_a_path, "wb") as f:
            f.write(content_bytes + b"\n% ML Model Architecture A\n")
        with open(ml_b_path, "wb") as f:
            f.write(content_bytes + b"\n% ML Model Concepts B\n")
        hash_mla = calculate_sha256(ml_a_path)
        hash_mlb = calculate_sha256(ml_b_path)

        file_db_c = File(folder_id=test_folder.id, name="ml_a.pdf", extension=".pdf", path=ml_a_path, file_hash=hash_mla, size=len(content_bytes)+25, extracted_text=text_p3, modified_at=datetime.utcnow())
        file_db_d = File(folder_id=test_folder.id, name="ml_b.pdf", extension=".pdf", path=ml_b_path, file_hash=hash_mlb, size=len(content_bytes)+25, extracted_text=text_p4, modified_at=datetime.utcnow())
        
        # Reset file_db_b back to exact duplicate of file_db_a on disk and DB
        with open(pdf2_path, "wb") as f:
            f.write(content_bytes)
        file_db_b.file_hash = hash1
        file_db_b.extracted_text = "Initial text content identical in both documents."
        
        db.add_all([file_db_c, file_db_d])
        db.commit()

        groups_multi = duplicate_service.find_and_record_duplicates(db)
        pair_exact = next((g for g in groups_multi if (
            (g.file_a_id == file_db_a.id and g.file_b_id == file_db_b.id) or
            (g.file_a_id == file_db_b.id and g.file_b_id == file_db_a.id)
        )), None)
        pair_sim = next((g for g in groups_multi if (
            (g.file_a_id == file_db_c.id and g.file_b_id == file_db_d.id) or
            (g.file_a_id == file_db_d.id and g.file_b_id == file_db_c.id)
        )), None)

        assert pair_exact is not None
        assert pair_exact.similarity == 100.0
        assert pair_exact.detection_type == "Exact duplicate"

        assert pair_sim is not None
        assert pair_sim.similarity < 100.0
        assert pair_sim.detection_type in ["Highly similar", "Similar content"]

        print(f"  PASS: Pair 1 retained {pair_exact.similarity}% ({pair_exact.detection_type}) while Pair 2 retained {pair_sim.similarity}% ({pair_sim.detection_type}).")

        # -------------------------------------------------------------
        # ENDPOINT INTEGRATION TEST: GET /api/organization/duplicates
        # -------------------------------------------------------------
        print("\n[INTEGRATION] Testing GET /api/organization/duplicates response schema...")
        res = client.get("/api/organization/duplicates")
        assert res.status_code == 200
        items = res.json()
        assert isinstance(items, list)
        for item in items:
            assert "id" in item
            assert "fileA" in item
            assert "fileB" in item
            assert "similarity" in item
            assert "detectionType" in item
            assert "status" in item
            assert "is_hash_match" in item
            assert "is_text_match" in item
            assert "reason" in item
        print(f"  PASS: API endpoint successfully returned {len(items)} verified duplicate groups with explainability metadata.")

    finally:
        # Cleanup only test entities
        try:
            test_file_ids = []
            for f in [file_db_a, file_db_b, file_db_c, file_db_d]:
                if hasattr(f, 'id') and f.id:
                    test_file_ids.append(f.id)
            if test_file_ids:
                db.query(DuplicateGroup).filter(
                    (DuplicateGroup.file_a_id.in_(test_file_ids)) | (DuplicateGroup.file_b_id.in_(test_file_ids))
                ).delete(synchronize_session=False)
                db.query(File).filter(File.id.in_(test_file_ids)).delete(synchronize_session=False)
            if hasattr(test_folder, 'id') and test_folder.id:
                db.query(Folder).filter(Folder.id == test_folder.id).delete(synchronize_session=False)
            db.commit()
            # Resync real files
            duplicate_service.find_and_record_duplicates(db)
            db.close()
        except Exception as e:
            print("Cleanup warning:", e)
        if os.path.exists(temp_test_dir):
            shutil.rmtree(temp_test_dir, ignore_errors=True)

    print("\n==================================================")
    print("ALL 10 TESTS & INTEGRATION PASSED SUCCESSFULLY!")
    print("==================================================")


if __name__ == "__main__":
    test_suite_duplicate_detection()
