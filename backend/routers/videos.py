from fastapi import APIRouter
from fastapi.responses import FileResponse

from services.video import (
    VIDEO_DIR,
    guess_mime,
    list_video_files,
    resolve_video_path,
)


router = APIRouter(tags=["videos"])


@router.get("/videos")
async def get_videos():
    """Return the list of available video files."""
    videos = list_video_files(VIDEO_DIR)
    return {"videos": videos}


@router.get("/video/{filename:path}")
async def stream_video(filename: str):
    """Stream a video file by resolving it against the configured base directory."""
    video_path = resolve_video_path(filename)
    mime_type = guess_mime(video_path)
    return FileResponse(
        video_path,
        media_type=mime_type,
        filename=video_path.name,
    )