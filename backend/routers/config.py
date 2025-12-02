from fastapi import APIRouter

from models.config_labels import ActionLabelPayload, ObjectLabelPayload
from services.label import (
    load_action_labels,
    save_action_labels,
    load_object_labels,
    save_object_labels,
)

router = APIRouter(prefix="/config", tags=["config"])

@router.get("/action-labels")
async def get_action_labels():
    labels = load_action_labels()
    return {"labels": labels}

@router.put("/action-labels")
async def update_action_labels(payload: ActionLabelPayload):
    labels = save_action_labels(payload.labels)
    return {"labels": labels}

@router.get("/object-labels")
async def get_object_labels():
    labels = load_object_labels()
    return {"labels": labels}

@router.put("/object-labels")
async def update_object_labels(payload: ObjectLabelPayload):
    labels = save_object_labels(payload.labels)
    return {"labels": labels}
