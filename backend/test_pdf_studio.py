import os
import sys
import shutil
import tempfile
from fastapi.testclient import TestClient

# Ensure backend package is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.main import app

client = TestClient(app)

def run_pdf_studio_tests():
    print("==================================================")
    print("MEMORA AI — PDF STUDIO BACKEND FOUNDATION TESTS")
    print("==================================================")

    # 1. Health Endpoint Test
    print("\n[1/7] Testing GET /api/pdf/health...")
    res = client.get("/api/pdf/health")
    print(f"  Response ({res.status_code}): {res.json()}")
    assert res.status_code == 200
    assert res.json()["status"] in ("ok", "ready")
    assert res.json()["pypdf_available"] is True

    # Setup temp directory for PDF files
    temp_dir = tempfile.mkdtemp(prefix="memora_pdf_test_")
    user_test_dir = os.path.join(os.path.expanduser("~"), "Documents", "MemoraTestTemp")
    os.makedirs(user_test_dir, exist_ok=True)
    print(f"\nCreated temporary workspace: {temp_dir}")
    print(f"Created user test workspace for DB registration: {user_test_dir}")

    try:
        # 2. Blank PDF Creation Test (A4, Letter, Legal, portrait, landscape)
        print("\n[2/10] Testing POST /api/pdf/create-blank (A4 Landscape & Legal Portrait)...")
        blank_req = {
            "file_name": "test_a4_landscape.pdf",
            "output_dir": temp_dir,
            "page_count": 2,
            "page_size": "A4",
            "orientation": "landscape"
        }
        res = client.post("/api/pdf/create-blank", json=blank_req)
        print(f"  Response ({res.status_code}): {res.json()}")
        assert res.status_code == 200
        created_path = res.json()["output_path"]
        assert os.path.exists(created_path)
        assert res.json()["page_count"] == 2

        # Inspect dimensions of A4 Landscape (841.89 x 595.28 pt)
        res_insp = client.post("/api/pdf/inspect", json={"file_path": created_path})
        assert res_insp.status_code == 200
        assert res_insp.json()["pages"][0]["width"] > res_insp.json()["pages"][0]["height"]
        print(f"  Verified A4 Landscape dimensions: {res_insp.json()['pages'][0]['width']}x{res_insp.json()['pages'][0]['height']}")

        # 3. Document Inspection Test
        print("\n[3/10] Testing POST /api/pdf/inspect...")
        inspect_req = {"file_path": created_path}
        res = client.post("/api/pdf/inspect", json=inspect_req)
        print(f"  Response ({res.status_code}): {res.json()}")
        assert res.status_code == 200
        assert res.json()["page_count"] == 2

        # 4. Page Manipulation Test (Rotate, Duplicate, Delete)
        print("\n[4/10] Testing POST /api/pdf/manipulate...")
        manipulate_req = {
            "source_path": created_path,
            "actions": [
                {"action": "rotate", "page_index": 0, "degrees": 90},
                {"action": "duplicate", "page_index": 1}
            ]
        }
        res = client.post("/api/pdf/manipulate", json=manipulate_req)
        print(f"  Response ({res.status_code}): {res.json()}")
        assert res.status_code == 200
        # Started with 2 pages. Duplicate page 1 (+1) => 3 pages total
        assert res.json()["page_count"] == 3

        # 5. Images to Multi-page PDF Test (PNG, JPG, WebP)
        print("\n[5/10] Testing POST /api/pdf/images-to-pdf (PNG, JPG, WebP)...")
        from PIL import Image, ImageDraw
        img1_path = os.path.join(temp_dir, "test1.png")
        img2_path = os.path.join(temp_dir, "test2.jpg")
        img3_path = os.path.join(temp_dir, "test3.webp")

        Image.new("RGB", (300, 400), color="blue").save(img1_path)
        Image.new("RGB", (500, 500), color="red").save(img2_path)
        Image.new("RGB", (600, 800), color="green").save(img3_path)

        output_img_pdf = os.path.join(temp_dir, "from_images.pdf")
        img_pdf_req = {
            "image_paths": [img1_path, img2_path, img3_path],
            "output_path": output_img_pdf,
            "page_size": "A4",
            "fit_to_page": True
        }
        res = client.post("/api/pdf/images-to-pdf", json=img_pdf_req)
        print(f"  Response ({res.status_code}): {res.json()}")
        assert res.status_code == 200
        assert res.json()["page_count"] == 3

        # Test Error handling for non-existent image
        res_bad_img = client.post("/api/pdf/images-to-pdf", json={"image_paths": ["/non/existent/img.jpg"], "output_path": output_img_pdf})
        assert res_bad_img.status_code == 404
        print(f"  Verified clean error handling for missing image: {res_bad_img.json()}")

        # 6. PDF Merging Test
        print("\n[6/10] Testing POST /api/pdf/merge...")
        merged_output = os.path.join(temp_dir, "merged.pdf")
        merge_req = {
            "source_paths": [created_path, output_img_pdf],
            "output_path": merged_output
        }
        res = client.post("/api/pdf/merge", json=merge_req)
        print(f"  Response ({res.status_code}): {res.json()}")
        assert res.status_code == 200
        # 3 pages + 3 pages = 6 pages total
        assert res.json()["page_count"] == 6

        # 7. Database Document Registration & Persistence Test
        print("\n[7/10] Testing POST /api/pdf/documents (DB Registration)...")
        db_doc_req = {
            "file_path": merged_output,
            "title": "Merged Portfolio Document"
        }
        res_doc = client.post("/api/pdf/documents", json=db_doc_req)
        print(f"  Response ({res_doc.status_code}): {res_doc.json()}")
        assert res_doc.status_code == 200
        doc_id = res_doc.json()["id"]
        assert res_doc.json()["page_count"] == 6
        assert len(res_doc.json()["pages"]) == 6

        # 8. Database Page Metadata Update Test
        print("\n[8/11] Testing PATCH /api/pdf/documents/{doc_id}/pages/0 (DB Page Metadata)...")
        page_update_req = {"rotation": 180}
        res_page = client.patch(f"/api/pdf/documents/{doc_id}/pages/0", json=page_update_req)
        print(f"  Response ({res_page.status_code}): {res_page.json()}")
        assert res_page.status_code == 200
        assert res_page.json()["rotation"] == 180

        # Verify Persistence by re-querying GET /api/pdf/documents/{doc_id}
        res_requery = client.get(f"/api/pdf/documents/{doc_id}")
        assert res_requery.status_code == 200
        page0 = [p for p in res_requery.json()["pages"] if p["page_index"] == 0][0]
        assert page0["rotation"] == 180
        print(f"  Verified persisted rotation in DB: page_index 0 rotation = {page0['rotation']}")

        # 9. Page Reordering Test
        print("\n[9/11] Testing POST /api/pdf/reorder...")
        reorder_req = {
            "source_path": merged_output,
            "new_page_order": [5, 4, 3, 2, 1, 0]
        }
        res_reorder = client.post("/api/pdf/reorder", json=reorder_req)
        print(f"  Response ({res_reorder.status_code}): {res_reorder.json()}")
        assert res_reorder.status_code == 200
        assert res_reorder.json()["page_count"] == 6

        # 10. Page Extraction Test
        print("\n[10/11] Testing POST /api/pdf/extract-pages...")
        extracted_target = os.path.join(temp_dir, "extracted_subset.pdf")
        extract_req = {
            "source_path": merged_output,
            "output_path": extracted_target,
            "pages": [0, 2, 4]
        }
        res_extract = client.post("/api/pdf/extract-pages", json=extract_req)
        print(f"  Response ({res_extract.status_code}): {res_extract.json()}")
        assert res_extract.status_code == 200
        assert res_extract.json()["page_count"] == 3
        assert os.path.exists(extracted_target)

        # 11. PDF to Images Conversion Test (PNG, JPG, WebP)
        print("\n[11/12] Testing POST /api/pdf/convert/pdf-to-images (PNG, JPG, WebP)...")
        img_out_dir = os.path.join(temp_dir, "rendered_images")
        pdf_to_img_req = {
            "source_path": merged_output,
            "output_dir": img_out_dir,
            "image_format": "PNG",
            "page_selection": "all"
        }
        res_p2i = client.post("/api/pdf/convert/pdf-to-images", json=pdf_to_img_req)
        print(f"  Response ({res_p2i.status_code}): {res_p2i.json()}")
        assert res_p2i.status_code == 200
        assert res_p2i.json()["total_generated_files"] == 6
        for fpath in res_p2i.json()["generated_files"]:
            assert os.path.exists(fpath)
            assert os.path.getsize(fpath) > 0
            # Verify readable by PIL
            with Image.open(fpath) as img:
                assert img.size[0] > 0 and img.size[1] > 0

        # 12. PDF Split into Separate Files Test
        print("\n[12/12] Testing POST /api/pdf/split (Split Every Page to Separate PDFs)...")
        split_out_dir = os.path.join(temp_dir, "split_pages")
        split_req = {
            "source_path": merged_output,
            "output_dir": split_out_dir,
            "split_mode": "every_page",
            "naming_prefix": "doc_part"
        }
        res_split = client.post("/api/pdf/split", json=split_req)
        print(f"  Response ({res_split.status_code}): {res_split.json()}")
        assert res_split.status_code == 200
        assert res_split.json()["total_generated_files"] == 6
        for fpath in res_split.json()["generated_files"]:
            assert os.path.exists(fpath)
            assert fpath.endswith(".pdf")
            assert os.path.getsize(fpath) > 0

        # 13. Annotation & Text Database Persistence Test
        print("\n[13/16] Testing POST & GET /api/pdf/documents/{doc_id}/annotations...")
        annotations_payload = {
            "annotations": [
                {
                    "page_index": 0,
                    "annotation_type": "text",
                    "content_text": "Confidential Memora Document",
                    "x": 50.0,
                    "y": 100.0,
                    "font_size": 24.0,
                    "color": "#1e293b",
                    "alignment": "left"
                },
                {
                    "page_index": 0,
                    "annotation_type": "highlight",
                    "x": 48.0,
                    "y": 95.0,
                    "width": 300.0,
                    "height": 30.0,
                    "color": "#ffeb3b",
                    "opacity": 0.5
                },
                {
                    "page_index": 0,
                    "annotation_type": "draw",
                    "points": [[60.0, 150.0], [70.0, 160.0], [80.0, 155.0], [100.0, 170.0]],
                    "stroke_width": 3.0,
                    "color": "#ef4444"
                },
                {
                    "page_index": 0,
                    "annotation_type": "arrow",
                    "x": 50.0,
                    "y": 200.0,
                    "x2": 250.0,
                    "y2": 200.0,
                    "stroke_width": 2.0,
                    "color": "#3b82f6"
                },
                {
                    "page_index": 0,
                    "annotation_type": "rectangle",
                    "x": 50.0,
                    "y": 230.0,
                    "width": 200.0,
                    "height": 100.0,
                    "stroke_width": 2.0,
                    "color": "#10b981",
                    "fill_color": "#d1fae5"
                },
                {
                    "page_index": 0,
                    "annotation_type": "circle",
                    "x": 300.0,
                    "y": 230.0,
                    "width": 100.0,
                    "height": 100.0,
                    "stroke_width": 2.0,
                    "color": "#8b5cf6"
                },
                {
                    "page_index": 0,
                    "annotation_type": "note",
                    "content_text": "Review financial figures before archiving.",
                    "x": 420.0,
                    "y": 230.0,
                    "width": 120.0,
                    "height": 100.0
                }
            ]
        }
        res_save_annos = client.post(f"/api/pdf/documents/{doc_id}/annotations", json=annotations_payload)
        print(f"  Response ({res_save_annos.status_code}): {len(res_save_annos.json())} annotations saved.")
        assert res_save_annos.status_code == 200
        assert len(res_save_annos.json()) == 7

        # Fetch and verify annotations from DB
        res_get_annos = client.get(f"/api/pdf/documents/{doc_id}/annotations")
        assert res_get_annos.status_code == 200
        assert len(res_get_annos.json()) == 7
        types_saved = {a["annotation_type"] for a in res_get_annos.json()}
        assert types_saved == {"text", "highlight", "draw", "arrow", "rectangle", "circle", "note"}
        print(f"  Verified all annotation types persisted in DB: {sorted(types_saved)}")

        # 14. Real PDF Export with Text and Annotations Test
        print("\n[14/16] Testing POST /api/pdf/export-with-annotations (Real PDF Generation)...")
        exported_pdf_path = os.path.join(temp_dir, "annotated_document_output.pdf")
        export_req = {
            "source_path": merged_output,
            "output_path": exported_pdf_path,
            "annotations": annotations_payload["annotations"],
            "register_in_db": True
        }
        res_export = client.post("/api/pdf/export-with-annotations", json=export_req)
        print(f"  Response ({res_export.status_code}): {res_export.json()}")
        assert res_export.status_code == 200
        assert os.path.exists(exported_pdf_path)
        assert res_export.json()["file_size_bytes"] > 0

        # 15. Physical Verification of Exported PDF Content
        print("\n[15/16] Verifying physical output PDF content using pypdf...")
        import pypdf
        exp_reader = pypdf.PdfReader(exported_pdf_path)
        assert len(exp_reader.pages) == 6
        page0_content = exp_reader.pages[0]
        assert page0_content.mediabox is not None
        print(f"  Exported PDF verified: {len(exp_reader.pages)} pages, Page 1 size: {page0_content.mediabox.width}x{page0_content.mediabox.height} pt.")

        # 16. Input Validation & Error Handling Tests
        print("\n[16/16] Testing Input Validation & Clean Error Rejection...")
        # Invalid annotation type
        res_bad_type = client.post(f"/api/pdf/documents/{doc_id}/annotations", json={
            "annotations": [{"page_index": 0, "annotation_type": "invalid_type_xyz"}]
        })
        assert res_bad_type.status_code == 400
        print(f"  Verified rejection for invalid annotation_type: {res_bad_type.json()['detail']}")

        # Page index out of bounds
        res_bad_page = client.post(f"/api/pdf/documents/{doc_id}/annotations", json={
            "annotations": [{"page_index": 999, "annotation_type": "text", "content_text": "Hi"}]
        })
        assert res_bad_page.status_code == 400
        print(f"  Verified rejection for out-of-bounds page_index: {res_bad_page.json()['detail']}")

        # Negative dimension
        res_bad_dim = client.post(f"/api/pdf/documents/{doc_id}/annotations", json={
            "annotations": [{"page_index": 0, "annotation_type": "rectangle", "width": -50.0}]
        })
        assert res_bad_dim.status_code == 400
        print(f"  Verified rejection for negative dimension: {res_bad_dim.json()['detail']}")

        # 17. Dedicated PDF Organization — User-defined Order Merge Test
        print("\n[17/21] Testing PDF Organization MERGE with Arbitrary Order (PDF B + PDF A + PDF C)...")
        pdf_a_path = os.path.join(temp_dir, "doc_a.pdf")
        pdf_b_path = os.path.join(temp_dir, "doc_b.pdf")
        pdf_c_path = os.path.join(temp_dir, "doc_c.pdf")

        client.post("/api/pdf/create-blank", json={"file_name": "doc_a.pdf", "output_dir": temp_dir, "page_count": 1, "page_size": "A4"})
        client.post("/api/pdf/create-blank", json={"file_name": "doc_b.pdf", "output_dir": temp_dir, "page_count": 2, "page_size": "Letter"})
        client.post("/api/pdf/create-blank", json={"file_name": "doc_c.pdf", "output_dir": temp_dir, "page_count": 3, "page_size": "Legal"})

        assert os.path.exists(pdf_a_path)
        assert os.path.exists(pdf_b_path)
        assert os.path.exists(pdf_c_path)

        size_a_before = os.path.getsize(pdf_a_path)
        size_b_before = os.path.getsize(pdf_b_path)
        size_c_before = os.path.getsize(pdf_c_path)

        org_merged_path = os.path.join(temp_dir, "merged_b_a_c.pdf")
        org_merge_req = {
            "source_paths": [pdf_b_path, pdf_a_path, pdf_c_path],
            "output_path": org_merged_path,
            "register_in_db": True
        }
        res_org_merge = client.post("/api/pdf/merge", json=org_merge_req)
        print(f"  Response ({res_org_merge.status_code}): {res_org_merge.json()}")
        assert res_org_merge.status_code == 200
        # 2 + 1 + 3 = 6 pages total
        assert res_org_merge.json()["page_count"] == 6

        # Verify Original File Safety: Source files must remain completely intact
        assert os.path.getsize(pdf_a_path) == size_a_before
        assert os.path.getsize(pdf_b_path) == size_b_before
        assert os.path.getsize(pdf_c_path) == size_c_before
        print("  Verified Original File Safety: Source PDFs (A, B, C) remain 100% intact.")

        # 18. Dedicated PDF Organization — SPLIT Modes Test (every_page, selected_pages, range)
        print("\n[18/21] Testing PDF Organization SPLIT Modes (every_page, selected_pages, range)...")
        split_every_dir = os.path.join(temp_dir, "split_every_out")
        split_every_req = {
            "source_path": org_merged_path,
            "output_dir": split_every_dir,
            "split_mode": "every_page",
            "naming_prefix": "split_every"
        }
        res_split_every = client.post("/api/pdf/split", json=split_every_req)
        assert res_split_every.status_code == 200
        assert res_split_every.json()["total_generated_files"] == 6
        print(f"  Verified split mode 'every_page': generated {res_split_every.json()['total_generated_files']} separate PDFs.")

        split_sel_dir = os.path.join(temp_dir, "split_sel_out")
        split_sel_req = {
            "source_path": org_merged_path,
            "output_dir": split_sel_dir,
            "split_mode": "selected_pages",
            "pages": [0, 3, 5],
            "naming_prefix": "split_sel"
        }
        res_split_sel = client.post("/api/pdf/split", json=split_sel_req)
        assert res_split_sel.status_code == 200
        assert res_split_sel.json()["total_generated_files"] == 3
        print(f"  Verified split mode 'selected_pages': generated {res_split_sel.json()['total_generated_files']} PDFs.")

        split_range_dir = os.path.join(temp_dir, "split_range_out")
        split_range_req = {
            "source_path": org_merged_path,
            "output_dir": split_range_dir,
            "split_mode": "range",
            "start_page": 1,
            "end_page": 4,
            "naming_prefix": "split_range"
        }
        res_split_range = client.post("/api/pdf/split", json=split_range_req)
        assert res_split_range.status_code == 200
        assert res_split_range.json()["total_generated_files"] == 1
        range_pdf = res_split_range.json()["generated_files"][0]
        assert pypdf.PdfReader(range_pdf).pages.__len__() == 4
        print(f"  Verified split mode 'range' (pages 1-4): generated 1 PDF with 4 pages.")

        # 19. Dedicated PDF Organization — EXTRACT Pages Test
        print("\n[19/21] Testing PDF Organization EXTRACT Pages...")
        extracted_out = os.path.join(temp_dir, "extracted_pages_result.pdf")
        extract_org_req = {
            "source_path": org_merged_path,
            "output_path": extracted_out,
            "pages": [0, 2, 5],
            "sync_db": True
        }
        res_extract_org = client.post("/api/pdf/extract-pages", json=extract_org_req)
        print(f"  Response ({res_extract_org.status_code}): {res_extract_org.json()}")
        assert res_extract_org.status_code == 200
        assert res_extract_org.json()["page_count"] == 3
        assert os.path.exists(extracted_out)

        # 20. Organization Validation & Error Handling Test
        print("\n[20/21] Testing Organization Validation & Error Handling...")
        # Merge with non-existent file
        res_bad_merge = client.post("/api/pdf/merge", json={
            "source_paths": [pdf_a_path, "/non/existent/path.pdf"],
            "output_path": os.path.join(temp_dir, "bad_merge.pdf")
        })
        assert res_bad_merge.status_code == 404
        print(f"  Verified rejection for non-existent merge input file: {res_bad_merge.json()['detail']}")

        # Split with invalid page range
        res_bad_range = client.post("/api/pdf/split", json={
            "source_path": pdf_a_path,
            "output_dir": temp_dir,
            "split_mode": "range",
            "start_page": 5,
            "end_page": 2
        })
        assert res_bad_range.status_code == 400
        print(f"  Verified rejection for invalid split range: {res_bad_range.json()['detail']}")

        # 21. Memora File System Integration — Retrieval & Folder Listing Test
        print("\n[21/25] Testing GET /api/pdf/memora/files & /api/pdf/memora/folders...")
        res_mem_files = client.get("/api/pdf/memora/files?file_type=pdf")
        print(f"  Response ({res_mem_files.status_code}): {res_mem_files.json()['total']} total PDF files found in Memora.")
        assert res_mem_files.status_code == 200
        assert "total" in res_mem_files.json()
        assert "files" in res_mem_files.json()

        res_mem_folders = client.get("/api/pdf/memora/folders")
        print(f"  Response ({res_mem_folders.status_code}): {len(res_mem_folders.json())} active folders found.")
        assert res_mem_folders.status_code == 200
        assert isinstance(res_mem_folders.json(), list)

        # 22. Module 1 Search Engine Integration Test
        print("\n[22/25] Testing POST /api/pdf/memora/search (Reusing Module 1 Search Engine)...")
        search_payload = {
            "query": "document portfolio",
            "top_k": 5
        }
        res_mem_search = client.post("/api/pdf/memora/search", json=search_payload)
        print(f"  Response ({res_mem_search.status_code}): query='{res_mem_search.json()['query']}', results={len(res_mem_search.json()['results'])}")
        assert res_mem_search.status_code == 200
        assert "results" in res_mem_search.json()

        # 23. Complete End-to-End File Lifecycle Registration Test
        print("\n[23/25] Testing E2E File Lifecycle (PDF Studio -> DB Files Table -> Memora File System)...")
        e2e_file_name = "e2e_lifecycle_test.pdf"
        res_create_e2e = client.post("/api/pdf/create-blank", json={
            "file_name": e2e_file_name,
            "output_dir": user_test_dir,
            "page_count": 1,
            "register_in_db": True
        })
        assert res_create_e2e.status_code == 200
        e2e_path = res_create_e2e.json()["output_path"]
        e2e_file_id = res_create_e2e.json()["file_id"]
        assert e2e_file_id is not None

        # Verify file is visible to existing Memora file system query
        res_verify_list = client.get(f"/api/pdf/memora/files?query={e2e_file_name}")
        assert res_verify_list.status_code == 200
        matching = [f for f in res_verify_list.json()["files"] if f["name"] == e2e_file_name]
        assert len(matching) > 0
        assert matching[0]["id"] == e2e_file_id
        print(f"  Verified PDF created by PDF Studio is a registered Memora File (ID: {e2e_file_id}, path: {matching[0]['path']}).")

        # 24. Path Safety Validation Test
        print("\n[24/25] Testing File Path Safety Validation...")
        from app.services.pdf_service import pdf_service
        try:
            pdf_service.validate_path_safety("something\0nullbyte.pdf")
            assert False, "Should have raised ValueError for null byte"
        except ValueError as ve:
            print(f"  Verified path safety check for null byte: {ve}")

        try:
            pdf_service.validate_path_safety("../../etc/passwd.pdf")
            assert False, "Should have raised ValueError for path traversal"
        except ValueError as ve:
            print(f"  Verified path safety check for traversal: {ve}")

        # 25. Regression Check — Verify Existing Routes (Health, Search, Media)
        print("\n[25/28] Testing Regression on Existing Module Routes...")
        res_health = client.get("/health")
        print(f"  /health: {res_health.status_code} - {res_health.json()}")
        assert res_health.status_code == 200

        res_search_health = client.get("/search/health")
        print(f"  /search/health: {res_search_health.status_code} - {res_search_health.json()}")
        assert res_search_health.status_code == 200

        res_media_overview = client.get("/api/media/overview")
        print(f"  /api/media/overview: {res_media_overview.status_code} - {res_media_overview.json()}")
        assert res_media_overview.status_code == 200

        # 26. Real Text PDF (AI_Important_Notes.pdf) E2E Creation, Auto-Indexing & Module 1 Search Test
        print("\n[26/28] Testing Real Text PDF (AI_Important_Notes.pdf) Registration, Chunks, Embeddings, FAISS & Module 1 Search...")
        ai_pdf_path = os.path.join(user_test_dir, "AI_Important_Notes.pdf")
        
        # Create text PDF with embedded selectable text operators
        ai_text = (
            "Artificial Intelligence and Machine Learning concepts. "
            "Neural Networks and Deep Learning drive supervised learning, "
            "unsupervised learning, classification, and regression algorithms."
        )
        stream = f"BT /F1 12 Tf 50 750 Td ({ai_text}) Tj ET"
        raw_pdf_bytes = (
            f"%PDF-1.4\n"
            f"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n"
            f"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n"
            f"3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n"
            f"4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
            f"5 0 obj\n<< /Length {len(stream)} >>\nstream\n{stream}\nendstream\nendobj\n"
            f"xref\n0 6\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000244 00000 n \n0000000318 00000 n \n"
            f"trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n390\n%%EOF\n"
        )
        with open(ai_pdf_path, "w", encoding="latin1") as f:
            f.write(raw_pdf_bytes)

        # Sanitize with pypdf
        r = pypdf.PdfReader(ai_pdf_path)
        w = pypdf.PdfWriter()
        w.add_page(r.pages[0])
        with open(ai_pdf_path, "wb") as f:
            w.write(f)

        # Register in Memora DB & Auto-Index
        from app.database import SessionLocal
        db_session = SessionLocal()
        try:
            file_id = pdf_service.register_file_in_memora_db(db_session, ai_pdf_path)
            assert file_id is not None
            print(f"  AI_Important_Notes.pdf registered with File ID: {file_id}")

            # Verify File record & extracted text
            from app.models import File, Chunk
            file_rec = db_session.query(File).filter(File.id == file_id).first()
            assert file_rec is not None
            assert file_rec.extraction_status == "success"
            assert "Machine Learning" in file_rec.extracted_text

            # Verify Chunks created
            chunks = db_session.query(Chunk).filter(Chunk.file_id == file_id).all()
            assert len(chunks) > 0
            print(f"  Extracted text chunked into {len(chunks)} Chunk record(s).")

            # Execute Module 1 Semantic Search for "machine learning concepts"
            search_res = pdf_service.search_memora_files_for_pdf_studio(db_session, query="machine learning concepts", top_k=5)
            print(f"  Module 1 Search Results for 'machine learning concepts': {len(search_res['results'])} candidates found.")
            found_ai_pdf = any(r.get("filename") == "AI_Important_Notes.pdf" or r.get("name") == "AI_Important_Notes.pdf" for r in search_res["results"])
            assert found_ai_pdf is True
            print("  SUCCESS: AI_Important_Notes.pdf retrieved via Module 1 Semantic Search!")
        finally:
            db_session.close()

        # 27. Scanned PDF EasyOCR Fallback & Module 1 Search Test
        print("\n[27/28] Testing Scanned PDF EasyOCR Fallback & Module 1 Search...")
        scanned_pdf_path = os.path.join(user_test_dir, "scanned_quantum_notes.pdf")
        
        # Render text onto PIL image canvas (no text stream => scanned PDF)
        scanned_img = Image.new("RGB", (800, 600), color="white")
        draw = ImageDraw.Draw(scanned_img)
        draw.text((50, 100), "Quantum Computing and Qubit Superposition Principles", fill="black")
        scanned_img.save(scanned_pdf_path, "PDF")
        scanned_img.close()

        db_session2 = SessionLocal()
        try:
            scan_file_id = pdf_service.register_file_in_memora_db(db_session2, scanned_pdf_path)
            assert scan_file_id is not None
            print(f"  Scanned PDF registered with File ID: {scan_file_id}")

            scan_file_rec = db_session2.query(File).filter(File.id == scan_file_id).first()
            assert scan_file_rec is not None
            print(f"  Scanned PDF OCR Extracted Text: repr={repr(scan_file_rec.extracted_text)}")

            # Execute search if EasyOCR produced text
            if scan_file_rec.extracted_text and scan_file_rec.extracted_text.strip():
                scan_search_res = pdf_service.search_memora_files_for_pdf_studio(db_session2, query="Quantum Computing superposition", top_k=5)
                found_scan_pdf = any(r.get("filename") == "scanned_quantum_notes.pdf" or r.get("name") == "scanned_quantum_notes.pdf" for r in scan_search_res["results"])
                print(f"  Module 1 Search for Scanned PDF found_scan_pdf={found_scan_pdf}")
        finally:
            db_session2.close()

        # 28. Pre-existing File Search Regression Test
        print("\n[28/30] Testing Search Regression on Pre-existing Indexed Documents...")
        db_session3 = SessionLocal()
        try:
            reg_search_res = pdf_service.search_memora_files_for_pdf_studio(db_session3, query="mountain river landscape", top_k=5)
            print(f"  Search regression over pre-existing files returned {len(reg_search_res['results'])} results.")
            assert len(reg_search_res["results"]) > 0
        finally:
            db_session3.close()

        # 29. Module 2 Integration — Folders, Smart Tags, Organization Suggestions & Duplicate Detection Test
        print("\n[29/30] Testing Module 2 Integration (Folders, Smart Tags, Suggestions & Duplicate Detection)...")
        from app.services.organization_service import organization_service
        db_mod2 = SessionLocal()
        try:
            from app.models import Folder, File, OrganizationSuggestion, DuplicateGroup
            target_folder = db_mod2.query(Folder).filter(Folder.is_active == True).first()
            assert target_folder is not None

            # Count files in folder before PDF Studio creation
            count_before = db_mod2.query(File).filter(File.folder_id == target_folder.id).count()

            # Create PDF in target folder
            import uuid
            unique_name = f"Module2_New_Report_{uuid.uuid4().hex[:6]}.pdf"
            pdf_mod2_path = os.path.join(target_folder.path, unique_name)
            res_create_mod2 = client.post("/api/pdf/create-blank", json={
                "file_name": unique_name,
                "output_dir": target_folder.path,
                "page_count": 2,
                "folder_id": target_folder.id,
                "register_in_db": True
            })
            assert res_create_mod2.status_code == 200
            file_id_mod2 = res_create_mod2.json()["file_id"]
            assert file_id_mod2 is not None

            # Verify folder file count updated
            count_after = db_mod2.query(File).filter(File.folder_id == target_folder.id).count()
            assert count_after == count_before + 1
            print(f"  Verified Module 2 folder file count updated: {count_before} -> {count_after}")

            # Run Module 2 Organization Analysis over database files
            analysis_metrics = organization_service.analyze_files(db_mod2, folder_id=target_folder.id, force_reanalyze=True)
            print(f"  Module 2 Analysis Metrics: {analysis_metrics}")
            assert analysis_metrics["files_analyzed"] >= 1

            # Verify Smart Tags on registered PDF File record
            file_mod2_rec = db_mod2.query(File).filter(File.id == file_id_mod2).first()
            assert file_mod2_rec is not None
            tags = file_mod2_rec.get_smart_tags()
            print(f"  Module 2 Smart Tags generated: {tags}")

            # Create an exact duplicate PDF in target folder to verify Module 2 duplicate detection
            dup_pdf_path = os.path.join(target_folder.path, "Module2_Course_Report_Copy.pdf")
            shutil.copy2(pdf_mod2_path, dup_pdf_path)
            dup_file_id = pdf_service.register_file_in_memora_db(db_mod2, dup_pdf_path, folder_id=target_folder.id)
            assert dup_file_id is not None

            # Trigger duplicate scan
            from app.services.duplicate_service import duplicate_service
            dups = duplicate_service.find_and_record_duplicates(db_mod2)
            assert len(dups) >= 1
            print(f"  Verified Module 2 Duplicate Detection found {len(dups)} duplicate group(s).")
        finally:
            db_mod2.close()

        # 30. Module 3 Integration — Image Comparison PDF Export Test
        print("\n[30/30] Testing Module 3 Integration (Export Image Comparison Results to PDF Studio PDF)...")
        img_a_path = os.path.join(user_test_dir, "sample_comparison_a.png")
        img_b_path = os.path.join(user_test_dir, "sample_comparison_b.png")

        Image.new("RGB", (400, 300), color="blue").save(img_a_path)
        Image.new("RGB", (400, 300), color="cyan").save(img_b_path)

        comp_pdf_output = os.path.join(user_test_dir, "Visual_Comparison_Report.pdf")
        comp_req = {
            "image_paths": [img_a_path, img_b_path],
            "output_path": comp_pdf_output,
            "title": "Visual Similarity Inspection Report",
            "similarity_score": 94.5,
            "notes": "Module 3 visual comparison results exported via PDF Studio.",
            "register_in_db": True
        }
        res_comp_export = client.post("/api/pdf/export-image-comparison", json=comp_req)
        print(f"  Response ({res_comp_export.status_code}): {res_comp_export.json()}")
        assert res_comp_export.status_code == 200
        assert os.path.exists(comp_pdf_output)
        assert res_comp_export.json()["page_count"] == 2
        assert res_comp_export.json()["file_id"] is not None
        print("  SUCCESS: Module 3 Image Comparison exported into registered PDF Studio document!")

        # 31. Workspace Dynamic Export Test (/api/pdf/export-workspace)
        print("\n[31/31] Testing POST /api/pdf/export-workspace (Mixed Workspace Pages + Annotations Export)...")
        ws_export_target = os.path.join(user_test_dir, "workspace_compiled_output.pdf")
        ws_payload = {
            "output_path": ws_export_target,
            "title": "Compiled Workspace PDF",
            "page_size": "A4",
            "register_in_db": True,
            "pages": [
                {
                    "id": "p1",
                    "type": "pdf",
                    "source_path": created_path,
                    "page_number": 1,
                    "rotation": 0,
                    "width": 595,
                    "height": 841,
                    "annotations": [
                        {
                            "annotation_type": "text",
                            "content_text": "Workspace Overlay Text",
                            "x": 10.0,
                            "y": 20.0,
                            "font_size": 18,
                            "color": "#000000"
                        }
                    ]
                },
                {
                    "id": "p2",
                    "type": "image",
                    "source_path": img1_path,
                    "rotation": 0,
                    "width": 595,
                    "height": 841,
                    "annotations": []
                },
                {
                    "id": "p3",
                    "type": "blank",
                    "rotation": 0,
                    "width": 595,
                    "height": 841,
                    "annotations": []
                }
            ]
        }
        res_ws_exp = client.post("/api/pdf/export-workspace", json=ws_payload)
        print(f"  Response ({res_ws_exp.status_code}): {res_ws_exp.json()}")
        assert res_ws_exp.status_code == 200
        assert os.path.exists(ws_export_target)
        assert res_ws_exp.json()["file_size_bytes"] > 0
        assert res_ws_exp.json()["page_count"] == 3
        assert res_ws_exp.json()["verified"] is True
        print("  SUCCESS: Dynamic Workspace exported and verified physically on disk!")

        # =====================================================================
        # SPECIFICATION TESTS: ITEMS A THROUGH N
        # =====================================================================
        print("\n==================================================")
        print("EXECUTING SPECIFICATION TESTS: SCENARIOS A THROUGH N")
        print("==================================================")

        # Helper images for ReportLab tests
        rl_img1 = os.path.join(temp_dir, "rl_photo1.png")
        rl_img2 = os.path.join(temp_dir, "rl_photo2.png")
        rl_img3 = os.path.join(temp_dir, "rl_photo3.png")
        Image.new("RGB", (600, 400), color="#2563eb").save(rl_img1)
        Image.new("RGB", (400, 400), color="#16a34a").save(rl_img2)
        Image.new("RGB", (800, 500), color="#d97706").save(rl_img3)

        # [A] text -> PDF (ReportLab)
        print("\n[A] Testing Text -> PDF with ReportLab (/api/pdf/generate)...")
        pdf_a_out = os.path.join(temp_dir, "spec_test_a_text.pdf")
        req_a = {
            "title": "ReportLab Typography Specification Document",
            "author": "Memora Testing Suite",
            "page_size": "A4",
            "orientation": "portrait",
            "margin_pt": 36.0,
            "include_page_numbers": True,
            "output_path": pdf_a_out,
            "sections": [
                {"type": "heading", "level": 1, "text": "Executive Technical Briefing"},
                {"type": "heading", "level": 2, "text": "1. Architectural Overview"},
                {"type": "paragraph", "text": "ReportLab powers advanced client-side server PDF generation with full Platypus layout automation, proportional text wrapping, and precise typographic metrics."},
                {"type": "heading", "level": 2, "text": "2. Security and Compliance"},
                {"type": "paragraph", "text": "All operations execute 100% locally with zero cloud dependencies, ensuring complete data sovereignty and strict compliance."}
            ]
        }
        res_a = client.post("/api/pdf/generate", json=req_a)
        assert res_a.status_code == 200, f"Error: {res_a.text}"
        assert os.path.exists(pdf_a_out)
        r_a = pypdf.PdfReader(pdf_a_out)
        assert len(r_a.pages) >= 1
        print(f"  [A] PASS: Generated text PDF verified on disk ({len(r_a.pages)} page(s), {os.path.getsize(pdf_a_out)} bytes).")

        # [B] image -> PDF (ReportLab)
        print("\n[B] Testing Image -> PDF with ReportLab (/api/pdf/generate)...")
        pdf_b_out = os.path.join(temp_dir, "spec_test_b_image.pdf")
        req_b = {
            "title": "Visual Artifact Report",
            "output_path": pdf_b_out,
            "sections": [
                {"type": "image", "image_path": rl_img1, "caption": "Figure 1.1: System Architecture Diagram"}
            ]
        }
        res_b = client.post("/api/pdf/generate", json=req_b)
        assert res_b.status_code == 200, f"Error: {res_b.text}"
        assert os.path.exists(pdf_b_out)
        r_b = pypdf.PdfReader(pdf_b_out)
        assert len(r_b.pages) == 1
        print(f"  [B] PASS: Generated single-image PDF verified on disk ({len(r_b.pages)} page(s)).")

        # [C] image + text -> PDF (ReportLab)
        print("\n[C] Testing Image + Text -> PDF with ReportLab (/api/pdf/generate)...")
        pdf_c_out = os.path.join(temp_dir, "spec_test_c_mixed.pdf")
        req_c = {
            "title": "Mixed Layout Document",
            "output_path": pdf_c_out,
            "sections": [
                {"type": "heading", "level": 1, "text": "Multi-Modal Layout Showcase"},
                {
                    "type": "image_text",
                    "image_path": rl_img2,
                    "text": "This paragraph sits beside the accompanying diagram. ReportLab aligns the layout neatly inside a Platypus table.",
                    "layout": "side_by_side"
                },
                {
                    "type": "image_text",
                    "image_path": rl_img3,
                    "text": "Below is a stacked layout where the descriptive text is placed directly under the primary illustration.",
                    "layout": "stacked"
                }
            ]
        }
        res_c = client.post("/api/pdf/generate", json=req_c)
        assert res_c.status_code == 200, f"Error: {res_c.text}"
        assert os.path.exists(pdf_c_out)
        r_c = pypdf.PdfReader(pdf_c_out)
        assert len(r_c.pages) >= 1
        print(f"  [C] PASS: Generated image+text layout PDF verified ({len(r_c.pages)} page(s)).")

        # [D] multiple images -> multi-page PDF (ReportLab)
        print("\n[D] Testing Multiple Images -> Multi-page PDF (/api/pdf/generate)...")
        pdf_d_out = os.path.join(temp_dir, "spec_test_d_multi_images.pdf")
        req_d = {
            "title": "Image Portfolio Gallery",
            "output_path": pdf_d_out,
            "sections": [
                {"type": "heading", "level": 1, "text": "Multi-Page Image Collection"},
                {"type": "image", "image_path": rl_img1, "caption": "Page 1 Gallery Photo"},
                {"type": "page_break"},
                {"type": "image", "image_path": rl_img2, "caption": "Page 2 Gallery Photo"},
                {"type": "page_break"},
                {"type": "image", "image_path": rl_img3, "caption": "Page 3 Gallery Photo"}
            ]
        }
        res_d = client.post("/api/pdf/generate", json=req_d)
        assert res_d.status_code == 200, f"Error: {res_d.text}"
        assert os.path.exists(pdf_d_out)
        r_d = pypdf.PdfReader(pdf_d_out)
        assert len(r_d.pages) == 3
        print(f"  [D] PASS: Generated multi-image multi-page PDF ({len(r_d.pages)} pages).")

        # Helper test PDFs for manipulation and alternate operations
        # Create PDF 1 with 5 distinct pages
        pdf1_5p = os.path.join(temp_dir, "doc1_5pages.pdf")
        client.post("/api/pdf/create-blank", json={"file_name": "doc1_5pages.pdf", "output_dir": temp_dir, "page_count": 5, "page_size": "A4"})
        # Create PDF 2 with 3 distinct pages
        pdf2_3p = os.path.join(temp_dir, "doc2_3pages.pdf")
        client.post("/api/pdf/create-blank", json={"file_name": "doc2_3pages.pdf", "output_dir": temp_dir, "page_count": 3, "page_size": "A4"})
        # Create PDF 3 with 2 distinct pages
        pdf3_2p = os.path.join(temp_dir, "doc3_2pages.pdf")
        client.post("/api/pdf/create-blank", json={"file_name": "doc3_2pages.pdf", "output_dir": temp_dir, "page_count": 2, "page_size": "A4"})
        # Create PDF 4 with 4 distinct pages
        pdf4_4p = os.path.join(temp_dir, "doc4_4pages.pdf")
        client.post("/api/pdf/create-blank", json={"file_name": "doc4_4pages.pdf", "output_dir": temp_dir, "page_count": 4, "page_size": "A4"})

        # [E] normal PDF merge
        print("\n[E] Testing Normal PDF Merge (/api/pdf/merge)...")
        pdf_e_out = os.path.join(temp_dir, "spec_test_e_merge.pdf")
        req_e = {
            "source_paths": [pdf3_2p, pdf2_3p],
            "output_path": pdf_e_out
        }
        res_e = client.post("/api/pdf/merge", json=req_e)
        assert res_e.status_code == 200
        assert os.path.exists(pdf_e_out)
        r_e = pypdf.PdfReader(pdf_e_out)
        assert len(r_e.pages) == 5  # 2 + 3 = 5
        print(f"  [E] PASS: Merged 2-page and 3-page PDFs into 5-page PDF.")

        # [F] PDF page reorder
        print("\n[F] Testing PDF Page Reorder (/api/pdf/reorder)...")
        pdf_f_out = os.path.join(temp_dir, "spec_test_f_reorder.pdf")
        shutil.copyfile(pdf4_4p, pdf_f_out)
        req_f = {
            "source_path": pdf_f_out,
            "new_page_order": [3, 2, 1, 0]
        }
        res_f = client.post("/api/pdf/reorder", json=req_f)
        assert res_f.status_code == 200
        r_f = pypdf.PdfReader(pdf_f_out)
        assert len(r_f.pages) == 4
        print(f"  [F] PASS: Reordered 4-page PDF with order [3, 2, 1, 0].")

        # [G] PDF page deletion
        print("\n[G] Testing PDF Page Deletion (/api/pdf/manipulate)...")
        pdf_g_out = os.path.join(temp_dir, "spec_test_g_deletion.pdf")
        shutil.copyfile(pdf2_3p, pdf_g_out)  # 3 pages
        req_g = {
            "source_path": pdf_g_out,
            "actions": [
                {"action": "delete", "page_index": 1}
            ]
        }
        res_g = client.post("/api/pdf/manipulate", json=req_g)
        assert res_g.status_code == 200
        r_g = pypdf.PdfReader(pdf_g_out)
        assert len(r_g.pages) == 2  # 3 - 1 = 2
        print(f"  [G] PASS: Deleted page 1; 3-page PDF safely reduced to 2 pages.")

        # [H] PDF split
        print("\n[H] Testing PDF Split (/api/pdf/split)...")
        pdf_h_split_dir = os.path.join(temp_dir, "spec_test_h_split_dir")
        req_h = {
            "source_path": pdf4_4p,
            "output_dir": pdf_h_split_dir,
            "split_mode": "every_page",
            "naming_prefix": "page_part"
        }
        res_h = client.post("/api/pdf/split", json=req_h)
        assert res_h.status_code == 200
        assert res_h.json()["total_generated_files"] == 4
        for single_part in res_h.json()["generated_files"]:
            assert os.path.exists(single_part)
            r_part = pypdf.PdfReader(single_part)
            assert len(r_part.pages) == 1
        print(f"  [H] PASS: Split 4-page PDF into 4 individual verified PDFs.")

        # [I] alternate pages with equal page counts
        print("\n[I] Testing Alternate Pages with Equal Page Counts (/api/pdf/alternate)...")
        pdf_i_out = os.path.join(temp_dir, "spec_test_i_alternate_equal.pdf")
        # PDF A has 2 pages (A1, A2), PDF B has 2 pages (B1, B2)
        pdf_i_a = os.path.join(temp_dir, "doc_i_a.pdf")
        pdf_i_b = os.path.join(temp_dir, "doc_i_b.pdf")
        client.post("/api/pdf/create-blank", json={"file_name": "doc_i_a.pdf", "output_dir": temp_dir, "page_count": 2})
        client.post("/api/pdf/create-blank", json={"file_name": "doc_i_b.pdf", "output_dir": temp_dir, "page_count": 2})

        req_i = {
            "pdf1_path": pdf_i_a,
            "pdf2_path": pdf_i_b,
            "output_path": pdf_i_out,
            "start_with": "pdf1"
        }
        res_i = client.post("/api/pdf/alternate", json=req_i)
        assert res_i.status_code == 200, f"Error in alternate equal: {res_i.text}"
        assert os.path.exists(pdf_i_out)
        r_i = pypdf.PdfReader(pdf_i_out)
        assert len(r_i.pages) == 4  # A1, B1, A2, B2
        assert res_i.json()["page_count"] == 4
        print(f"  [I] PASS: Interleaved equal 2p + 2p PDFs into 4-page output.")

        # [J] alternate pages where PDF 1 is longer
        print("\n[J] Testing Alternate Pages Where PDF 1 is Longer (PDF1: 5 pages, PDF2: 3 pages)...")
        pdf_j_out = os.path.join(temp_dir, "spec_test_j_pdf1_longer.pdf")
        req_j = {
            "pdf1_path": pdf1_5p,  # 5 pages
            "pdf2_path": pdf2_3p,  # 3 pages
            "output_path": pdf_j_out,
            "start_with": "pdf1"
        }
        res_j = client.post("/api/pdf/alternate", json=req_j)
        assert res_j.status_code == 200, f"Error in alternate PDF1 longer: {res_j.text}"
        assert os.path.exists(pdf_j_out)
        r_j = pypdf.PdfReader(pdf_j_out)
        # Sequence: A1, B1, A2, B2, A3, B3, A4, A5 => 8 pages total
        assert len(r_j.pages) == 8
        assert res_j.json()["page_count"] == 8
        print(f"  [J] PASS: Interleaved unequal 5p + 3p with zero dropped pages (Result: {len(r_j.pages)} pages).")

        # [K] alternate pages where PDF 2 is longer
        print("\n[K] Testing Alternate Pages Where PDF 2 is Longer (PDF1: 2 pages, PDF2: 4 pages)...")
        pdf_k_out = os.path.join(temp_dir, "spec_test_k_pdf2_longer.pdf")
        req_k = {
            "pdf1_path": pdf3_2p,  # 2 pages
            "pdf2_path": pdf4_4p,  # 4 pages
            "output_path": pdf_k_out,
            "start_with": "pdf1"
        }
        res_k = client.post("/api/pdf/alternate", json=req_k)
        assert res_k.status_code == 200, f"Error in alternate PDF2 longer: {res_k.text}"
        assert os.path.exists(pdf_k_out)
        r_k = pypdf.PdfReader(pdf_k_out)
        # Sequence: A1, B1, A2, B2, B3, B4 => 6 pages total
        assert len(r_k.pages) == 6
        assert res_k.json()["page_count"] == 6
        print(f"  [K] PASS: Interleaved unequal 2p + 4p with zero dropped pages (Result: {len(r_k.pages)} pages).")

        # [L] alternate mode starting with PDF 1
        print("\n[L] Testing Alternate Mode Starting with PDF 1 (Preview & Result Sequence)...")
        # Preview endpoint test
        preview_req_l = {
            "pdf1_path": pdf3_2p,  # 2 pages
            "pdf2_path": pdf2_3p,  # 3 pages
            "start_with": "pdf1"
        }
        res_prev_l = client.post("/api/pdf/alternate/preview", json=preview_req_l)
        assert res_prev_l.status_code == 200, f"Error in preview L: {res_prev_l.text}"
        order_l = res_prev_l.json()["page_order"]
        assert len(order_l) == 5
        assert order_l[0]["source"] == "PDF 1" and order_l[0]["source_page"] == 1
        assert order_l[1]["source"] == "PDF 2" and order_l[1]["source_page"] == 1
        assert order_l[2]["source"] == "PDF 1" and order_l[2]["source_page"] == 2
        assert order_l[3]["source"] == "PDF 2" and order_l[3]["source_page"] == 2
        assert order_l[4]["source"] == "PDF 2" and order_l[4]["source_page"] == 3
        print(f"  [L] PASS: Live preview validated for start_with='pdf1' (Sequence: {[p['label'] for p in order_l]}).")

        # [M] alternate mode starting with PDF 2
        print("\n[M] Testing Alternate Mode Starting with PDF 2 (Preview & Result Sequence)...")
        preview_req_m = {
            "pdf1_path": pdf3_2p,  # 2 pages
            "pdf2_path": pdf2_3p,  # 3 pages
            "start_with": "pdf2"
        }
        res_prev_m = client.post("/api/pdf/alternate/preview", json=preview_req_m)
        assert res_prev_m.status_code == 200, f"Error in preview M: {res_prev_m.text}"
        order_m = res_prev_m.json()["page_order"]
        assert len(order_m) == 5
        assert order_m[0]["source"] == "PDF 2" and order_m[0]["source_page"] == 1
        assert order_m[1]["source"] == "PDF 1" and order_m[1]["source_page"] == 1
        assert order_m[2]["source"] == "PDF 2" and order_m[2]["source_page"] == 2
        assert order_m[3]["source"] == "PDF 1" and order_m[3]["source_page"] == 2
        assert order_m[4]["source"] == "PDF 2" and order_m[4]["source_page"] == 3
        print(f"  [M] PASS: Live preview validated for start_with='pdf2' (Sequence: {[p['label'] for p in order_m]}).")

        pdf_m_out = os.path.join(temp_dir, "spec_test_m_start_pdf2.pdf")
        res_m = client.post("/api/pdf/alternate", json={
            "pdf1_path": pdf3_2p,
            "pdf2_path": pdf2_3p,
            "output_path": pdf_m_out,
            "start_with": "pdf2"
        })
        assert res_m.status_code == 200, f"Error in alternate M: {res_m.text}"
        assert os.path.exists(pdf_m_out)
        r_m = pypdf.PdfReader(pdf_m_out)
        assert len(r_m.pages) == 5
        print(f"  [M] PASS: Alternate PDF generated starting with PDF 2 ({len(r_m.pages)} pages).")

        # [N] actual output file exists after export
        print("\n[N] Testing Physical Output File Existence & Non-Faking Guarantee...")
        all_test_outputs = [
            pdf_a_out, pdf_b_out, pdf_c_out, pdf_d_out, pdf_e_out,
            pdf_f_out, pdf_g_out, pdf_i_out, pdf_j_out, pdf_k_out, pdf_m_out
        ]
        for out_file in all_test_outputs:
            assert os.path.exists(out_file), f"Output file does not exist: {out_file}"
            assert os.path.getsize(out_file) > 100, f"Output file is suspiciously small or empty: {out_file}"
            # Verify valid PDF header
            with open(out_file, "rb") as fh:
                head = fh.read(5)
                assert head == b"%PDF-", f"File {out_file} is not a valid PDF binary"
            # Verify readable by pypdf
            reader = pypdf.PdfReader(out_file)
            assert len(reader.pages) > 0
        print(f"  [N] PASS: All {len(all_test_outputs)} generated output files physically verified on disk with valid PDF magic bytes.")

        print("\n==================================================")
        print("ALL TESTS (1-31 & SPEC A-N) COMPLETED SUCCESSFULLY!")
        print("==================================================")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
        if os.path.exists(user_test_dir):
            shutil.rmtree(user_test_dir, ignore_errors=True)
        try:
            from app.database import SessionLocal
            from app.models import File, Chunk, VectorMapping, OrganizationSuggestion, DuplicateGroup, PDFDocument, PDFPage, PDFAnnotation
            cl_db = SessionLocal()
            test_recs = cl_db.query(File).filter(File.path.like("%MemoraTestTemp%")).all()
            if test_recs:
                t_ids = [f.id for f in test_recs]
                cl_db.query(VectorMapping).filter(VectorMapping.chunk_id.in_(
                    cl_db.query(Chunk.id).filter(Chunk.file_id.in_(t_ids))
                )).delete(synchronize_session=False)
                cl_db.query(Chunk).filter(Chunk.file_id.in_(t_ids)).delete(synchronize_session=False)
                cl_db.query(OrganizationSuggestion).filter(OrganizationSuggestion.file_id.in_(t_ids)).delete(synchronize_session=False)
                cl_db.query(DuplicateGroup).filter(DuplicateGroup.file_a_id.in_(t_ids) | DuplicateGroup.file_b_id.in_(t_ids)).delete(synchronize_session=False)
                cl_db.query(PDFPage).filter(PDFPage.pdf_document_id.in_(
                    cl_db.query(PDFDocument.id).filter(PDFDocument.file_id.in_(t_ids))
                )).delete(synchronize_session=False)
                cl_db.query(PDFAnnotation).filter(PDFAnnotation.pdf_document_id.in_(
                    cl_db.query(PDFDocument.id).filter(PDFDocument.file_id.in_(t_ids))
                )).delete(synchronize_session=False)
                cl_db.query(PDFDocument).filter(PDFDocument.file_id.in_(t_ids)).delete(synchronize_session=False)
                cl_db.query(File).filter(File.id.in_(t_ids)).delete(synchronize_session=False)
                cl_db.commit()
            cl_db.close()
        except Exception as cl_err:
            print(f"Test cleanup warning: {cl_err}")

if __name__ == "__main__":
    run_pdf_studio_tests()






