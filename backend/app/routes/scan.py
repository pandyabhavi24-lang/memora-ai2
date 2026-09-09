from fastapi import APIRouter, BackgroundTasks
from ..schemas import ScanStatusResponse
from ..services.indexing_service import indexing_service

router = APIRouter(prefix="/api/scan", tags=["Scan"])

@router.post("")
def start_scan(background_tasks: BackgroundTasks):
    current_status = indexing_service.get_status()
    if current_status["status"] == "scanning":
        return {"message": "Scan already in progress", "status": current_status}

    indexing_service.reset_state()
    background_tasks.add_task(indexing_service.run_folder_indexing, None)
    return {"message": "Background folder scan initiated", "status": indexing_service.get_status()}

@router.get("/status", response_model=ScanStatusResponse)
def get_scan_status():
    status_data = indexing_service.get_status()
    return ScanStatusResponse(**status_data)

@router.post("/cancel")
def cancel_scan():
    indexing_service.cancel_scan()
    return {"message": "Scan cancellation requested"}
