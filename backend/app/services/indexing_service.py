import os
import logging
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Folder, File, Chunk, VectorMapping
from .scanner import scan_directory
from .extractor import text_extractor
from .chunker import chunk_text
from .embedding_service import embedding_service
from ..ai.faiss_manager import faiss_manager

logger = logging.getLogger("memora.indexing")

class IndexingService:
    """
    Manages background indexing job state and coordinates scanning, extraction, chunking, embedding, FAISS indexing, and DB persistence.
    """
    def __init__(self):
        self.lock = asyncio.Lock()
        self._is_cancelled = False
        self.state: Dict[str, Any] = {
            "status": "idle",  # idle, scanning, complete, failed
            "files_found": 0,
            "files_processed": 0,
            "files_failed": 0,
            "chunks_created": 0,
            "vectors_created": 0,
            "current_file": "",
            "progress_percentage": 0,
            "error_message": None
        }

    def get_status(self) -> Dict[str, Any]:
        return dict(self.state)

    def cancel_scan(self):
        self._is_cancelled = True
        logger.info("Scan cancellation requested.")

    def reset_state(self):
        self._is_cancelled = False
        self.state = {
            "status": "idle",
            "files_found": 0,
            "files_processed": 0,
            "files_failed": 0,
            "chunks_created": 0,
            "vectors_created": 0,
            "current_file": "",
            "progress_percentage": 0,
            "error_message": None
        }

    def run_folder_indexing(self, folder_id: Optional[int] = None):
        """
        Synchronous indexing worker method meant to run in background thread or task.
        """
        self._is_cancelled = False
        self.state["status"] = "scanning"
        self.state["error_message"] = None

        db: Session = SessionLocal()
        try:
            if folder_id:
                folders = db.query(Folder).filter(Folder.id == folder_id, Folder.is_active == True).all()
            else:
                folders = db.query(Folder).filter(Folder.is_active == True).all()

            if not folders:
                self.state["status"] = "complete"
                self.state["progress_percentage"] = 100
                return

            all_found_scans = []
            for folder in folders:
                found = scan_directory(folder.path)
                for item in found:
                    item["folder_id"] = folder.id
                all_found_scans.extend(found)

            self.state["files_found"] = len(all_found_scans)
            if len(all_found_scans) == 0:
                self.state["status"] = "complete"
                self.state["progress_percentage"] = 100
                return

            processed = 0
            failed = 0
            chunks_total = 0
            vectors_total = 0

            for idx, item_meta in enumerate(all_found_scans):
                if self._is_cancelled:
                    logger.info("Scan cancelled by user.")
                    self.state["status"] = "idle"
                    self.state["current_file"] = "Scan cancelled"
                    return

                self.state["current_file"] = item_meta["name"]
                file_path = item_meta["path"]
                folder_id_val = item_meta["folder_id"]

                try:
                    # Check existing DB file record
                    existing_file = db.query(File).filter(File.path == file_path).first()

                    if existing_file:
                        # Check if modified
                        if existing_file.file_hash == item_meta["file_hash"] and existing_file.modified_at == item_meta["modified_at"]:
                            # Unchanged file - count chunks & vectors
                            processed += 1
                            existing_chunks = db.query(Chunk).filter(Chunk.file_id == existing_file.id).all()
                            chunks_total += len(existing_chunks)
                            vectors_total += len(existing_chunks)
                            self._update_progress(processed, failed, chunks_total, vectors_total, len(all_found_scans))
                            continue
                        else:
                            # Modified file: Delete old chunks & vectors from FAISS and DB
                            logger.info(f"File modified: '{file_path}'. Re-indexing.")
                            self._delete_file_chunks_and_vectors(db, existing_file.id)
                            target_file = existing_file
                            target_file.size = item_meta["size"]
                            target_file.modified_at = item_meta["modified_at"]
                            target_file.file_hash = item_meta["file_hash"]
                    else:
                        # New file
                        target_file = File(
                            folder_id=folder_id_val,
                            path=file_path,
                            name=item_meta["name"],
                            extension=item_meta["extension"],
                            size=item_meta["size"],
                            modified_at=item_meta["modified_at"],
                            file_hash=item_meta["file_hash"],
                            extraction_status="pending"
                        )
                        db.add(target_file)
                        db.commit()
                        db.refresh(target_file)

                    # Extract text content
                    extracted_text, status_str = text_extractor.extract(file_path, item_meta["extension"])
                    target_file.extracted_text = extracted_text
                    target_file.extraction_status = status_str
                    db.commit()

                    if status_str in ["success", "empty"] and extracted_text:
                        # Chunk text
                        chunk_objs = chunk_text(extracted_text, chunk_size=500, overlap=50)
                        if chunk_objs:
                            chunk_records = []
                            texts_to_embed = []
                            for c in chunk_objs:
                                ch_rec = Chunk(
                                    file_id=target_file.id,
                                    chunk_index=c["chunk_index"],
                                    text=c["text"],
                                    word_count=c["word_count"]
                                )
                                db.add(ch_rec)
                                chunk_records.append(ch_rec)
                                texts_to_embed.append(c["text"])

                            db.commit()
                            for ch_rec in chunk_records:
                                db.refresh(ch_rec)

                            # Embed chunks
                            vectors = embedding_service.embed_documents(texts_to_embed)
                            chunk_ids = [ch.id for ch in chunk_records]

                            # Add to FAISS index
                            assigned_mappings = faiss_manager.add_vectors(vectors, chunk_ids)

                            # Save vector mappings to DB safely
                            for faiss_id, chunk_id in assigned_mappings:
                                existing_vm = db.query(VectorMapping).filter(VectorMapping.chunk_id == chunk_id).first()
                                if existing_vm:
                                    existing_vm.faiss_id = faiss_id
                                else:
                                    vm = VectorMapping(chunk_id=chunk_id, faiss_id=faiss_id)
                                    db.add(vm)
                            db.commit()

                            chunks_total += len(chunk_records)
                            vectors_total += len(assigned_mappings)

                    processed += 1
                except Exception as e:
                    logger.error(f"Error processing file '{file_path}': {e}", exc_info=True)
                    db.rollback()
                    failed += 1
                    processed += 1

                self._update_progress(processed, failed, chunks_total, vectors_total, len(all_found_scans))

            self.state["status"] = "complete"
            self.state["progress_percentage"] = 100
            self.state["current_file"] = "Finished"
            logger.info(f"Indexing complete. Processed: {processed}, Failed: {failed}, Chunks: {chunks_total}, Vectors: {vectors_total}")

        except Exception as e:
            logger.error(f"Indexing pipeline failed: {e}", exc_info=True)
            db.rollback()
            self.state["status"] = "failed"
            self.state["error_message"] = str(e)
        finally:
            db.close()

    def _delete_file_chunks_and_vectors(self, db: Session, file_id: int):
        chunks = db.query(Chunk).filter(Chunk.file_id == file_id).all()
        chunk_ids = {c.id for c in chunks}
        if chunk_ids:
            faiss_manager.remove_chunks(chunk_ids)
            db.query(VectorMapping).filter(VectorMapping.chunk_id.in_(chunk_ids)).delete(synchronize_session=False)
            db.query(Chunk).filter(Chunk.file_id == file_id).delete(synchronize_session=False)
            db.commit()

    def _update_progress(self, processed: int, failed: int, chunks: int, vectors: int, total: int):
        self.state["files_processed"] = processed
        self.state["files_failed"] = failed
        self.state["chunks_created"] = chunks
        self.state["vectors_created"] = vectors
        if total > 0:
            self.state["progress_percentage"] = min(100, int((processed / total) * 100))

indexing_service = IndexingService()
