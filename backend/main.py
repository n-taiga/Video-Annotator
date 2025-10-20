import json
import mimetypes
import os
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from models import Annotation

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi"}
DEFAULT_VIDEO_DIR = Path(os.environ.get("VIDEO_DIRECTORY", Path(__file__).resolve().parent.parent / "frontend" / "public"))
DEFAULT_ANNOTATION_DIR = Path(
    os.environ.get("ANNOTATION_DIRECTORY", "/data/annotations")
)


def list_video_files(directory: Path) -> List[str]:
    """Return video files under directory recursively as POSIX-style relative paths."""
    if not directory.exists() or not directory.is_dir():
        return []
    files: List[str] = []
    for item in directory.rglob('*'):
        if item.is_file() and item.suffix.lower() in VIDEO_EXTENSIONS:
            try:
                rel = item.relative_to(directory).as_posix()
                files.append(rel)
            except Exception:
                # Fallback to name if relative fails (shouldn't happen)
                files.append(item.name)
    return sorted(files)

def _annotation_path_from_filename(video_filename: str) -> Path:
    safe_name = Path(video_filename).name
    stem = Path(safe_name).stem if Path(safe_name).suffix else safe_name
    return DEFAULT_ANNOTATION_DIR / f"{stem}.json"


def _ensure_directory(directory: Path) -> None:
    try:
        directory.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot create annotation directory: {directory}") from exc
    if not os.access(directory, os.W_OK | os.X_OK):
        raise HTTPException(status_code=500, detail=f"Annotation directory is not writable: {directory}")


def _resolve_video_path(filename: str) -> Path:
    """Resolve a potentially nested relative filename safely under DEFAULT_VIDEO_DIR."""
    base = DEFAULT_VIDEO_DIR.resolve()
    rel = Path(filename)
    if rel.is_absolute():
        raise HTTPException(status_code=400, detail='Absolute paths are not allowed')
    target = (base / rel).resolve()
    try:
        # Ensure target is within base directory
        target.relative_to(base)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid video path')
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail='Video not found')
    return target


@app.post('/save')
async def save_annotation(ann: Annotation):
    target_path = _annotation_path_from_filename(ann.video_filename or ann.video_id)
    _ensure_directory(target_path.parent)
    try:
        # Convert to the requested export format: array of objects per interaction
        # Example item keys:
        #   video_path, task_label, object, environment, action_label,
        #   start_time, end_time, start_frame, end_frame, contact
        # Use only the base file name to avoid duplicating nested folders
        video_basename = Path(ann.video_filename).name if ann.video_filename else ''
        video_path = f"videos/{ann.scenario_id}/{video_basename}"
        # Sort interactions by start_time (then end_time, start_frame) for stable output
        interactions_sorted = sorted(
            ann.interactions,
            key=lambda it: (it.start_time, it.end_time, it.start_frame),
        )
        items = []
        for it in interactions_sorted:
            items.append({
                "video_path": video_path,
                "task_label": ann.task_label,
                "object": ann.object,
                "environment": ann.environment,
                "action_label": it.action_label,
                "start_time": it.start_time,
                "end_time": it.end_time,
                "start_frame": it.start_frame,
                "end_frame": it.end_frame,
                "contact": it.contact,
            })
        target_path.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding='utf-8')
    except PermissionError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot write annotation file: {target_path}") from exc
    return {"status": "saved", "file": target_path.name}

@app.get('/load/{video_name}')
async def load_annotation(video_name: str):
    target_path = _annotation_path_from_filename(video_name)
    _ensure_directory(target_path.parent)
    if not target_path.exists():
        raise HTTPException(status_code=404, detail='Not found')
    # Read file and normalize response to legacy nested schema expected by frontend
    try:
        text = target_path.read_text(encoding='utf-8')
        data = json.loads(text)
    except Exception:
        # Fallback to direct file response if parsing fails
        return FileResponse(
            target_path,
            media_type='application/json',
            filename=target_path.name,
            headers={"Cache-Control": "no-store"},
        )

    # If stored as an array (new export format), reconstruct the legacy object shape
    if isinstance(data, list):
        first = data[0] if data else {}
        video_path = first.get('video_path') or ''
        # Try to extract scenario and filename from video_path like "videos/<scenario>/<filename>"
        scenario_id = ''
        video_filename = ''
        if isinstance(video_path, str) and video_path:
            parts = video_path.split('/')
            if len(parts) >= 3 and parts[0] == 'videos':
                scenario_id = parts[1]
                video_filename = parts[-1]
            else:
                video_filename = parts[-1] if parts else ''
        # If not derivable, fall back to the requested video_name
        if not video_filename:
            video_filename = f"{video_name}.mp4"
        video_id = Path(video_filename).stem

        # Pull common fields from the first item, if present
        task_label = first.get('task_label') or ''
        environment = first.get('environment') or ''
        obj = first.get('object') or ''

        interactions = []
        actions_list = []  # preserve insertion order of unique labels
        for it in data:
            if not isinstance(it, dict):
                continue
            label = it.get('action_label')
            if isinstance(label, str) and label and label not in actions_list:
                actions_list.append(label)
            interactions.append({
                'start_time': it.get('start_time'),
                'end_time': it.get('end_time'),
                'start_frame': it.get('start_frame'),
                'end_frame': it.get('end_frame'),
                'action_label': it.get('action_label'),
                'contact': it.get('contact', False),
            })

        legacy = {
            'scenario_id': scenario_id,
            'video_id': video_id,
            'video_filename': video_filename,
            'task_label': task_label,
            'environment': environment,
            'object': obj,
            'actions': actions_list,
            'interactions': interactions,
        }
        return JSONResponse(content=legacy, headers={"Cache-Control": "no-store"})

    # If it's already an object (legacy), return as-is
    if isinstance(data, dict):
        return JSONResponse(content=data, headers={"Cache-Control": "no-store"})

    # Unknown content shape; fallback to direct file response
    return FileResponse(
        target_path,
        media_type='application/json',
        filename=target_path.name,
        headers={"Cache-Control": "no-store"},
    )


@app.get('/videos')
async def get_videos():
    video_dir = DEFAULT_VIDEO_DIR
    files = list_video_files(video_dir)
    return {"videos": files}


@app.get('/video/{filename:path}')
async def stream_video(filename: str):
    video_path = _resolve_video_path(filename)
    mime_type, _ = mimetypes.guess_type(video_path)
    return FileResponse(video_path, media_type=mime_type or 'application/octet-stream', filename=video_path.name)