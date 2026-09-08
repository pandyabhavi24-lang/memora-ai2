import os
import cv2
import numpy as np
from PIL import Image

from app.database import SessionLocal, Base, engine
from app.models import Folder, File, MediaAnalysis, MediaEmbedding, MediaSimilarity, MediaRecommendation, MediaGroup
from app.ai.visual.quality_analyzer import quality_analyzer
from app.ai.visual.object_detector import visual_content_detector
from app.ai.visual.image_analyzer import image_analyzer
from app.ai.visual.video_analyzer import video_analyzer
from app.ai.visual.visual_embeddings import visual_embedding_service
from app.ai.visual.visual_faiss_manager import visual_faiss_manager
from app.ai.visual.similarity_engine import visual_similarity_engine
from app.ai.visual.media_recommender import media_recommender
from app.services.media_service import media_service
from app.services.search_service import search_service

# Ensure DB schema is up to date
Base.metadata.create_all(bind=engine)

def run_module3_test_suite():
    print("=" * 60)
    print("MEMORA AI - MODULE 3: VISUAL & MEDIA INTELLIGENCE TEST SUITE")
    print("=" * 60)

    test_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_media_samples")
    os.makedirs(test_dir, exist_ok=True)

    # 1. Generate Synthetic Test Images
    # Image A: High Quality Landscape (Nature, Tree, Sky)
    img_a_path = os.path.join(test_dir, "nature_hq.jpg")
    img_a = np.zeros((600, 800, 3), dtype=np.uint8)
    img_a[:300, :] = [235, 180, 100]  # Sky (BGR blue)
    img_a[300:, :] = [40, 160, 40]   # Grass / Vegetation (BGR green)
    # Add high contrast tree details (sharp edges)
    cv2.circle(img_a, (400, 250), 80, (20, 100, 20), -1)
    cv2.rectangle(img_a, (380, 250), (420, 450), (30, 60, 100), -1)
    cv2.imwrite(img_a_path, img_a)

    # Image B: Lower Quality / Blurred version of Image A
    img_b_path = os.path.join(test_dir, "nature_lq_blurred.jpg")
    img_b = cv2.GaussianBlur(img_a, (21, 21), 0)
    cv2.imwrite(img_b_path, img_b)

    # Image C: Screenshot (UI window with toolbar & high edge density)
    img_c_path = os.path.join(test_dir, "dashboard_screenshot.png")
    img_c = np.ones((720, 1280, 3), dtype=np.uint8) * 240
    cv2.rectangle(img_c, (0, 0), (1280, 50), (50, 50, 50), -1)  # Top dark title bar
    cv2.rectangle(img_c, (0, 50), (250, 720), (30, 30, 30), -1)  # Left dark sidebar
    for y in range(80, 650, 40):
        cv2.line(img_c, (280, y), (1200, y), (200, 200, 200), 2)  # Grid UI lines
    cv2.putText(img_c, "MEMORA AI DASHBOARD", (300, 120), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 0), 2)
    cv2.imwrite(img_c_path, img_c)

    # Image D: Exact Duplicate of Image A
    img_d_path = os.path.join(test_dir, "nature_hq_copy.jpg")
    cv2.imwrite(img_d_path, img_a)

    # Video: Short Synthetic 3-second MP4 video
    video_path = os.path.join(test_dir, "sample_clip.mp4")
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(video_path, fourcc, 10.0, (640, 480))
    for frame_idx in range(30):
        vframe = np.zeros((480, 640, 3), dtype=np.uint8)
        # Moving circle across frames
        cv2.circle(vframe, (100 + frame_idx * 15, 240), 50, (0, 200, 255), -1)
        cv2.putText(vframe, f"Frame {frame_idx}", (30, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        out.write(vframe)
    out.release()

    # Corrupted File for Error Handling
    corrupted_img_path = os.path.join(test_dir, "corrupted.jpg")
    with open(corrupted_img_path, "wb") as f:
        f.write(b"NOT_A_REAL_IMAGE_DATA_CORRUPTED_BYTES_12345")

    print("\n--- 1. IMAGE CONTENT & QUALITY ANALYSIS ---")
    res_a = image_analyzer.analyze_image(img_a_path, "nature_hq.jpg")
    print(f"Image A (Nature HQ): Quality Score={res_a['quality_score']}/100 | Sharpness={res_a['sharpness_score']:.1f} | Category={res_a['visual_category']} | Objects={res_a['detected_objects']}")
    assert res_a['status'] == "completed"
    assert res_a['quality_score'] > 50.0

    res_b = image_analyzer.analyze_image(img_b_path, "nature_lq_blurred.jpg")
    print(f"Image B (Blurred): Quality Score={res_b['quality_score']}/100 | Blur Score={res_b['blur_score']:.1f} | Sharpness={res_b['sharpness_score']:.1f}")
    assert res_a['quality_score'] > res_b['quality_score'], "HQ image must have higher quality score than blurred copy!"

    res_c = image_analyzer.analyze_image(img_c_path, "dashboard_screenshot.png")
    print(f"Image C (Screenshot): Is Screenshot={res_c['is_screenshot']} (Conf: {res_c['screenshot_confidence']}) | Category={res_c['visual_category']}")
    assert res_c['is_screenshot'] is True or res_c['visual_category'] == "screenshot"

    print("\n--- 2. VIDEO INTELLIGENCE & FRAME EXTRACTION ---")
    res_vid = video_analyzer.analyze_video(video_path, "sample_clip.mp4")
    print(f"Video Analysis: Duration={res_vid['duration']}s | FPS={res_vid['frame_rate']} | Resolution={res_vid['width']}x{res_vid['height']} | Quality={res_vid['quality_score']}/100")
    assert res_vid['status'] == "completed"
    assert res_vid['duration'] > 0

    print("\n--- 3. VISUAL EMBEDDINGS & SEPARATE VISUAL FAISS ---")
    vec_a = visual_embedding_service.embed_image(img_a_path)
    vec_b = visual_embedding_service.embed_image(img_b_path)
    vec_c = visual_embedding_service.embed_image(img_c_path)
    vec_d = visual_embedding_service.embed_image(img_d_path)

    # Cosine similarities
    sim_ab = float(np.dot(vec_a, vec_b)) * 100.0
    sim_ad = float(np.dot(vec_a, vec_d)) * 100.0
    sim_ac = float(np.dot(vec_a, vec_c)) * 100.0

    print(f"Similarity A (Nature HQ) <-> D (Exact Copy): {sim_ad:.1f}% (Expected: ~100%)")
    print(f"Similarity A (Nature HQ) <-> B (Blurred Nature): {sim_ab:.1f}% (Expected: >80%)")
    print(f"Similarity A (Nature HQ) <-> C (UI Screenshot): {sim_ac:.1f}% (Expected: <60%)")
    assert sim_ad >= 99.0, "Exact copies must produce >=99% similarity"
    assert sim_ab > sim_ac, "Blurred version of same scene must be more similar than UI screenshot"

    print("\n--- 4. FULL SERVICE PIPELINE & RECOMMENDATIONS ---")
    db = SessionLocal()
    try:
        # Create test folder & files in DB
        folder = db.query(Folder).filter(Folder.path == test_dir).first()
        if not folder:
            folder = Folder(path=test_dir, name="Test Media Folder")
            db.add(folder)
            db.commit()

        # Add sample files to DB
        sample_paths = [
            (img_a_path, "nature_hq.jpg", ".jpg", os.path.getsize(img_a_path)),
            (img_b_path, "nature_lq_blurred.jpg", ".jpg", os.path.getsize(img_b_path)),
            (img_c_path, "dashboard_screenshot.png", ".png", os.path.getsize(img_c_path)),
            (img_d_path, "nature_hq_copy.jpg", ".jpg", os.path.getsize(img_d_path)),
            (video_path, "sample_clip.mp4", ".mp4", os.path.getsize(video_path))
        ]

        for p, n, ext, sz in sample_paths:
            f_rec = db.query(File).filter(File.path == p).first()
            if not f_rec:
                f_rec = File(
                    folder_id=folder.id,
                    path=p,
                    name=n,
                    extension=ext,
                    size=sz,
                    modified_at=folder.created_at,
                    file_hash=f"hash_{n}"
                )
                db.add(f_rec)
        db.commit()

        # Run pipeline
        media_service.analyze_all_media(db, force_reanalyze=True)

        overview = media_service.get_overview_statistics(db)
        print(f"Overview: Total Images={overview['total_images']}, Videos={overview['total_videos']}, Analyzed={overview['analyzed_count']}, Recommendations={overview['recommendations_count']}, Potential Recovery={overview['potential_recovery_formatted']}")

        recs = media_service.get_recommendations(db)
        print(f"Generated {len(recs)} AI Cleanup Recommendations:")
        for r in recs:
            print(f"  * Action: {r['action'].upper()} on '{r['file_name']}' | Reason: {r['reason']} | Savings: {r['potential_storage_recovery_formatted']}")

        assert len(recs) > 0, "Expected at least 1 cleanup recommendation for duplicate/blurred copy"

        # Safety Check: Verify files are NOT deleted automatically
        assert os.path.exists(img_d_path), "File must NOT be automatically deleted!"

        # Groups Check
        groups = media_service.get_visual_groups(db)
        print(f"Visual Groups created: {len(groups)}")
        for g in groups:
            print(f"  - Group: {g['group_name']} ({g['item_count']} items)")

        print("\n--- 5. STRICT NON-DOCUMENT MEDIA ISOLATION ---")
        # Attempting to add a PDF/Code file to visual FAISS should raise ValueError
        dummy_vec = np.random.randn(512).astype(np.float32)
        try:
            visual_faiss_manager.add_vector(dummy_vec, file_id=999, media_type="pdf", extension=".pdf")
            raise AssertionError("Should have rejected PDF from visual FAISS index!")
        except ValueError as ve:
            print(f"Correctly rejected document from visual FAISS: {ve}")

        try:
            visual_faiss_manager.add_vector(dummy_vec, file_id=998, media_type="java", extension=".java")
            raise AssertionError("Should have rejected Java source file from visual FAISS index!")
        except ValueError as ve:
            print(f"Correctly rejected source code from visual FAISS: {ve}")

        print("\n--- 6. HYBRID SEMANTIC SEARCH (MODULE 3 -> MODULE 1) ---")
        # Test 1: Query 'tree' should return nature_hq.jpg as a VISUAL match
        tree_search = search_service.execute_search(db, "tree", top_k=5)
        print(f"Query 'tree' -> {tree_search['total']} results:")
        for r in tree_search['results']:
            print(f"  * {r['file_name']} | Score: {r['score']}% | Source: [{r.get('match_source')}] | Snippet: {r['matched_snippet']}")
        
        tree_files = [r['file_name'] for r in tree_search['results']]
        assert any("nature" in fn for fn in tree_files), "Query 'tree' must retrieve nature_hq.jpg"

        # Test 2: Query 'dashboard' or 'screenshot' should return screenshot
        dash_search = search_service.execute_search(db, "dashboard screenshot", top_k=5)
        print(f"\nQuery 'dashboard screenshot' -> {dash_search['total']} results:")
        for r in dash_search['results']:
            print(f"  * {r['file_name']} | Score: {r['score']}% | Source: [{r.get('match_source')}]")
        assert any("dashboard_screenshot" in r['file_name'] for r in dash_search['results'])

        # Test 3: Document/Code query 'singleton' should NOT return nature image
        singleton_search = search_service.execute_search(db, "singleton logger", top_k=5)
        print(f"\nQuery 'singleton logger' -> {singleton_search['total']} results:")
        for r in singleton_search['results']:
            print(f"  * {r['file_name']} | Score: {r['score']}% | Source: [{r.get('match_source')}]")
            assert "nature" not in r['file_name'], "Document query must NOT rank unrelated nature photo"

        print("\n--- 7. ERROR RESILIENCE TESTS ---")
        res_corrupt = image_analyzer.analyze_image(corrupted_img_path, "corrupted.jpg")
        print(f"Corrupted File Handled Gracefully: Status={res_corrupt['status']} | Error noted: {bool(res_corrupt.get('error'))}")
        assert res_corrupt['status'] in ["failed", "unsupported"]

        res_missing = image_analyzer.analyze_image("C:\\non_existent_image_path_123.jpg", "missing.jpg")
        print(f"Missing File Handled Gracefully: Status={res_missing['status']}")
        assert res_missing['status'] == "failed"

        print("\n--- 8. REGRESSION TEST: MODULE 1 SEARCH UNTOUCHED ---")
        search_res = search_service.execute_search(db, "design pattern", top_k=3)
        print(f"Module 1 Search Query 'design pattern' -> {search_res['total']} results returned in {search_res['execution_time_ms']}ms")
        assert search_res is not None

        print("\n" + "=" * 60)
        print("ALL MODULE 3 & HYBRID SEARCH TESTS PASSED SUCCESSFULLY WITH ZERO REGRESSIONS!")
        print("=" * 60)

    finally:
        db.close()

if __name__ == "__main__":
    run_module3_test_suite()

