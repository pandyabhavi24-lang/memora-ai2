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
    print(f"\nCreated temporary workspace: {temp_dir}")

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
            "output_dir": temp_dir,
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
        ai_pdf_path = os.path.join(temp_dir, "AI_Important_Notes.pdf")
        
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
        scanned_pdf_path = os.path.join(temp_dir, "scanned_quantum_notes.pdf")
        
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
            pdf_mod2_path = os.path.join(target_folder.path, "Module2_New_Report_Test.pdf")
            res_create_mod2 = client.post("/api/pdf/create-blank", json={
                "file_name": "Module2_New_Report_Test.pdf",
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
        img_a_path = os.path.join(temp_dir, "sample_comparison_a.png")
        img_b_path = os.path.join(temp_dir, "sample_comparison_b.png")

        Image.new("RGB", (400, 300), color="blue").save(img_a_path)
        Image.new("RGB", (400, 300), color="cyan").save(img_b_path)

        comp_pdf_output = os.path.join(temp_dir, "Visual_Comparison_Report.pdf")
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

        print("\n==================================================")
        print("ALL 30 PDF STUDIO MEMORA INTEGRATION TESTS PASSED!")
        print("==================================================")

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    run_pdf_studio_tests()





