from fastapi import APIRouter
from services.metadata import list_metadata_files, load_metadata, DATA_ROOT

router = APIRouter(tags=["metadata"])

@router.get("/metadata")
async def api_list_metadata():
    """Return the list of available metadata files."""
    meta_dir  = DATA_ROOT / "metadata"
    metadata_files = list_metadata_files(meta_dir)
    return {"metadata": metadata_files}

@router.get("/metadata/{scenario_id}")
async def api_get_metadata(scenario_id: str):
    """Return the metadata for a specific scenario."""
    metadata = load_metadata(scenario_id)
    return metadata