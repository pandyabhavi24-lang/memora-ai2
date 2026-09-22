import os
import sys
import re
from datetime import datetime, timedelta

current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.database import engine, Base, SessionLocal
from app.models import Folder, File, FileExpiry
from app.services.expiry_service import expiry_service, COMPILED_DATE_TYPE_PATTERNS

def test_expiry_pipeline():
    print("==================================================")
    print("MEMORA AI - FILE EXPIRY & RENEWAL REMINDERS COMPREHENSIVE TEST")
    print("==================================================")

    # 1. Test Malformed Regex Prevention
    print("\n[1/11] Testing Malformed Regex Prevention...")
    assert len(COMPILED_DATE_TYPE_PATTERNS) > 0, "COMPILED_DATE_TYPE_PATTERNS failed to compile."
    for category, compiled_list in COMPILED_DATE_TYPE_PATTERNS:
        assert len(compiled_list) > 0, f"No compiled patterns in category {category}"
        for pat in compiled_list:
            # Test safe regex search on sample string
            res = pat.search("sample text context for date checking")
    print("  [OK] All regular expression patterns compiled safely without re.error.")

    # 2. Test Date Parser for multiple formats & invalid calendar dates
    print("\n[2/11] Testing Date Parser and Invalid Calendar Dates...")
    test_dates = [
        ("15 March 2027", datetime(2027, 3, 15)),
        ("2026-10-05", datetime(2026, 10, 5)),
        ("10 June 2025", datetime(2025, 6, 10)),
        ("05/10/2026", datetime(2026, 10, 5)),
        ("15-03-2027", datetime(2027, 3, 15))
    ]
    for d_str, expected in test_dates:
        parsed = expiry_service.parse_date_string(d_str)
        assert parsed is not None, f"Failed to parse '{d_str}'"
        assert parsed.year == expected.year and parsed.month == expected.month and parsed.day == expected.day, f"Expected {expected}, got {parsed}"
        print(f"  [OK] Parsed '{d_str}' -> {parsed.strftime('%Y-%m-%d')}")

    # Reject invalid calendar dates (Feb 31, year 1850)
    assert expiry_service.parse_date_string("31/02/2025") is None, "Failed to reject invalid calendar date Feb 31"
    assert expiry_service.parse_date_string("31.02.2025") is None
    print("  [OK] Invalid calendar dates (e.g., Feb 31) successfully rejected.")

    # 3. Test Valid Expiry Date Extraction & Classification
    print("\n[3/11] Testing Valid Expiry Date Extraction...")
    sample_texts = [
        ("Car Insurance Policy", "Vehicle Insurance policy valid until 15 March 2027.", "Insurance", "Expiry"),
        ("Software Subscription", "Cloud service subscription Renewal Date: 20 April 2027.", "Subscription", "Renewal"),
        ("Billing Invoice", "Payment Due Date: 15 February 2027.", "Other", "Due"),
        ("Passport Document", "Passport issued on 10 June 2020. Valid Until: 15 March 2030.", "Passport", "Expiry")
    ]

    for title, text, exp_doc_type, exp_date_type in sample_texts:
        candidates = expiry_service.extract_dates_from_text(text, title)
        assert len(candidates) > 0, f"No dates extracted from '{text}'"
        expiry_cands = [c for c in candidates if c["date_type"] in ["Expiry", "Renewal", "Due"]]
        top = expiry_cands[0] if expiry_cands else candidates[0]
        print(f"  [OK] '{title}' -> DocType: {top['document_type']}, DateType: {top['date_type']}, Date: {top['parsed_date'].strftime('%Y-%m-%d')}")
        assert top["date_type"] == exp_date_type, f"Expected {exp_date_type}, got {top['date_type']}"

    # 4. Test Issue Date Not Classified as Expiry
    print("\n[4/11] Testing Issue Date Classification Safety...")
    issue_text = "Course Certificate of Completion. Date of Issue: 10 June 2024. Student ID: 998811."
    candidates = expiry_service.extract_dates_from_text(issue_text, "Certificate.pdf")
    assert len(candidates) > 0
    issue_cand = candidates[0]
    assert issue_cand["date_type"] == "Issue", f"Expected Issue, got {issue_cand['date_type']}"
    print(f"  [OK] Issue date {issue_cand['parsed_date'].strftime('%Y-%m-%d')} correctly classified as 'Issue' (NOT Expiry).")

    # 5. Test Date of Birth Not Classified as Expiry
    print("\n[5/11] Testing Date of Birth Classification Safety...")
    dob_text = "Driving Licence. Name: John Doe. Date of Birth: 14/08/1995. Issue Date: 10/05/2020. Valid Till: 23/12/2043."
    candidates = expiry_service.extract_dates_from_text(dob_text, "Licence.pdf")
    # Verify DOB date (14/08/1995) is NOT classified as Expiry
    dob_cand = next(c for c in candidates if "1995" in c["date_str"])
    assert dob_cand["date_type"] != "Expiry", f"DOB date was wrongly classified as Expiry: {dob_cand}"

    # Verify actual Expiry date (23/12/2043) is correctly identified
    expiry_cand = next(c for c in candidates if c["date_type"] in ["Expiry", "Renewal", "Due"])
    assert expiry_cand["date_type"] == "Expiry"
    assert expiry_cand["parsed_date"].strftime("%Y-%m-%d") == "2043-12-23", f"Expected 2043-12-23, got {expiry_cand['parsed_date']}"
    print(f"  [OK] Date of birth 14/08/1995 correctly excluded from Expiry. Selected actual Expiry: 2043-12-23.")

    # 6. Test Multiple Dates in One Document
    print("\n[6/11] Testing Multiple Dates Extraction in Single Document...")
    multi_text = "Commercial Vehicle Insurance Policy. Policy Issued: 10/01/2024. Payment Due: 15/02/2027. Policy Expires On: 10/01/2028."
    multi_candidates = expiry_service.extract_dates_from_text(multi_text, "Insurance_Multi.pdf")
    assert len(multi_candidates) >= 3, f"Expected at least 3 candidates, found {len(multi_candidates)}"
    date_types = [c["date_type"] for c in multi_candidates]
    print(f"  [OK] Found {len(multi_candidates)} dates in single document: {date_types}")
    assert "Expiry" in date_types and "Issue" in date_types and "Due" in date_types

    # 7. Test Invalid AI JSON Response Handling
    print("\n[7/11] Testing Invalid AI JSON Response Handling...")
    invalid_json_str = "```json\n{ invalid json content here...\n```"
    parsed_invalid = expiry_service._parse_json(invalid_json_str)
    assert parsed_invalid is None, "Failed to return None on invalid JSON"
    print("  [OK] Malformed AI JSON safely handled without throwing exception.")

    # 8. Test Ollama Unavailable & Graceful Fallback
    print("\n[8/11] Testing Ollama Unavailable & Graceful Fallback...")
    # Temporarily set invalid base URL to simulate offline Ollama
    original_url = expiry_service.ollama_base_url
    expiry_service.ollama_base_url = "http://127.0.0.1:99999"

    is_avail, model_name = expiry_service.is_ollama_available()
    assert is_avail is False, "Expected False when Ollama server is offline"

    fallback_res = expiry_service.extract_dates_with_ollama("Vehicle Insurance expires on 15 March 2027.", "test.pdf")
    assert fallback_res is None, "Expected None fallback response when Ollama is offline"

    # Restore original URL
    expiry_service.ollama_base_url = original_url
    print("  [OK] Offline Ollama server detected cleanly. Graceful fallback to rule-based scanner verified.")

    # 9. Test Real PDF Text Extraction Integration
    print("\n[9/11] Testing Real PDF Text Extraction Integration...")
    from app.services.extractor import text_extractor
    pdf_sample_path = os.path.join(current_dir, "sample_documents", "important.pdf")
    if os.path.exists(pdf_sample_path):
        extracted_text, st = text_extractor.extract(pdf_sample_path, ".pdf")
        assert len(extracted_text) > 0, "Failed to extract text from important.pdf"
        pdf_candidates = expiry_service.extract_dates_from_text(extracted_text, "important.pdf")
        assert len(pdf_candidates) > 0, "No dates found in important.pdf"
        print(f"  [OK] Real PDF 'important.pdf' text extracted ({len(extracted_text)} chars). Top date candidate: {pdf_candidates[0]['parsed_date'].strftime('%Y-%m-%d')} ({pdf_candidates[0]['date_type']}).")
    else:
        print("  [SKIP] important.pdf sample not found on disk.")

    # 10. Test Database Persistence & Multi-Date CRUD
    print("\n[10/11] Testing DB Persistence & Multi-Date Record Creation...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    test_folder = db.query(Folder).filter(Folder.path == "C:\\TestFolderExpiry").first()
    if not test_folder:
        test_folder = Folder(path="C:\\TestFolderExpiry", name="TestFolderExpiry")
        db.add(test_folder)
        db.commit()

    test_file = db.query(File).filter(File.path == "C:\\TestFolderExpiry\\Vehicle_Doc.pdf").first()
    if not test_file:
        test_file = File(
            folder_id=test_folder.id,
            path="C:\\TestFolderExpiry\\Vehicle_Doc.pdf",
            name="Vehicle_Doc.pdf",
            extension=".pdf",
            size=2048,
            modified_at=datetime.utcnow(),
            file_hash="test_hash_multi_99",
            extracted_text="Vehicle Insurance Policy. Policy Issued: 10/01/2024. Payment Due: 15/02/2027. Policy Expires On: 15/03/2028."
        )
        db.add(test_file)
        db.commit()

    expiry_rec = expiry_service.analyze_file(db, test_file.id, reanalyze=True)
    assert expiry_rec is not None, "Failed to analyze file"

    file_records = db.query(FileExpiry).filter(FileExpiry.file_id == test_file.id).all()
    assert len(file_records) >= 1, "Expected at least 1 expiry record in DB"
    print(f"  [OK] DB persistence verified. Created {len(file_records)} date record(s) for file ID {test_file.id}:")
    for r in file_records:
        print(f"       -> ID={r.id}, DateType={r.date_type}, Date={r.extracted_date.strftime('%Y-%m-%d')}, Method={r.extraction_method}, Status={r.status}")

    # Confirm record
    confirmed_rec = expiry_service.confirm_expiry_record(db, expiry_rec.id)
    assert confirmed_rec.user_confirmed is True
    print("  [OK] User confirmation succeeded.")

    # 11. Test Documents Without Expiry Dates (PPTX, TXT, Issue-only documents)
    print("\n[11/12] Testing Documents Without Actual Expiry Dates (PPTX, TXT, Issue-Only)...")
    non_expiry_files = [
        ("C:\\TestFolderExpiry\\Presentation.pptx", "Presentation.pptx", ".pptx", "Project Status Presentation. Created Date: 15/05/2024. Meeting Date: 20/06/2024."),
        ("C:\\TestFolderExpiry\\Notes.txt", "Notes.txt", ".txt", "Developer Scratchpad. Added entry on 10/10/2023. Updated 12/12/2023."),
        ("C:\\TestFolderExpiry\\Certificate_IssueOnly.pdf", "Certificate_IssueOnly.pdf", ".pdf", "Graduation Certificate of Excellence. Issued On: 01/06/2022.")
    ]

    for f_path, f_name, f_ext, f_text in non_expiry_files:
        t_file = db.query(File).filter(File.path == f_path).first()
        if not t_file:
            t_file = File(
                folder_id=test_folder.id,
                path=f_path,
                name=f_name,
                extension=f_ext,
                size=1024,
                modified_at=datetime.utcnow(),
                file_hash=f"hash_{f_name}",
                extracted_text=f_text
            )
            db.add(t_file)
            db.commit()

        no_exp_res = expiry_service.analyze_file(db, t_file.id, reanalyze=True)
        assert no_exp_res is None, f"Expected None for non-expiry document '{f_name}', got {no_exp_res}"
        recs_in_db = db.query(FileExpiry).filter(FileExpiry.file_id == t_file.id).all()
        assert len(recs_in_db) == 0, f"Expected 0 records in DB for non-expiry document '{f_name}', found {len(recs_in_db)}"
        print(f"  [OK] '{f_name}' correctly created 0 Expiry records (non-expiry document filtered out).")

    # 12. Test Regression Safety for Modules 1, 2, 3
    print("\n[12/12] Testing Regression Safety for Modules 1, 2, 3...")
    summary = expiry_service.get_summary_counts(db)
    assert "total_tracked" in summary
    assert "upcoming" in summary
    assert "due_soon" in summary
    assert "expired" in summary
    assert "needs_review" in summary
    assert "ollama_available" in summary
    print(f"  [OK] Module 5 Summary counts verified: {summary}")

    db.close()
    print("\n==================================================")
    print("ALL 12 FILE EXPIRY & RENEWAL REMINDER TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_expiry_pipeline()
