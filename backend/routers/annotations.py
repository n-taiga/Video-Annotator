from fastapi import APIRouter
from models.annotation import Annotation

from services.annotation import (
    save_annotation_to_file,
    load_annotation_file,
)

router = APIRouter()

@router.post("/save")
async def save_annotation(annotation: Annotation):
    return save_annotation_to_file(annotation)

@router.get("/load/{video_name:path}")
async def load_annotation(video_name: str):
    return load_annotation_file(video_name)