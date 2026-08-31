# Memora AI — Python FastAPI Backend

FastAPI backend server for **Memora AI — Intelligent Digital Memory Assistant**.

## Features

- **FastAPI**: Asynchronous Python API framework.
- **SQLite + SQLAlchemy**: Local metadata storage (`data/memora.db`).
- **FAISS**: Inner-product vector indexing (`IndexFlatIP`, 384-dimensional normalized vectors stored at `data/faiss/index.faiss`).
- **Sentence Transformers**: `sentence-transformers/all-MiniLM-L6-v2` for local dense text embeddings.
- **Document Text Extractors**:
  - `pypdf` for PDF documents.
  - `python-docx` for Word documents (.docx).
  - UTF-8 / Latin-1 for plain text (.txt, .md, .csv).
  - `OpenCV` + `EasyOCR` for image OCR (.jpg, .jpeg, .png, .webp).
- **Text Chunker**: 500-word sliding window with 50-word overlap.
- **Real Semantic Search**: Vector similarity matching, score calculation, result filtering, chunk grouping, and search history recording.

---

## API Endpoints Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health status of DB, FAISS, and model |
| GET | `/api/folders` | List all active scanned folders |
| POST | `/api/folders` | Add new folder to index |
| DELETE | `/api/folders/{id}` | Remove folder from index |
| POST | `/api/folders/{id}/scan` | Trigger scan for a specific folder |
| GET | `/api/files` | List indexed files |
| GET | `/api/files/{id}` | Get detailed file metadata and chunks |
| GET | `/api/files/{id}/content` | Get extracted text content for preview |
| POST | `/api/scan` | Trigger global background folder scan |
| GET | `/api/scan/status` | Get current scan progress metrics |
| POST | `/api/scan/cancel` | Cancel ongoing scan |
| POST | `/api/search` | Execute real semantic vector search query |
| GET | `/api/search/history` | List recent search history |
| DELETE | `/api/search/history` | Clear search history |
| GET | `/api/statistics` | Get real dashboard metrics |

---

## Installation & Setup

1. Create a Python 3.12+ virtual environment:
   ```bash
   python -m venv .venv
   ```

2. Activate virtual environment:
   - Windows (PowerShell): `.venv\Scripts\Activate.ps1`
   - Linux/macOS: `source .venv/bin/activate`

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Run FastAPI backend server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

5. Run test suite:
   ```bash
   python test_backend.py
   ```
