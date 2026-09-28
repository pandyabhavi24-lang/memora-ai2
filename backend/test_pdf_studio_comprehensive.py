import os
import sys
import tempfile
import unittest
from PIL import Image, ImageDraw
import pypdf

# Ensure backend directory in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from app.main import app
from app.services.pdf_service import pdf_service

class PDFStudioComprehensiveTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.temp_dir = tempfile.mkdtemp(prefix="pdf_studio_test_")

    def create_test_image(self, filename, color, text="Test Image"):
        img_path = os.path.join(self.temp_dir, filename)
        img = Image.new("RGB", (400, 300), color=color)
        draw = ImageDraw.Draw(img)
        draw.text((20, 20), text, fill=(255, 255, 255))
        img.save(img_path, "PNG")
        return img_path

    def test_01_backend_health(self):
        print("\n--- TEST 1: Health & Diagnostics ---")
        res = self.client.get("/api/pdf/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        print("Health response:", data)
        self.assertEqual(data["status"], "ready")
        self.assertTrue(data["reportlab_available"])
        self.assertTrue(data["pypdf_available"])
        self.assertTrue(data["pil_available"])

    def test_02_text_pdf_export_and_verification(self):
        print("\n--- TEST 2: Text PDF (Memora AI PDF Studio Test) ---")
        out_pdf = os.path.join(self.temp_dir, "test_text_doc.pdf")
        payload = {
            "output_path": out_pdf,
            "pages": [
                {
                    "id": "p1",
                    "type": "blank",
                    "width": 595.28,
                    "height": 841.89,
                    "elements": [
                        {
                            "id": "txt_1",
                            "type": "text",
                            "x": 50.0,
                            "y": 100.0,
                            "width": 400.0,
                            "height": 50.0,
                            "text": "Memora AI PDF Studio Test",
                            "fontSize": 24,
                            "fontWeight": "bold",
                            "textAlign": "left",
                            "color": "#1e293b"
                        }
                    ]
                }
            ],
            "page_size": "A4",
            "orientation": "portrait",
            "register_in_db": False
        }
        res = self.client.post("/api/pdf/export-workspace", json=payload)
        self.assertEqual(res.status_code, 200, f"Export failed: {res.text}")
        self.assertTrue(os.path.exists(out_pdf))
        self.assertGreater(os.path.getsize(out_pdf), 0)

        # Verify with pypdf
        reader = pypdf.PdfReader(out_pdf)
        self.assertEqual(len(reader.pages), 1)
        extracted = reader.pages[0].extract_text()
        print("Extracted text:", repr(extracted))
        self.assertIn("Memora AI PDF Studio Test", extracted)
        print("Text PDF verification PASSED.")

    def test_03_image_pdf_export(self):
        print("\n--- TEST 3: Image PDF Export ---")
        img_path = self.create_test_image("sample_image.png", (40, 120, 200), "Real Photo 1")
        out_pdf = os.path.join(self.temp_dir, "test_image_doc.pdf")

        payload = {
            "output_path": out_pdf,
            "pages": [
                {
                    "id": "p1",
                    "type": "blank",
                    "width": 595.28,
                    "height": 841.89,
                    "elements": [
                        {
                            "id": "img_1",
                            "type": "image",
                            "x": 100.0,
                            "y": 150.0,
                            "width": 300.0,
                            "height": 225.0,
                            "imagePath": img_path,
                            "source": img_path,
                            "fileName": "sample_image.png"
                        }
                    ]
                }
            ],
            "page_size": "A4",
            "orientation": "portrait",
            "register_in_db": False
        }
        res = self.client.post("/api/pdf/export-workspace", json=payload)
        self.assertEqual(res.status_code, 200, f"Image export failed: {res.text}")
        self.assertTrue(os.path.exists(out_pdf))
        self.assertGreater(os.path.getsize(out_pdf), 1000)

        reader = pypdf.PdfReader(out_pdf)
        self.assertEqual(len(reader.pages), 1)
        self.assertGreater(len(reader.pages[0].images), 0)
        print("Image PDF verification PASSED. Page contains embedded image.")

    def test_04_five_image_multipage_pdf(self):
        print("\n--- TEST 4: 5-Image Multi-Page PDF ---")
        images = [
            self.create_test_image(f"img_{i+1}.png", (20 * (i+1), 40 * (i+1), 50), f"Image #{i+1}")
            for i in range(5)
        ]
        out_pdf = os.path.join(self.temp_dir, "five_images_doc.pdf")

        pages = []
        for idx, img_p in enumerate(images):
            pages.append({
                "id": f"page_{idx+1}",
                "type": "image",
                "width": 595.28,
                "height": 841.89,
                "elements": [
                    {
                        "id": f"img_elem_{idx+1}",
                        "type": "image",
                        "x": 36.0,
                        "y": 36.0,
                        "width": 523.28,
                        "height": 769.89,
                        "imagePath": img_p,
                        "source": img_p,
                        "fileName": f"img_{idx+1}.png"
                    }
                ]
            })

        payload = {
            "output_path": out_pdf,
            "pages": pages,
            "page_size": "A4",
            "orientation": "portrait",
            "register_in_db": False
        }
        res = self.client.post("/api/pdf/export-workspace", json=payload)
        self.assertEqual(res.status_code, 200, f"5-image export failed: {res.text}")
        self.assertTrue(os.path.exists(out_pdf))

        reader = pypdf.PdfReader(out_pdf)
        self.assertEqual(len(reader.pages), 5)
        for idx, page in enumerate(reader.pages):
            self.assertGreater(len(page.images), 0, f"Page {idx+1} must contain image")
        print(f"5-Image Multi-Page PDF verification PASSED. Generated 5 pages with images.")

    def test_05_image_with_subtitle_and_description(self):
        print("\n--- TEST 5: Image + Subtitle + Description ---")
        img_path = self.create_test_image("vacation.png", (220, 100, 50), "Vacation Sunset")
        out_pdf = os.path.join(self.temp_dir, "image_subtitle_doc.pdf")

        payload = {
            "output_path": out_pdf,
            "pages": [
                {
                    "id": "page_vacation",
                    "type": "blank",
                    "width": 595.28,
                    "height": 841.89,
                    "elements": [
                        {
                            "id": "img_main",
                            "type": "image",
                            "x": 100.0,
                            "y": 80.0,
                            "width": 395.28,
                            "height": 260.0,
                            "imagePath": img_path,
                            "source": img_path
                        },
                        {
                            "id": "txt_sub",
                            "type": "text",
                            "x": 100.0,
                            "y": 360.0,
                            "width": 395.28,
                            "height": 40.0,
                            "text": "My Vacation",
                            "fontSize": 20,
                            "fontWeight": "bold",
                            "textAlign": "center",
                            "color": "#0f172a"
                        },
                        {
                            "id": "txt_desc",
                            "type": "text",
                            "x": 100.0,
                            "y": 410.0,
                            "width": 395.28,
                            "height": 60.0,
                            "text": "Beautiful evening trip.",
                            "fontSize": 14,
                            "fontWeight": "normal",
                            "fontStyle": "italic",
                            "textAlign": "center",
                            "color": "#475569"
                        }
                    ]
                }
            ],
            "page_size": "A4",
            "orientation": "portrait",
            "register_in_db": False
        }
        res = self.client.post("/api/pdf/export-workspace", json=payload)
        self.assertEqual(res.status_code, 200, f"Export failed: {res.text}")

        reader = pypdf.PdfReader(out_pdf)
        self.assertEqual(len(reader.pages), 1)
        self.assertGreater(len(reader.pages[0].images), 0)
        extracted = reader.pages[0].extract_text()
        self.assertIn("My Vacation", extracted)
        self.assertIn("Beautiful evening trip.", extracted)
        print("Image + Subtitle + Description verification PASSED.")

    def test_06_drafts_lifecycle(self):
        print("\n--- TEST 6: Drafts Lifecycle (Save, List, Delete) ---")
        draft_id = "draft_unit_test_1"
        draft_payload = {
            "id": draft_id,
            "name": "My Draft Document",
            "document_json": '{"title":"My Draft Document","pages":[{"id":"p1"}]}',
            "page_count": 1
        }
        res_save = self.client.post("/api/pdf/drafts", json=draft_payload)
        self.assertEqual(res_save.status_code, 200)

        res_list = self.client.get("/api/pdf/drafts")
        self.assertEqual(res_list.status_code, 200)
        drafts = res_list.json()
        matching = [d for d in drafts if d["id"] == draft_id]
        self.assertTrue(len(matching) > 0)
        self.assertEqual(matching[0]["name"], "My Draft Document")

        res_del = self.client.delete(f"/api/pdf/drafts/{draft_id}")
        self.assertEqual(res_del.status_code, 200)
        print("Drafts lifecycle verification PASSED.")

    def test_07_merge_and_alternate_pages(self):
        print("\n--- TEST 7: Merge & Alternate Pages ---")
        # Create PDF 1 (2 pages)
        pdf1_path = os.path.join(self.temp_dir, "doc1.pdf")
        pdf_service.create_blank_pdf(file_name="doc1.pdf", output_dir=self.temp_dir, page_count=2, register_in_db=False)

        # Create PDF 2 (2 pages)
        pdf2_path = os.path.join(self.temp_dir, "doc2.pdf")
        pdf_service.create_blank_pdf(file_name="doc2.pdf", output_dir=self.temp_dir, page_count=2, register_in_db=False)

        # Merge
        merged_out = os.path.join(self.temp_dir, "merged.pdf")
        res_merge = self.client.post("/api/pdf/merge", json={
            "source_paths": [pdf1_path, pdf2_path],
            "output_path": merged_out,
            "register_in_db": False
        })
        self.assertEqual(res_merge.status_code, 200)
        reader_merged = pypdf.PdfReader(merged_out)
        self.assertEqual(len(reader_merged.pages), 4)

        # Alternate
        alt_out = os.path.join(self.temp_dir, "alternated.pdf")
        res_alt = self.client.post("/api/pdf/alternate", json={
            "pdf1_path": pdf1_path,
            "pdf2_path": pdf2_path,
            "start_with": "pdf1",
            "output_path": alt_out,
            "register_in_db": False
        })
        self.assertEqual(res_alt.status_code, 200)
        reader_alt = pypdf.PdfReader(alt_out)
        self.assertEqual(len(reader_alt.pages), 4)
        print("Merge & Alternate verification PASSED.")

    def test_08_email_and_whatsapp_status(self):
        print("\n--- TEST 8: Email & WhatsApp Status Endpoints ---")
        res_email = self.client.get("/api/pdf/email/status")
        self.assertEqual(res_email.status_code, 200)
        data = res_email.json()
        self.assertIn("configured", data)
        self.assertIn("connected", data)
        self.assertIn("status", data)
        print("Email status:", data)

        res_wa = self.client.get("/api/pdf/whatsapp/status")
        self.assertEqual(res_wa.status_code, 200)
        print("WhatsApp status:", res_wa.json())

    def test_09_gmail_oauth_lifecycle(self):
        print("\n--- TEST 9: Gmail OAuth Configuration & Auth URL Lifecycle ---")
        # 1. Test Auth URL with environment variables
        os.environ["GOOGLE_CLIENT_ID"] = "test-client-id.apps.googleusercontent.com"
        os.environ["GOOGLE_CLIENT_SECRET"] = "test-client-secret-123"

        res_status = self.client.get("/api/pdf/email/status")
        self.assertEqual(res_status.status_code, 200)
        self.assertTrue(res_status.json()["configured"])

        res_auth_url = self.client.get("/api/pdf/email/auth-url")
        self.assertEqual(res_auth_url.status_code, 200)
        auth_data = res_auth_url.json()
        self.assertTrue(auth_data["configured"])
        self.assertIn("accounts.google.com", auth_data["auth_url"])
        self.assertIn("gmail.send", auth_data["auth_url"])
        print(f"Generated Google OAuth URL: {auth_data['auth_url'][:80]}...")

        # 2. Test Disconnect endpoint
        res_disc = self.client.post("/api/pdf/email/disconnect")
        self.assertEqual(res_disc.status_code, 200)
        self.assertEqual(res_disc.json()["status"], "success")

        # 3. Clean up test environment variables
        os.environ.pop("GOOGLE_CLIENT_ID", None)
        os.environ.pop("GOOGLE_CLIENT_SECRET", None)
        print("Gmail OAuth lifecycle test PASSED.")


if __name__ == "__main__":
    unittest.main()

