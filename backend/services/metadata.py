import json, os
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import JSONResponse


DATA_ROOT = Path(os.environ.get("DATA_ROOT", Path(__file__).resolve().parent.parent.parent / "data"))


def list_metadata_files(directory: Path) -> list[str]:
    if not directory.exists() or not directory.is_dir():
        return []
    out: list[str] = []
    for item in sorted(directory.iterdir()):
        if item.is_file() and item.suffix.lower() == ".json":
            out.append(item.stem)
    return out

def load_metadata(scenario_id: str):
    safe_name = Path(scenario_id).name
    meta_dir = DATA_ROOT / "metadata"
    meta_path = (meta_dir / f"{safe_name}.json").resolve()
    try:
        meta_path.relative_to(meta_dir.resolve())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid scenario ID")
    if not meta_path.exists() or not meta_path.is_file():
        raise HTTPException(status_code=404, detail="Metadata not found")
    try:
        test = meta_path.read_text(encoding="utf-8")
        data = json.loads(test)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read metadata: {exc}") from exc
    
    return JSONResponse(content=data, headers={"Cache-Control": "no-store"})