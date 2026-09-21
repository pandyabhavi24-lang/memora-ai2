import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, SessionLocal, Base, init_db_schema
from .ai.faiss_manager import faiss_manager
from .services.embedding_service import embedding_service
from .services.organization_service import organization_service

from .services.security_service import security_service
from .routes import health, folders, files, scan, search, statistics, organization, media, pdf, expiry
from .routes import security

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("memora.main")

# Initialize DB tables & schema migration (including new Module 5 tables)
Base.metadata.create_all(bind=engine)
init_db_schema()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Memora AI FastAPI Backend...")
    # Pre-load embedding model & FAISS index
    try:
        embedding_service.load_model()
        logger.info(f"FAISS index ready with {faiss_manager.index.ntotal} vectors.")

        # Seed default organization categories
        db = SessionLocal()
        try:
            organization_service.seed_categories(db)
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error during startup initialization: {e}", exc_info=True)
    yield
    # On shutdown: invalidate the session so the next launch requires re-auth
    logger.info("Shutting down Memora AI FastAPI Backend — invalidating session.")
    security_service.invalidate_session()
    logger.info("Shutdown complete.")

app = FastAPI(
    title="Memora AI Backend API",
    description="Intelligent Digital Memory Assistant Local Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration — restricted to known local origins (no wildcard)
# The backend is bound to 127.0.0.1 and should only accept requests
# from the Electron renderer and local Vite dev server.
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "app://.",            # Electron production renderer origin
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Session-Token"],
)

# Include API Routers
app.include_router(health.router)
app.include_router(folders.router)
app.include_router(files.router)
app.include_router(scan.router)
app.include_router(search.router)
app.include_router(statistics.router)
app.include_router(organization.router)
app.include_router(media.router)
app.include_router(pdf.router)
app.include_router(expiry.router)
app.include_router(security.router)   # Module 5

from .schemas import SearchRequest, SearchResponse
from .services.search_service import search_service
from .database import get_db
from fastapi import Depends
from sqlalchemy.orm import Session

@app.post("/search", response_model=SearchResponse, tags=["Search"])
def root_search_alias(search_req: SearchRequest, db: Session = Depends(get_db)):
    """Root alias for POST /api/search."""
    results_data = search_service.execute_search(
        db=db,
        query=search_req.query,
        top_k=search_req.top_k or 20,
        filters=search_req.filters,
        sort_by=search_req.sort_by or "relevant"
    )
    return SearchResponse(**results_data)

@app.get("/search/health", tags=["Search"])
def root_search_health_alias(db: Session = Depends(get_db)):
    """Root alias for GET /api/search/health."""
    from .routes.search import semantic_search_health_check
    return semantic_search_health_check(db=db)

@app.get("/")
def root():
    return {
        "name": "Memora AI Backend API",
        "version": "1.0.0",
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="127.0.0.1", port=8000, reload=True)
