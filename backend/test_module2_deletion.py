import os
import sys
import shutil

# Ensure backend package is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from app.database import engine, Base, SessionLocal
from app.models import Folder, File, Chunk, VectorMapping, DuplicateGroup, OrganizationSuggestion
from app.services.indexing_service import indexing_service
from app.services.search_service import search_service
from app.services.organization_service import organization_service
from app.ai.faiss_manager import faiss_manager
from app.routes.files import delete_file

def test_module2_physical_deletion():
    print("==================================================")
    print("MEMORA AI — MODULE 2 PHYSICAL FILE DELETION TEST")
    print("==================================================")

    db = SessionLocal()

    # 1. Setup sample directory and create physical test file
    sample_dir = os.path.join(current_dir, "sample_documents")
    os.makedirs(sample_dir, exist_ok=True)

    test_filename = "delete_target_test_doc.txt"
    test_filepath = os.path.join(sample_dir, test_filename)
    test_content = (
        "CONFIDENTIAL TEST DOCUMENT FOR PHYSICAL DELETION TESTING.\n"
        "KeywordUniqueTag12345: This document contains specific phrases for vector indexing removal verification."
    )

    with open(test_filepath, "w", encoding="utf-8") as f:
        f.write(test_content)

    print(f"\n[1/5] Created physical file on disk: '{test_filepath}'")
    assert os.path.exists(test_filepath), "Test file must exist on disk before deletion test."

    # 2. Register Folder and Index Document
    folder = db.query(Folder).filter(Folder.path == sample_dir).first()
    if not folder:
        folder = Folder(path=sample_dir, name="Sample Documents", is_active=True)
        db.add(folder)
        db.commit()
        db.refresh(folder)

    indexing_service.run_folder_indexing(folder.id)
    target_file = db.query(File).filter(File.path == test_filepath).first()
    assert target_file is not None, "File record should exist in DB after indexing."
    file_id = target_file.id
    print(f"  -> File indexed in DB with ID {file_id}. Chunks & FAISS vectors created.")

    # 3. Create dummy DuplicateGroup entry to verify duplicate cleanup
    dummy_dup = DuplicateGroup(
        group_key=f"dup_{file_id}",
        file_a_id=file_id,
        file_b_id=file_id,
        detection_type="exact",
        similarity=100.0,
        status="unresolved"
    )
    db.add(dummy_dup)
    db.commit()
    print("  -> Registered test DuplicateGroup record.")

    # Verify search finds the file before deletion
    search_before = search_service.execute_search(db, query="KeywordUniqueTag12345", top_k=5)
    assert search_before["total"] > 0, "Search before deletion should return indexed document."
    print("  -> Search query 'KeywordUniqueTag12345' returned document successfully.")

    # 4. Trigger Real Physical File Deletion via Backend Endpoint Handler
    print(f"\n[2/5] Invoking Backend Delete Endpoint for file_id {file_id}...")
    result = delete_file(file_id=file_id, db=db)
    print(f"  -> Backend Delete Result: {result}")
    assert result["status"] == "success", "Backend deletion handler must return success status."

    # 5. Verify Physical Filesystem Deletion
    print("\n[3/5] Verifying Physical Filesystem State...")
    file_exists_on_disk = os.path.exists(test_filepath)
    print(f"  -> Physical file exists on disk? {file_exists_on_disk}")
    assert not file_exists_on_disk, "CRITICAL VERIFICATION: Physical file MUST be deleted from disk!"
    print("  -> [PASS] Physical file removed from disk!")

    # 6. Verify SQLite Database Cleanup
    print("\n[4/5] Verifying Database Metadata Cleanup...")
    file_in_db = db.query(File).filter(File.id == file_id).first()
    chunks_in_db = db.query(Chunk).filter(Chunk.file_id == file_id).all()
    dups_in_db = db.query(DuplicateGroup).filter(
        (DuplicateGroup.file_a_id == file_id) | (DuplicateGroup.file_b_id == file_id)
    ).all()
    print(f"  -> File record in DB: {file_in_db}")
    print(f"  -> Chunks in DB: {len(chunks_in_db)}")
    print(f"  -> DuplicateGroups in DB: {len(dups_in_db)}")

    assert file_in_db is None, "File record must be removed from DB."
    assert len(chunks_in_db) == 0, "Chunk records must be removed from DB."
    assert len(dups_in_db) == 0, "DuplicateGroup records referencing file must be removed."
    print("  -> [PASS] Database metadata cleaned up!")

    # 7. Verify FAISS Vector Index Cleanup and Search Invalidation
    print("\n[5/5] Verifying FAISS Index Invalidation...")
    search_after = search_service.execute_search(db, query="KeywordUniqueTag12345", top_k=5)
    results_matching_deleted = [r for r in search_after.get("results", []) if r.get("file_id") == file_id]
    print(f"  -> Search results matching deleted file_id: {len(results_matching_deleted)}")
    assert len(results_matching_deleted) == 0, "Deleted file must NOT appear in search results!"
    print("  -> [PASS] FAISS vector index invalidated!")

    db.close()
    print("\n==================================================")
    print("PHYSICAL FILE DELETION TEST PASSED SUCCESSFULLY! [PASS]")
    print("==================================================")

if __name__ == "__main__":
    test_module2_physical_deletion()
