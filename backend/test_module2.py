import os
import shutil
import unittest
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import Folder, File, Chunk, OrganizationCategory, OrganizationSuggestion, DuplicateGroup, FileOperation
from app.services.classification_service import classification_service
from app.services.duplicate_service import duplicate_service
from app.services.organization_service import organization_service

class TestModule2Backend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Create an in-memory or temp SQLite database for unit testing
        cls.test_db_path = os.path.join(os.path.dirname(__file__), "test_memora_module2.db")
        cls.engine = create_engine(f"sqlite:///{cls.test_db_path}", connect_args={"check_same_thread": False})
        Base.metadata.create_all(bind=cls.engine)
        cls.Session = sessionmaker(autocommit=False, autoflush=False, bind=cls.engine)

        # Setup temporary test directory for safe filesystem operations
        cls.test_dir = os.path.join(os.path.dirname(__file__), "tmp_test_workspace")
        os.makedirs(cls.test_dir, exist_ok=True)

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=cls.engine)
        if os.path.exists(cls.test_db_path):
            try:
                os.remove(cls.test_db_path)
            except Exception:
                pass
        if os.path.exists(cls.test_dir):
            try:
                shutil.rmtree(cls.test_dir)
            except Exception:
                pass

    def setUp(self):
        self.db = self.Session()

    def tearDown(self):
        self.db.close()

    def test_01_category_seeding(self):
        """Test category seeding & default category availability"""
        categories = organization_service.seed_categories(self.db)
        self.assertTrue(len(categories) >= 9)
        names = [c.name for c in categories]
        self.assertIn("Work", names)
        self.assertIn("Education", names)
        self.assertIn("Certificates", names)
        self.assertIn("Finance", names)

    def test_02_hybrid_classification(self):
        """Test hybrid classification engine logic"""
        cat, conf, level, reason = classification_service.classify_file(
            filename="resume_john_doe.pdf",
            extension=".pdf",
            extracted_text="Professional summary, work experience, skills, computer science degree"
        )
        self.assertEqual(cat, "Work")
        self.assertGreaterEqual(conf, 90)
        self.assertEqual(level, "High")
        self.assertIn("Resume", reason)

        cat2, conf2, level2, reason2 = classification_service.classify_file(
            filename="invoice_august_2026.pdf",
            extension=".pdf",
            extracted_text="Invoice number 90210, billing details, total amount due $450"
        )
        self.assertEqual(cat2, "Finance")
        self.assertGreaterEqual(conf2, 90)

    def test_03_analysis_and_suggestions(self):
        """Test scanning database files and generating organization suggestions"""
        # Create test folder & files in DB
        folder = Folder(path=self.test_dir, name="Test Folder")
        self.db.add(folder)
        self.db.flush()

        f1_path = os.path.join(self.test_dir, "python_notes.pdf")
        with open(f1_path, "w") as fp:
            fp.write("Academic notes on Python data structures and algorithms.")

        file1 = File(
            folder_id=folder.id,
            path=f1_path,
            name="python_notes.pdf",
            extension=".pdf",
            size=100,
            modified_at=datetime.utcnow(),
            file_hash="hash_notes_123",
            extracted_text="Academic notes on Python data structures and algorithms."
        )
        self.db.add(file1)
        self.db.commit()

        summary = organization_service.analyze_files(self.db, folder_id=folder.id)
        self.assertGreaterEqual(summary["files_analyzed"], 1)
        self.assertGreaterEqual(summary["suggestions_generated"], 1)

        suggestions = organization_service.get_suggestions(self.db)
        self.assertTrue(len(suggestions) > 0)
        first_sug = suggestions[0]
        self.assertIn("filename", first_sug)
        self.assertIn("suggestedCategory", first_sug)

    def test_04_suggestion_status_updates(self):
        """Test accepting, rejecting, and editing suggestions"""
        sug = self.db.query(OrganizationSuggestion).first()
        self.assertIsNotNone(sug)

        # Accept
        updated = organization_service.update_suggestion(self.db, sug.id, status="accepted")
        self.assertEqual(updated.status, "accepted")

        # Edit
        updated2 = organization_service.update_suggestion(self.db, sug.id, category_name="Projects")
        self.assertEqual(updated2.status, "edited")
        self.assertEqual(updated2.category.name, "Projects")

    def test_05_preview_generation(self):
        """Test preview generation without disk modification"""
        preview = organization_service.generate_preview(self.db)
        self.assertTrue(isinstance(preview, list))
        if len(preview) > 0:
            item = preview[0]
            self.assertIn("currentPath", item)
            self.assertIn("proposedPath", item)
            # Verify source file still exists at current location
            self.assertTrue(os.path.exists(item["currentPath"]))

    def test_06_safe_file_apply(self):
        """Test safe file organization move with conflict resolution & DB path update"""
        sug = self.db.query(OrganizationSuggestion).first()
        sug.status = "accepted"
        self.db.commit()

        src_path = sug.file.path
        self.assertTrue(os.path.exists(src_path))

        res = organization_service.apply_organization(self.db)
        self.assertEqual(res["status"], "success")
        self.assertGreaterEqual(res["files_moved"], 1)

        # Verify file moved on disk to target category folder
        new_db_file = self.db.query(File).filter(File.id == sug.file_id).first()
        self.assertTrue(os.path.exists(new_db_file.path))
        self.assertNotEqual(src_path, new_db_file.path)
        self.assertIn(sug.category.name, new_db_file.path)

        # Verify operation history record
        op = self.db.query(FileOperation).filter(FileOperation.file_id == sug.file_id).first()
        self.assertIsNotNone(op)
        self.assertEqual(op.status, "completed")

    def test_06b_idempotency_and_category_switch(self):
        """Test repeated apply idempotency and category switching without nested paths"""
        sug = self.db.query(OrganizationSuggestion).first()
        sug.status = "accepted"
        self.db.commit()

        initial_path = sug.file.path

        # 1. Repeated apply with same category - should move 0 files and not create nested path
        res_repeat = organization_service.apply_organization(self.db)
        self.assertEqual(res_repeat["files_moved"], 0)
        self.assertEqual(sug.file.path, initial_path)
        self.assertNotIn(f"{sug.category.name}\\{sug.category.name}", sug.file.path)
        self.assertNotIn(f"{sug.category.name}/{sug.category.name}", sug.file.path)

        # 2. Switch category to "Finance"
        fin_cat = self.db.query(OrganizationCategory).filter(OrganizationCategory.name == "Finance").first()
        sug.category_id = fin_cat.id
        sug.status = "edited"
        self.db.commit()

        res_switch = organization_service.apply_organization(self.db)
        self.assertEqual(res_switch["files_moved"], 1)

        # Verify moved directly to root/Finance/file.pdf and not nested under old category
        new_path = sug.file.path
        self.assertTrue(os.path.exists(new_path))
        self.assertIn("Finance", new_path)
        self.assertNotIn("Projects\\Finance", new_path)
        self.assertNotIn("Projects/Finance", new_path)

    def test_07_duplicate_detection(self):
        """Test exact SHA-256 and semantic duplicate detection"""
        folder = self.db.query(Folder).first()
        
        # Create 2 exact hash files
        file_a = File(
            folder_id=folder.id,
            path=os.path.join(self.test_dir, "doc1.pdf"),
            name="doc1.pdf",
            extension=".pdf",
            size=200,
            modified_at=datetime.utcnow(),
            file_hash="same_exact_hash_999",
            extracted_text="Exact duplicate content example."
        )
        file_b = File(
            folder_id=folder.id,
            path=os.path.join(self.test_dir, "doc1_copy.pdf"),
            name="doc1_copy.pdf",
            extension=".pdf",
            size=200,
            modified_at=datetime.utcnow(),
            file_hash="same_exact_hash_999",
            extracted_text="Exact duplicate content example."
        )
        self.db.add(file_a)
        self.db.add(file_b)
        self.db.commit()

        groups = duplicate_service.find_and_record_duplicates(self.db)
        self.assertTrue(len(groups) > 0)
        exact_found = any(g.detection_type == "Exact duplicate" for g in groups)
        self.assertTrue(exact_found)

    def test_09_operations_endpoint_mapping(self):
        """Test file operations mapping returns filename, source_path, destination_path, etc. matching FileOperationResponse schema"""
        ops = organization_service.get_operations(self.db)
        self.assertTrue(isinstance(ops, list))
        if len(ops) > 0:
            first_op = ops[0]
            self.assertIn("filename", first_op)
            self.assertIn("source_path", first_op)
            self.assertIn("destination_path", first_op)
            self.assertIn("operation_type", first_op)
            self.assertIn("status", first_op)

from datetime import datetime

if __name__ == "__main__":
    unittest.main()
