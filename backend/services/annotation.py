import json
import os
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import JSONResponse, FileResponse
from models.annotation import Annotation

from services.video import list_video_files, VIDEO_DIR

DATA_ROOT = Path(os.environ.get("DATA_ROOT", Path(__file__).resolve().parent.parent / "data"))
ANNOTATION_DIR = Path(os.path.join(DATA_ROOT, "annotations"))

def ensure_directory(directory: Path) -> None:
    try:
        directory.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot create annotation directory: {directory}") from exc
    if not os.access(directory, os.W_OK | os.X_OK):
        raise HTTPException(status_code=500, detail=f"Annotation directory is not writable: {directory}")

def annotation_path_from_filename(video_filename: str) -> Path:
    """Map a provided video filename or id to an annotation JSON path.

    Behavior:
    - Prefer the direct candidate file DEFAULT_ANNOTATION_DIR/<stem>.json if it exists.
    - If not found, scan DEFAULT_ANNOTATION_DIR for any JSON whose stem matches
      the requested stem (case-insensitive) or ends with the requested stem
      (case-insensitive). Return the first match found.
    - If nothing is found, return the default candidate path (caller will decide
      how to handle missing files).
    """
    safe_name = Path(video_filename).name
    # Derive stem (if input had no suffix, keep as-is)
    stem = Path(safe_name).stem if Path(safe_name).suffix else safe_name

    candidate = ANNOTATION_DIR / f"{stem}.json"
    # If the exact candidate exists, return it.
    try:
        if candidate.exists() and candidate.is_file():
            return candidate
    except Exception:
        # If there's an OS error checking existence, fall through to scanning
        pass

    # Fallback: scan the annotation directory for a matching file
    try:
        if ANNOTATION_DIR.exists() and ANNOTATION_DIR.is_dir():
            lower_stem = stem.lower()
            for item in ANNOTATION_DIR.iterdir():
                if not item.is_file():
                    continue
                if item.suffix.lower() != '.json':
                    continue
                item_stem = item.stem or ''
                lower_item = item_stem.lower()
                # Exact case-insensitive match
                if lower_item == lower_stem:
                    return item
                # Suffix match (handles files that may include prefixes)
                if lower_item.endswith(lower_stem):
                    return item
    except Exception:
        # Any error scanning the directory is non-fatal here; return candidate below
        pass

    # Not found: return the canonical candidate path (may not exist)
    return candidate

def load_annotation_file(video_name: str) -> JSONResponse | FileResponse:
    path = annotation_path_from_filename(video_name)
    ensure_directory(path.parent)

    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail=f"Annotation file not found: {video_name}")

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return FileResponse(
            path,
            media_type="application/json",
            filename=path.name,
            headers={"Cache-Control": "no-store"},
        )

    if isinstance(data, list):
        legacy = convert_array_to_legacy(data, video_name)
        return JSONResponse(content=legacy, headers={"Cache-Control": "no-store"})

    if isinstance(data, dict):
        return JSONResponse(content=data, headers={"Cache-Control": "no-store"})

    return FileResponse(
        path,
        media_type="application/json",
        filename=path.name,
        headers={"Cache-Control": "no-store"},
    )
           
        
def convert_array_to_legacy(data: list[dict], video_name: str) -> dict:
    first = data[0] if data else {}
    video_path = first.get("video_path") or ""

    scenario_id = ""
    video_filename = ""
    if isinstance(video_path, str) and video_path:
        parts = video_path.split("/")
        if len(parts) >= 3 and parts[0] == "videos":
            scenario_id = parts[1]
            video_filename = parts[-1]
        else:
            video_filename = parts[-1]

    if not video_filename:
        video_filename = f"{video_name}.mp4"

    video_id = Path(video_filename).stem
    
    task = first.get("task") or ""
    environment = first.get("environment") or ""
    obj = first.get("object") or ""
    
    interactions = []
    actions_list = []

    for it in data:
        if not isinstance(it, dict):
            continue
        label = it.get("action_label")
        if isinstance(label, str) and label and label not in actions_list:
            actions_list.append(label)

        interactions.append({
            "start_time": it.get("start_time"),
            "end_time": it.get("end_time"),
            "start_frame": it.get("start_frame"),
            "end_frame": it.get("end_frame"),
            "action_label": it.get("action_label"),
            "contact": it.get("contact", False),
        })

    return {
        "scenario_id": scenario_id,
        "video_id": video_id,
        "video_path": video_path,
        "task": task,
        "environment": environment,
        "object": obj,
        "actions": actions_list,
        "interactions": interactions,
    }
    

def save_annotation_to_file(annotation: Annotation) -> dict:
    candidate_stem = annotation.video_id
    if annotation.video_path:
        try:
            candidate_stem = Path(annotation.video_path).name
        except Exception:
            pass
        
    if not candidate_stem and annotation.video_filename:
        try:
            candidate_stem = Path(annotation.video_filename).name
        except Exception:
            pass
        
    if not candidate_stem:
        candidate_stem = annotation.video_id
    
    target_path = annotation_path_from_filename(candidate_stem or "")
    ensure_directory(target_path.parent)
    
    if annotation.video_path:
        try:
            video_basename = Path(annotation.video_path).name
        except Exception:
            video_basename = ""
    else:
        video_basename = (
            Path(annotation.video_filename).name
            if annotation.video_filename
            else f"{annotation.video_id}.mp4"
        )
        
    def exists_under_videos(rel: str) -> bool:
        try:
            candidate = (VIDEO_DIR / rel).resolve()
            candidate.relative_to(VIDEO_DIR.resolve())
            return candidate.exists() and candidate.is_file()
        except Exception:
            return False
        
    rel_candidate = ""
    source_path = annotation.video_path or annotation.video_filename

    if source_path:
        p = Path(source_path)
        parts = p.parts
        if parts and parts[0].lower() == "videos" and len(parts) > 1:
            rel_candidate = Path(*parts[1:]).as_posix()
        else:
            rel_candidate = p.as_posix().lstrip("/")
            
    if rel_candidate and exists_under_videos(rel_candidate):
        resolved_rel = rel_candidate
    else:
        resolved_rel = ""

        if annotation.scenario_id:
            cand = f"{annotation.scenario_id}/{video_basename}" if video_basename else annotation.scenario_id
            if exists_under_videos(cand):
                resolved_rel = cand
                
        if not resolved_rel:
            all_videos = list_video_files(VIDEO_DIR)
            match: str | None = None
            preferred_prefix = annotation.scenario_id or ''

            for v in all_videos:
                if v.split('/')[-1] == video_basename:
                    if preferred_prefix and v.split('/')[0] == preferred_prefix:
                        match = v
                        break

                    if match is None:
                        match = v

            if match:
                resolved_rel = match
                
    if not resolved_rel:
        resolved_rel = (
            f"{annotation.scenario_id}/{video_basename}"
            if annotation.scenario_id
            else video_basename
        )
            
    video_path = f"videos/{resolved_rel}" if resolved_rel else ""
    
    interactions_sorted = sorted(
        annotation.interactions,
        key=lambda it: (it.start_time, it.end_time, it.start_frame),
    )
    
    actions_list = []
    for it in interactions_sorted:
        if it.action_label and it.action_label not in actions_list:
            actions_list.append(it.action_label)
            
    legacy_obj = {
        "scenario_id": annotation.scenario_id,
        "video_id": annotation.video_id,
        "video_path": video_path,
        "task": annotation.task,
        "environment": annotation.environment,
        "object": annotation.object,
        "actions": actions_list,
        "interactions": [],
    }

    for it in interactions_sorted:
        legacy_obj["interactions"].append({
            "video_path": video_path,
            "object": annotation.object,
            "environment": annotation.environment,
            "action_label": it.action_label,
            "start_time": it.start_time,
            "end_time": it.end_time,
            "start_frame": it.start_frame,
            "end_frame": it.end_frame,
            "contact": it.contact,
        })

    try:
        target_path.write_text(
            json.dumps(legacy_obj, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except PermissionError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot write annotation: {target_path}") from exc

    return JSONResponse(
        content={"status": "saved", "file": target_path.name},
        headers={"Cache-Control": "no-store"},
    )       