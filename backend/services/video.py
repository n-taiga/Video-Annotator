import mimetypes
import os
from pathlib import Path
from typing import Union

from fastapi import HTTPException

VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".avi"}
DATA_ROOT = Path(os.environ.get("DATA_ROOT", Path(__file__).resolve().parent.parent / "data"))
VIDEO_DIR = Path(os.path.join(DATA_ROOT, "videos"))

def list_video_files(directory: Union[Path, str, None] = None) -> list[str]:
    """Return video files under directory recursively as POSIX-style relative paths."""
    if directory is None:
        base = VIDEO_DIR.resolve()
    else:
        base = Path(directory).resolve()

    if not base.exists() or not base.is_dir():
        return []

    files: list[str] = []
    for item in base.rglob("*"):
        if not item.is_file() or item.suffix.lower() not in VIDEO_EXTENSIONS:
            continue
        try:
            rel = item.relative_to(base).as_posix()
        except Exception:
            rel = item.name
        if rel.split("/", 1)[0].lower() == "reference":
            continue
        files.append(rel)
    return sorted(files)

def resolve_video_path(filename: str) -> Path:
    base = VIDEO_DIR.resolve()
    rel = Path(filename)

    if rel.is_absolute():
        raise HTTPException(status_code=400, detail="Absolute paths not allowed")
    parts = rel.parts
    if parts and parts[0].lower() == "videos":
        rel = Path(*parts[1:]) if len(parts) > 1 else Path(rel.name)
    target = (base / rel).resolve()
    try:
        target.relative_to(base)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid video path")
    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail="Video not found")
    return target


def guess_mime(path: Path) -> str:
    mime, _ = mimetypes.guess_type(path)
    return mime or "application/octet-stream"


__all__ = [
    "VIDEO_DIR",
    "list_video_files",
    "resolve_video_path",
    "guess_mime",
]