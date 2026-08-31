# Memora AI — Intelligent Digital Memory Assistant

**Memora AI** is a production-quality, privacy-focused local desktop AI application designed for natural language semantic search across your personal files, documents, scanned receipts, and image notes.

Instead of matching exact filenames or rigid keywords, Memora AI understands the **semantic meaning and visual content** of your files using local dense vector embeddings (`sentence-transformers/all-MiniLM-L6-v2`) indexed inside a high-performance `FAISS` vector database (`IndexFlatIP`).

---

## 🌟 Key Features

- 🔍 **Natural Language Semantic Search**: Search documents by intent (e.g., *"Show my internship certificate"*, *"Find my machine learning notes"*, *"Where is my resume?"*).
- 📂 **Recursive Folder Scanning**: Continuously indexes user-selected directories and tracks file modifications using SHA-256 content hashes.
- 📄 **Multi-Format Text Extraction**:
  - **PDFs**: Extracted using `pypdf`.
  - **Word Documents (.docx)**: Extracted using `python-docx` (paragraphs + tables).
  - **Text Files (.txt, .md, .csv)**: Fallback multi-encoding reader (UTF-8, UTF-8-sig, Latin-1).
  - **Images (.jpg, .jpeg, .png, .webp)**: OpenCV preprocessing with `EasyOCR` text extraction.
- 🧩 **Sliding-Window Text Chunker**: Splits extracted text into 500-word segments with 50-word overlaps to preserve contextual boundaries.
- ⚡ **FAISS Vector Indexing**: 384-dimensional dense vectors L2-normalized and indexed in `faiss.IndexFlatIP` (`data/faiss/index.faiss`).
- 🔒 **100% Local & Private**: No cloud APIs, no external network calls, zero data uploads.
- 🖥️ **Cross-Platform Desktop UI**: Built with React 19, Tailwind CSS, Vite, and Electron.

---

## 🏗️ System Architecture

```text
┌────────────────────────────────────────────────────────┐
│                   React 19 Frontend                    │
│            (Dashboard, Search UI, Preview)             │
└──────────────────────────┬─────────────────────────────┘
                           │ IPC & REST API (HTTP)
┌──────────────────────────▼─────────────────────────────┐
│                 Electron Desktop App                   │
│           (Native Folder Picker & Process Mgr)         │
└──────────────────────────┬─────────────────────────────┘
                           │ FastAPI localhost:8000
┌──────────────────────────▼─────────────────────────────┐
│                 Python FastAPI Backend                 │
│  (Database, Folder Scanner, Extractor, Chunker, AI)    │
└────────┬─────────────────┬───────────────────┬─────────┘
         │                 │                   │
┌────────▼────────┐ ┌──────▼──────┐ ┌──────────▼─────────┐
│ SQLite Database │ │   FAISS     │ │SentenceTransformer │
│  (memora.db)    │ │ Vector Index│ │ (all-MiniLM-L6-v2) │
└─────────────────┘ └─────────────┘ └────────────────────┘
```

### Complete End-to-End Pipeline

1. **Folder Selection**: User selects folders via Electron native directory picker.
2. **Scanner**: Recursive scanner detects new, modified, or deleted files based on path and SHA-256 hash.
3. **Extraction**: `TextExtractor` extracts content from PDF, DOCX, TXT, and Images (EasyOCR).
4. **Chunking**: Text is divided into 500-word chunks with 50-word overlap.
5. **Embedding**: `EmbeddingService` generates normalized 384-dimensional dense vectors.
6. **FAISS Indexing**: `FAISSManager` stores vectors in `IndexFlatIP` and persists index & ID mapping.
7. **Semantic Search**: User query vector is compared against FAISS index; top matching chunks are grouped by file and returned with relevance scores and snippets.

---

## 🚀 Running Memora AI Locally

### Prerequisites
- Node.js (v18+)
- Python 3.12+

### 1. Setup Python Backend Virtual Environment
```bash
# Navigate to project directory
cd memora-ai-main

# Create virtual environment
python -m venv .venv

# Activate virtual environment (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Install backend dependencies
pip install -r backend/requirements.txt
```

### 2. Install Frontend Dependencies
```bash
npm install
```

### 3. Run Backend End-to-End Test Suite
```bash
npm run test:backend
```

### 4. Start Full Desktop Application (Electron + Vite + FastAPI)
```bash
npm run electron:dev
```

---

## 📡 API Endpoint Reference

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/health` | Backend health check (DB, FAISS, Embedding Model) |
| `GET` | `/api/folders` | List all registered folders |
| `POST` | `/api/folders` | Register a folder for scanning |
| `DELETE` | `/api/folders/{id}` | Remove folder from index |
| `POST` | `/api/folders/{id}/scan` | Trigger scan for a specific folder |
| `GET` | `/api/files` | List indexed files |
| `GET` | `/api/files/{id}/content` | Fetch extracted document text for preview |
| `POST` | `/api/scan` | Trigger background global folder indexing |
| `GET` | `/api/scan/status` | Poll live indexing progress metrics |
| `POST` | `/api/search` | Perform natural language semantic vector search |
| `GET` | `/api/search/history` | Fetch recent search query history |
| `DELETE` | `/api/search/history` | Clear search query history |
| `GET` | `/api/statistics` | Fetch real dashboard metrics |

---

## 📊 Viva / Final Year Presentation Summary

During a project presentation or viva, explain Memora AI using this 4-step summary:

1. **Problem Statement**: Traditional file search (like Windows Search or File Explorer) relies on exact filename matches or manual folder organization. Finding a specific certificate or lecture note requires knowing the exact filename.
2. **Solution**: Memora AI uses dense vector embeddings (`all-MiniLM-L6-v2`) to capture the **conceptual meaning** of document content and EasyOCR image text.
3. **Vector Database**: Extracted document chunks are converted into 384-dimensional floating-point vectors and indexed using `FAISS` (`IndexFlatIP`). Similarity search is computed using vector inner product (cosine similarity).
4. **Privacy & Local Execution**: All models, SQLite metadata, and vector indexes run 100% locally on the user's desktop without uploading data to external clouds or third-party APIs.
