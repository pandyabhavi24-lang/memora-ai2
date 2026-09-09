# Memora AI — Intelligent Digital Memory Assistant

**Memora AI** is a production-quality, privacy-focused local desktop AI application designed for natural language semantic search across your personal files, documents, scanned receipts, and image notes.

Instead of matching exact filenames or rigid keywords, Memora AI understands the **semantic meaning and visual content** of your files using local dense vector embeddings (`fastembed` / `sentence-transformers/all-MiniLM-L6-v2`) indexed inside a high-performance `FAISS` vector database (`IndexFlatIP`).

---

## 🌟 Key Features

- 🔍 **Natural Language Semantic Search**: Search documents by intent (e.g., *"Show my internship certificate"*, *"Find my machine learning notes"*, *"Where is my resume?"*).
- 📂 **Recursive Folder Scanning**: Continuously indexes user-selected directories and tracks file modifications using SHA-256 content hashes.
- 📄 **Multi-Format Text Extraction**:
  - **PDFs**: Extracted using `pypdf`.
  - **Word Documents (.docx)**: Extracted using `python-docx` (paragraphs + tables).
  - **PowerPoint (.pptx)**: Extracted using `python-pptx` (slides, tables, speaker notes).
  - **Text Files (.txt, .md, .csv)**: Fallback multi-encoding reader (UTF-8, UTF-8-sig, Latin-1).
  - **Images (.jpg, .jpeg, .png, .webp)**: OpenCV preprocessing with `EasyOCR` text extraction.
- 🧩 **Sliding-Window Text Chunker**: Splits extracted text into 500-word segments with 50-word overlaps to preserve contextual boundaries.
- ⚡ **FAISS Vector Indexing**: 384-dimensional dense vectors L2-normalized and indexed in `faiss.IndexFlatIP` (`backend/data/faiss/index.faiss`).
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
│ SQLite Database │ │   FAISS     │ │ FastEmbed / ST     │
│  (memora.db)    │ │ Vector Index│ │ (384-dim dense)   │
└─────────────────┘ └─────────────┘ └────────────────────┘
```

---

## 💻 Fresh Laptop Installation & Setup Guide

### 1. System Requirements
- **OS**: Windows 10 / 11
- **Python**: Python 3.12+ (Verify with `py --version` or `python --version`)
- **Node.js**: Node.js 18+ & npm (Verify with `node -v` and `npm -v`)
- **Git**: (Optional) For cloning repository

---

### 2. Installation Steps

1. **Clone or Copy Project**:
   Open terminal in the project root directory (`memoramain`).

   ```bash
   cd memoramain
   ```

2. **Create Python Virtual Environment**:
   ```bash
   py -m venv .venv
   ```

3. **Install Python Backend Dependencies**:
   ```bash
   .venv\Scripts\pip.exe install -r backend\requirements.txt
   ```

4. **Install Frontend / Electron Dependencies**:
   ```bash
   npm install
   ```

---

### 3. Running the Application

#### A. Run Full Desktop Application (Electron + Vite + FastAPI Backend)
This starts Vite frontend dev server, Python FastAPI backend, and Electron desktop window simultaneously:
```bash
npm run electron:dev
```

#### B. Run Backend Standalone (FastAPI API)
```bash
npm run backend:dev
```

#### C. Run Automated Backend Diagnostic & Test Suite
```bash
npm run test:backend
```

---

### 4. Health Check Verification

Once the backend is running, verify health at `http://127.0.0.1:8000/health`:

**Request**:
```bash
curl http://127.0.0.1:8000/health
```

**Expected Response**:
```json
{
  "status": "ok",
  "database": true,
  "faiss": true,
  "embedding_model": true
}
```

---

### 5. How to Use Memora AI

1. **Select Folders**: Click **"Add Folder"** on the dashboard or Settings. Electron will launch the native OS folder picker.
2. **Scan Documents**: Click **"Start Scan"**. The backend scanner recursively reads files, extracts text (PDF, DOCX, PPTX, TXT, OCR for images), generates 384-dim embeddings, and indexes vectors into FAISS.
3. **Natural Language Search**: Type natural queries in the search box (e.g., *"Find my machine learning lecture notes"*, *"Show internship certificate"*).
4. **Locate / Open Files**: Click on search result cards to view document previews or open the native file on your computer.

---

## 📡 API Endpoint Reference

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/health` | Backend health check (DB, FAISS, Embedding Model) |
| `GET` | `/api/folders` | List all registered folders |
| `POST` | `/api/folders` | Register a folder for scanning |
| `DELETE` | `/api/folders/{id}` | Remove folder from index |
| `POST` | `/api/scan` | Trigger background global folder indexing |
| `GET` | `/api/scan/status` | Poll live indexing progress metrics |
| `POST` | `/api/search` | Perform natural language semantic vector search |
| `GET` | `/api/search/history` | Fetch recent search query history |
| `DELETE` | `/api/search/history` | Clear search query history |
| `GET` | `/api/statistics` | Fetch real dashboard metrics |

---

## 🔒 Security & Privacy

- All SQLite database files (`backend/data/memora.db`) and FAISS indexes (`backend/data/faiss/index.faiss`) run 100% locally.
- Zero data leaves your laptop.

