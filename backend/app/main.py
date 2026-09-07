import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import engine, SessionLocal, Base, init_db_schema
from .ai.faiss_manager import faiss_manager
from .services.embedding_service import embedding_service
from .services.organization_service import organization_service
from .routes import health, folders, files, scan, search, statistics, organization

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("memora.main")

# Initialize DB tables & schema migration
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
    logger.info("Shutting down Memora AI FastAPI Backend...")

app = FastAPI(
    title="Memora AI Backend API",
    description="Intelligent Digital Memory Assistant Local Backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "app://."
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Local desktop app requests
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(health.router)
app.include_router(folders.router)
app.include_router(files.router)
app.include_router(scan.router)
app.include_router(search.router)
app.include_router(statistics.router)
app.include_router(organization.router)

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
