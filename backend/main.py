import json
import mimetypes
import os
from pathlib import Path
from threading import Lock
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from models import Annotation
from pydantic import BaseModel

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

DEFAULT_ACTION_LABELS: Dict[str, str] = {
    "Drink": "#F97316",
    "Pour": "#22D3EE",
    "Stir": "#A855F7",
    "Spill": "#FB7185",
    "Pick up": "#22C55E",
    "Put down": "#FACC15",
    "Carry": "#38BDF8",
    "Look at": "#F471B5",
    "Point at": "#94A3B8",
    "Approach": "#F973D5",
    "Move away": "#0EA5E9",
    "None": "#64748B",
}

_DEFAULT_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
ACTION_LABELS_PATH = Path(os.environ.get("ACTION_LABELS_PATH", _DEFAULT_DATA_DIR / "actionLabels.json")).resolve()
ACTION_LABEL_LOCK = Lock()
OBJECT_LABELS_PATH = Path(os.environ.get("OBJECT_LABELS_PATH", _DEFAULT_DATA_DIR / "objectLabels.json")).resolve()
OBJECT_LABEL_LOCK = Lock()
DEFAULT_OBJECT_COLOR = "#94A3B8"


def _normalize_color(value: str) -> str:
    raw = value.strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Color values cannot be empty")
    if raw.startswith('#'):
        raw = raw[1:]
    raw = raw.upper()
    if len(raw) not in (3, 6) or any(ch not in "0123456789ABCDEF" for ch in raw):
        raise HTTPException(status_code=400, detail=f"Invalid color code '#{raw}'")
    return f"#{raw}"


def _normalize_action_labels(raw: Dict[str, str], *, allow_empty: bool = False) -> Dict[str, str]:
    normalized: Dict[str, str] = {}
    for key, value in raw.items():
        if not isinstance(key, str):
            continue
        label = key.strip()
        if not label:
            continue
        if not isinstance(value, str):
            raise HTTPException(status_code=400, detail=f"Invalid color for label '{label}'")
        normalized[label] = _normalize_color(value)
    if not normalized:
        if allow_empty:
            return {}
        raise HTTPException(status_code=400, detail="At least one action label must be provided")
    return normalized


def _ensure_action_label_file() -> None:
    path = ACTION_LABELS_PATH
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot create directory for action labels: {path.parent}") from exc
    if path.exists():
        return
    try:
        path.write_text(json.dumps(DEFAULT_ACTION_LABELS, ensure_ascii=False, indent=2), encoding='utf-8')
    except PermissionError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot write action labels file: {path}") from exc


def _load_action_labels() -> Dict[str, str]:
    with ACTION_LABEL_LOCK:
        _ensure_action_label_file()
        try:
            data = json.loads(ACTION_LABELS_PATH.read_text(encoding='utf-8'))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to read action labels: {exc}") from exc
        if not isinstance(data, dict):
            # Reset to defaults if file is corrupt
            ACTION_LABELS_PATH.write_text(json.dumps(DEFAULT_ACTION_LABELS, ensure_ascii=False, indent=2), encoding='utf-8')
            return dict(DEFAULT_ACTION_LABELS)
        try:
            normalized = _normalize_action_labels(data, allow_empty=False)
        except HTTPException:
            ACTION_LABELS_PATH.write_text(json.dumps(DEFAULT_ACTION_LABELS, ensure_ascii=False, indent=2), encoding='utf-8')
            return dict(DEFAULT_ACTION_LABELS)
        if normalized != data:
            ACTION_LABELS_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding='utf-8')
        return normalized


def _save_action_labels(labels: Dict[str, str]) -> Dict[str, str]:
    normalized = _normalize_action_labels(labels)
    with ACTION_LABEL_LOCK:
        try:
            ACTION_LABELS_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding='utf-8')
        except PermissionError as exc:
            raise HTTPException(status_code=500, detail=f"Cannot write action labels file: {ACTION_LABELS_PATH}") from exc
    return normalized


def _ensure_object_label_file() -> None:
    path = OBJECT_LABELS_PATH
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot create directory for object labels: {path.parent}") from exc
    if path.exists():
        return
    try:
        # create an empty list file by default; repository may include a starter file
        path.write_text(json.dumps([], ensure_ascii=False, indent=2), encoding='utf-8')
    except PermissionError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot write object labels file: {path}") from exc


def _load_object_labels() -> Dict[str, str]:
    with OBJECT_LABEL_LOCK:
        _ensure_object_label_file()
        try:
            data = json.loads(OBJECT_LABELS_PATH.read_text(encoding='utf-8'))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to read object labels: {exc}") from exc
        # Accept either a dict (name -> color) or a list of names (colorless storage)
        if isinstance(data, dict):
            try:
                normalized = _normalize_action_labels(data, allow_empty=True)
            except HTTPException:
                # Corrupt dict -> reset to empty list
                OBJECT_LABELS_PATH.write_text(json.dumps([], ensure_ascii=False, indent=2), encoding='utf-8')
                return {}
            # Keep file as-is (dict) if it was a dict; but normalize values
            if normalized != data:
                OBJECT_LABELS_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding='utf-8')
            return normalized
        if isinstance(data, list):
            # Validate list of strings and convert to dict with default colors for frontend
            result: Dict[str, str] = {}
            for item in data:
                if not isinstance(item, str):
                    continue
                name = item.strip()
                if not name:
                    continue
                result[name] = DEFAULT_OBJECT_COLOR
            return result
        # Unknown content shape; reset to empty list
        OBJECT_LABELS_PATH.write_text(json.dumps([], ensure_ascii=False, indent=2), encoding='utf-8')
        return {}


def _save_object_labels(labels: Dict[str, str]) -> Dict[str, str]:
    # Accept a dict of name->color, but persist only the names (colorless storage)
    # Validate keys
    names: List[str] = []
    for key in labels.keys():
        if not isinstance(key, str):
            continue
        name = key.strip()
        if not name:
            continue
        names.append(name)
    with OBJECT_LABEL_LOCK:
        try:
            OBJECT_LABELS_PATH.write_text(json.dumps(names, ensure_ascii=False, indent=2), encoding='utf-8')
        except PermissionError as exc:
            raise HTTPException(status_code=500, detail=f"Cannot write object labels file: {OBJECT_LABELS_PATH}") from exc
    # Return a dict mapping names to provided colors (or default)
    out: Dict[str, str] = {}
    for name in names:
        color = labels.get(name)
        if isinstance(color, str):
            try:
                out[name] = _normalize_color(color)
            except HTTPException:
                out[name] = DEFAULT_OBJECT_COLOR
        else:
            out[name] = DEFAULT_OBJECT_COLOR
    return out


class ActionLabelPayload(BaseModel):
    labels: Dict[str, str]



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


@app.get('/config/action-labels')
async def get_action_labels():
    labels = _load_action_labels()
    return {"labels": labels}


@app.put('/config/action-labels')
async def update_action_labels(payload: ActionLabelPayload):
    labels = _save_action_labels(payload.labels)
    return {"labels": labels}


@app.get('/config/object-labels')
async def get_object_labels():
    labels = _load_object_labels()
    return {"labels": labels}


@app.put('/config/object-labels')
async def update_object_labels(payload: ActionLabelPayload):
    labels = _save_object_labels(payload.labels)
    return {"labels": labels}