from typing import Optional
from fastapi import APIRouter, HTTPException, Body
from services.inference_sam import Inference
from models.inference_sam import PredictPayload, FrameResult

router = APIRouter(tags=["inference"])

inference = Inference()

@router.post("/start_session")
def start_session(body: Optional[dict] = Body(None)):
    """Start a new session. Accepts optional JSON {"path": "..."}."""
    try:
        path = None
        if body and isinstance(body, dict):
            path = body.get("path")
        session_id = inference.start_session(path)
        return {"sessionId": session_id}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/predict", response_model=FrameResult)
def predict(payload: PredictPayload):
    """Run prediction for a single frame using an existing sessionId."""
    try:
        result = inference.predict(payload)
        return result
    except ValueError as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(exc))
    except NotImplementedError as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=501, detail=str(exc))
    except RuntimeError as exc:
        import traceback
        traceback.print_exc()
        # 404だとルーティングエラーと区別がつかないため、一時的に500にするか、ログを出す
        raise HTTPException(status_code=404, detail=f"Session error: {exc}")
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))

@router.post("/close_session")
def close_session(body: Optional[dict] = Body(None)):
    """Close and free a session: expects JSON {"sessionId": "..."}."""
    try:
        session_id = None
        if body and isinstance(body, dict):
            session_id = body.get("sessionId")
        if not session_id:
            raise HTTPException(status_code=400, detail="sessionId required")
        ok = inference.close_session(session_id)
        return {"success": ok}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))