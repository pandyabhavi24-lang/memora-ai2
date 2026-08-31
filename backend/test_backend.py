import os
import sys
import time
import shutil

# Ensure backend package is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.database import engine, Base, SessionLocal
from app.models import Folder, File, Chunk, VectorMapping, SearchHistory
from app.services.indexing_service import indexing_service
from app.services.search_service import search_service
from app.ai.faiss_manager import faiss_manager

def run_tests():
    print("==================================================")
    print("MEMORA AI - BACKEND COMPREHENSIVE END-TO-END TEST")
    print("==================================================")

    # 1. Initialize Database Tables
    print("\n[1/6] Initializing SQLite database tables...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    print("  -> SQLite database initialized successfully.")

    # 2. Setup Sample Documents Directory
    sample_dir = os.path.join(current_dir, "sample_documents")
    if os.path.exists(sample_dir):
        shutil.rmtree(sample_dir)
    os.makedirs(sample_dir, exist_ok=True)

    files_content = {
        "internship_resume.txt": (
            "ALEX CHEN - SENIOR SOFTWARE ENGINEER RESUME\n"
            "Experience: Software Engineering Intern at Google (Summer 2025). Worked on cloud infrastructure and distributed vector databases.\n"
            "Education: B.S. Computer Science. Completed Internship Certificate of Excellence.\n"
            "Skills: Python, FastAPI, React, C++, Machine Learning, PyTorch, Vector Search."
        ),
        "machine_learning_notes.txt": (
            "CHAPTER 4: DEEP LEARNING & MACHINE LEARNING LECTURE NOTES\n"
            "Topics covered: Convolutional Neural Networks (CNNs), Vision Transformers (ViT), Gradient Descent, Backpropagation.\n"
            "Supervised Learning vs Unsupervised Learning. Loss functions: Cross Entropy, Mean Squared Error.\n"
            "Frameworks: PyTorch, TensorFlow, Scikit-learn."
        ),
        "aws_cloud_notes.txt": (
            "AWS CLOUD COMPUTING STUDY GUIDE & NOTES\n"
            "Key AWS Services: EC2, S3 bucket storage, Lambda serverless functions, DynamoDB, RDS PostgreSQL.\n"
            "Cloud Security best practices, IAM roles, VPC peering, and CloudWatch monitoring."
        ),
        "iot_project.txt": (
            "INTERNET OF THINGS (IoT) FINAL YEAR COLLEGE PROJECT DOCUMENTATION\n"
            "Project Title: Smart Agriculture Monitoring System using ESP32 and MQTT protocol.\n"
            "Sensors used: DHT11 temperature sensor, Soil moisture sensor, LDR light sensor.\n"
            "Cloud backend receives sensor metrics via MQTT broker and triggers automated irrigation pumps."
        ),
        "random_document.txt": (
            "GROCERY LIST & HOUSEHOLD SUPPLIES\n"
            "1. Organic Milk\n"
            "2. Whole Grain Bread\n"
            "3. Fresh Apples and Bananas\n"
            "4. Dishwashing Soap"
        )
    }

    print(f"\n[2/6] Creating 5 test documents in '{sample_dir}'...")
    for filename, text in files_content.items():
        filepath = os.path.join(sample_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(text)
        print(f"  + Created: {filename}")

    # 3. Add Folder to DB
    print("\n[3/6] Registering sample folder in database...")
    folder = db.query(Folder).filter(Folder.path == sample_dir).first()
    if not folder:
        folder = Folder(path=sample_dir, name="Sample Documents", is_active=True)
        db.add(folder)
        db.commit()
        db.refresh(folder)
    print(f"  -> Folder registered with ID {folder.id}: '{folder.path}'")

    # 4. Trigger Indexing Pipeline
    print("\n[4/6] Running indexing pipeline (Scan -> Extract -> Chunk -> Embed -> FAISS -> DB)...")
    indexing_service.run_folder_indexing(folder.id)
    status = indexing_service.get_status()
    print(f"  -> Indexing status: {status['status']}")
    print(f"  -> Files found: {status['files_found']}, Processed: {status['files_processed']}")
    print(f"  -> Chunks created: {status['chunks_created']}, Vectors created: {status['vectors_created']}")

    # 5. Perform Real Semantic Search Queries
    print("\n[5/6] Testing Real Semantic Search Queries...")
    test_queries = [
        ("find my internship resume", "internship_resume.txt"),
        ("show my machine learning study material", "machine_learning_notes.txt"),
        ("find my cloud computing notes", "aws_cloud_notes.txt"),
        ("show my IoT project information", "iot_project.txt")
    ]

    all_passed = True
    for query, expected_filename in test_queries:
        print(f"\n  Query: \"{query}\"")
        res = search_service.execute_search(db=db, query=query, top_k=5)
        results = res.get("results", [])
        print(f"  Execution time: {res.get('execution_time_ms')} ms, Total matches: {res.get('total')}")

        if not results:
            print(f"  [FAIL] No results returned for query: '{query}'")
            all_passed = False
            continue

        top_match = results[0]
        print(f"  Top Result: '{top_match['file_name']}' | Score: {top_match['score']}%")
        print(f"  Snippet: {top_match['matched_snippet'][:120]}...")

        if top_match["file_name"] == expected_filename:
            print(f"  [SUCCESS] Matched expected file '{expected_filename}'!")
        else:
            print(f"  [FAIL] Expected '{expected_filename}', but got '{top_match['file_name']}'")
            all_passed = False

    # 6. Database Verification
    print("\n[6/6] Verifying database records...")
    db_files = db.query(File).count()
    db_chunks = db.query(Chunk).count()
    db_vectors = db.query(VectorMapping).count()
    db_searches = db.query(SearchHistory).count()
    print(f"  Files in DB: {db_files}")
    print(f"  Chunks in DB: {db_chunks}")
    print(f"  Vector Mappings in DB: {db_vectors}")
    print(f"  FAISS Index Size: {faiss_manager.index.ntotal} vectors")
    print(f"  Search History Entries: {db_searches}")

    db.close()

    print("\n==================================================")
    if all_passed and db_vectors > 0:
        print("ALL BACKEND END-TO-END TESTS PASSED SUCCESSFULLY! [PASS]")
        print("==================================================")
        return True
    else:
        print("SOME TESTS FAILED. PLEASE REVIEW LOGS.")
        print("==================================================")
        return False

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
