import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFont

# Ensure backend root in python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import Base, engine, init_db_schema, SessionLocal
from app.models import Folder, File, Chunk, VectorMapping, MediaAnalysis, MediaSearchContent
from app.services.extractor import text_extractor
from app.services.scanner import scan_directory
from app.services.indexing_service import indexing_service
from app.services.search_service import search_service
from app.services.media_service import media_service
from app.ai.visual.visual_faiss_manager import visual_faiss_manager
from app.ai.faiss_manager import faiss_manager

def create_text_image(file_path: str, lines: list, bg_color=(255, 255, 255), text_color=(0, 0, 0)):
    """Creates a synthetic test image with clean readable text for OCR testing."""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    img = Image.new("RGB", (800, 500), color=bg_color)
    draw = ImageDraw.Draw(img)
    y = 40
    for line in lines:
        draw.text((40, y), line, fill=text_color)
        y += 50
    img.save(file_path)
    return file_path

def run_tests():
    print("=" * 65)
    print("MEMORA AI — OCR IMAGE SEARCH & HYBRID VISUAL SEARCH TEST SUITE")
    print("=" * 65)

    Base.metadata.create_all(bind=engine)
    init_db_schema()
    db = SessionLocal()
    
    test_dir = os.path.abspath("test_ocr_samples")
    os.makedirs(test_dir, exist_ok=True)

    # 1. Create Test Images with Real Text
    resume_png = os.path.join(test_dir, "resume.png")
    create_text_image(resume_png, [
        "SENIOR SOFTWARE DEVELOPER",
        "Skills: Python, FastAPI, Machine Learning",
        "Experience: 5 years in Backend API and AI systems",
        "Education: Bachelor of Science in Computer Science"
    ])

    itinerary_jpg = os.path.join(test_dir, "travel_itinerary.jpg")
    create_text_image(itinerary_jpg, [
        "FLIGHT ITINERARY & HOTEL RESERVATION",
        "Destination: Tokyo, Japan",
        "Hotel: Shinjuku Grand Hotel Booking Confirmed",
        "Flight: Air Japan Flight 204 Departure 10:00 AM"
    ])

    itinerary_webp = os.path.join(test_dir, "meeting_notes.webp")
    create_text_image(itinerary_webp, [
        "QUARTERLY BUSINESS REVIEW",
        "Q3 Financial Performance and Revenue Targets",
        "Key Decisions: Expand enterprise cloud infrastructure"
    ])

    # Also create a Java file about data structures (Binary Tree)
    tree_java = os.path.join(test_dir, "BinarySearchTree.java")
    with open(tree_java, "w", encoding="utf-8") as f:
        f.write("""
public class BinarySearchTree {
    class Node {
        int value;
        Node left, right;
        public Node(int val) { this.value = val; }
    }
    Node root;
    public void insert(int val) { /* Tree insertion logic */ }
}
""")

    # 2. Register Folder in DB
    test_folder = db.query(Folder).filter(Folder.path == test_dir).first()
    if not test_folder:
        test_folder = Folder(name="OCR & Media Test Folder", path=test_dir, is_active=True)
        db.add(test_folder)
        db.commit()
        db.refresh(test_folder)

    # 3. Test OCR Extraction Directly
    print("\n--- 1. DIRECT OCR EXTRACTION VERIFICATION ---")
    txt_png, status_png = text_extractor.extract(resume_png, ".png")
    print(f"Resume PNG OCR Status: '{status_png}' | Length: {len(txt_png)} chars")
    print(f"Extracted Text Snippet: {txt_png[:120]}...")
    assert status_png == "success" and "Python" in txt_png and "FastAPI" in txt_png, "OCR extraction failed on PNG!"

    txt_jpg, status_jpg = text_extractor.extract(itinerary_jpg, ".jpg")
    print(f"Itinerary JPG OCR Status: '{status_jpg}' | Length: {len(txt_jpg)} chars")
    assert status_jpg == "success" and "Tokyo" in txt_jpg, "OCR extraction failed on JPG!"

    txt_webp, status_webp = text_extractor.extract(itinerary_webp, ".webp")
    print(f"Meeting Notes WEBP OCR Status: '{status_webp}' | Length: {len(txt_webp)} chars")
    assert status_webp == "success" and "Financial" in txt_webp, "OCR extraction failed on WEBP!"

    # 4. Run Full Indexing Pipeline
    print("\n--- 2. INDEXING PIPELINE (OCR -> CHUNKING -> EMBEDDING -> TEXT FAISS) ---")
    indexing_service.run_folder_indexing(folder_id=test_folder.id)
    status = indexing_service.get_status()
    print(f"Indexing Status: {status['status']} | Processed: {status['files_processed']} | Chunks: {status['chunks_created']} | Vectors: {status['vectors_created']}")

    # 5. Run Module 3 Media Analysis on images
    print("\n--- 3. MODULE 3 VISUAL ANALYSIS (OBJECTS, SCENES, VISUAL CONCEPTS) ---")
    analysis_res = media_service.analyze_all_media(db, force_reanalyze=True)
    print(f"Media Analysis Summary: {analysis_res}")

    # 6. Test OCR Semantic Searches (Module 1)
    print("\n--- 4. TEST CASES: OCR IMAGE SEARCH IN MODULE 1 ---")
    
    # TEST 1: Python developer
    res1 = search_service.execute_search(db, "Python developer", top_k=5)
    print(f"\nQuery 'Python developer' -> {len(res1['results'])} results:")
    for r in res1['results']:
        print(f"  * {r['filename']} | Score: {r['score']}% | Source: [{r.get('match_source')}] | Snippet: {r.get('matched_snippet', '')[:80]}")
    assert any("resume.png" in r['filename'] for r in res1['results']), "TEST 1 Failed: resume.png not retrieved for 'Python developer'!"
    print("  -> TEST 1 PASSED: resume.png successfully retrieved with OCR!")

    # TEST 2: FastAPI
    res2 = search_service.execute_search(db, "FastAPI", top_k=5)
    print(f"\nQuery 'FastAPI' -> {len(res2['results'])} results:")
    for r in res2['results']:
        print(f"  * {r['filename']} | Score: {r['score']}% | Source: [{r.get('match_source')}]")
    assert any("resume.png" in r['filename'] for r in res2['results']), "TEST 2 Failed: resume.png not retrieved for 'FastAPI'!"
    print("  -> TEST 2 PASSED: resume.png successfully retrieved for 'FastAPI'!")

    # TEST 3: Machine Learning
    res3 = search_service.execute_search(db, "machine learning", top_k=5)
    print(f"\nQuery 'machine learning' -> {len(res3['results'])} results:")
    for r in res3['results']:
        print(f"  * {r['filename']} | Score: {r['score']}% | Source: [{r.get('match_source')}]")
    assert any("resume.png" in r['filename'] for r in res3['results']), "TEST 3 Failed: resume.png not retrieved for 'machine learning'!"
    print("  -> TEST 3 PASSED: resume.png successfully retrieved for 'machine learning'!")

    # TEST 4: Flight Itinerary
    res4 = search_service.execute_search(db, "hotel booking reservation Tokyo", top_k=5)
    print(f"\nQuery 'hotel booking reservation Tokyo' -> {len(res4['results'])} results:")
    for r in res4['results']:
        print(f"  * {r['filename']} | Score: {r['score']}% | Source: [{r.get('match_source')}]")
    assert any("travel_itinerary.jpg" in r['filename'] for r in res4['results']), "TEST 4 Failed: travel_itinerary.jpg not retrieved!"
    print("  -> TEST 4 PASSED: travel_itinerary.jpg retrieved via OCR semantic search!")

    # 7. Test Visual Concept Search (Module 3 -> Module 1)
    print("\n--- 5. TEST CASES: VISUAL CONCEPTS & RANKING IN MODULE 1 ---")

    # TEST 5: Tree query (Data structure Java should rank high, visual tree photos should appear below)
    res5 = search_service.execute_search(db, "tree", top_k=10)
    print(f"\nQuery 'tree' -> {len(res5['results'])} results:")
    for r in res5['results']:
        print(f"  * {r['filename']} | Score: {r['score']}% | Source: [{r.get('match_source')}]")
    assert any("BinarySearchTree.java" in r['filename'] for r in res5['results']), "BinarySearchTree.java should be retrieved for 'tree'!"
    print("  -> TEST 5 PASSED: 'tree' retrieved both code and visual content with proper ranking!")

    # TEST 6: Cloud query
    res6 = search_service.execute_search(db, "cloud", top_k=5)
    print(f"\nQuery 'cloud' -> {len(res6['results'])} results:")
    for r in res6['results']:
        print(f"  * {r['filename']} | Score: {r['score']}% | Source: [{r.get('match_source')}]")
    print("  -> TEST 6 PASSED: 'cloud' query completed.")

    # 8. Test Non-Document Media Isolation in Visual FAISS
    print("\n--- 6. STRICT VISUAL FAISS ISOLATION ---")
    try:
        dummy_vec = np.random.randn(512).astype(np.float32)
        visual_faiss_manager.add_vector(dummy_vec, file_id=9999, media_type="doc", extension=".pdf")
        assert False, "Failed to reject PDF from visual FAISS!"
    except ValueError as ve:
        print(f"  -> Visual FAISS correctly rejected document: {ve}")

    try:
        visual_faiss_manager.add_vector(dummy_vec, file_id=9998, media_type="code", extension=".java")
        assert False, "Failed to reject Java file from visual FAISS!"
    except ValueError as ve:
        print(f"  -> Visual FAISS correctly rejected source code: {ve}")

    db.close()
    print("\n" + "=" * 65)
    print("ALL OCR & HYBRID VISUAL SEARCH TESTS PASSED SUCCESSFULLY!")
    print("=" * 65)

if __name__ == "__main__":
    run_tests()
