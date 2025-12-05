import base64
import contextlib
import io
import logging
import os
import uuid
from threading import Lock
from typing import Optional, Union

import numpy as np
import torch
import cv2
from PIL import Image
from fastapi import HTTPException

from models.inference_sam import (
    EncodedMask,
    PredictPayload,
    FrameResult,
    ObjectPayload,
    ObjectResult,
)
from sam2.build_sam import build_sam2_video_predictor
from sam2.utils.transforms import SAM2Transforms
from collections import OrderedDict

from .video import resolve_video_path

logger = logging.getLogger(__name__)

APP_ROOT = os.getenv("APP_ROOT", "/app")
MODEL_SIZE = os.getenv("MODEL_SIZE", "base_plus")


def get_video_frame(
    video_path: str,
    frame_index: int,
) -> Optional[Image.Image]:
    """Extract a specific frame from a video file as a PIL Image (RGBA)."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        logger.error("Failed to open video file: %s", video_path)
        return None

    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    if frame_index < 0 or frame_index >= total_frames:
        logger.error("Frame index %d out of bounds for video with %d frames", frame_index, total_frames)
        cap.release()
        return None

    cap.set(cv2.CAP_PROP_POS_FRAMES, frame_index)
    ret, frame = cap.read()  # frame is in BGR format
    cap.release()

    if not ret:
        logger.error("Failed to read frame %d from video %s", frame_index, video_path)
        return None

    # Convert BGR (OpenCV) to RGB (PIL)
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    pil_image = Image.fromarray(frame_rgb).convert("RGBA")
    return pil_image


def decode_image(image_b64: str) -> Image.Image:
    if image_b64.startswith("data:"):
        try:
            image_b64 = image_b64.split(",", 1)[1]
        except Exception:
            raise HTTPException(400, "Invalid data URL")
    try:
        image_bytes = base64.b64decode(image_b64)
    except Exception as exc:
        raise HTTPException(400, f"Invalid base64: {exc}")

    try:
        return Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    except Exception as exc:
        raise HTTPException(400, f"Failed to open image: {exc}")


def mask_png_bytes(mask: np.ndarray) -> bytes:
    """Generate a PNG with transparent background and an opaque white mask.

    The input mask is expected to be a uint8 numpy array (0 or 255).
    The returned image is RGBA where the alpha channel is 255 inside the
    mask and 0 elsewhere.
    """
    height, width = mask.shape
    mask_image = Image.fromarray(mask, mode="L")

    rgba = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    # Paste a white color where mask is non-zero, using mask as alpha
    rgba.paste((255, 255, 255, 255), (0, 0), mask_image)

    with io.BytesIO() as out:
        rgba.save(out, format="PNG")
        return out.getvalue()


def _encode_mask_to_base64(mask: np.ndarray) -> str:
    """Encode a uint8 mask (0-255) to base64 PNG (RGBA)."""
    # Reuse the logic from mask_png_bytes to get RGBA bytes
    png_bytes = mask_png_bytes(mask)
    return base64.b64encode(png_bytes).decode("ascii")


class Inference:
    """Inference service for handling SAM2 predictions."""

    def __init__(self) -> None:
        self.score_thresh = 0.0
        self.device = self._select_device()
        self.predictor = self._build_predictor(self.device)
        self.inference_lock = Lock()
        self.session_states = {}

    def _select_device(self) -> torch.device:
        force_cpu_device = os.environ.get("SAM2_DEMO_FORCE_CPU_DEVICE", "0") == "1"
        # force_cpu_device = True
        if torch.cuda.is_available() and not force_cpu_device:
            device = torch.device("cuda")
        elif torch.backends.mps.is_available() and not force_cpu_device:
            device = torch.device("mps")
        else:
            device = torch.device("cpu")
        logger.info("using device: %s", device)

        if device.type == "cuda" and torch.cuda.get_device_properties(0).major >= 8:
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True
        elif device.type == "mps":
            logger.warning(
                "Support for MPS devices is preliminary; results may differ from CUDA."
            )
        return device

    def _build_predictor(self, device: torch.device) -> object:
        if MODEL_SIZE == "tiny":
            checkpoint = os.path.join(APP_ROOT, "checkpoints/sam2.1_hiera_tiny.pt")
            model_cfg = "configs/sam2.1/sam2.1_hiera_t.yaml"
        elif MODEL_SIZE == "small":
            checkpoint = os.path.join(APP_ROOT, "checkpoints/sam2.1_hiera_small.pt")
            model_cfg = "configs/sam2.1/sam2.1_hiera_s.yaml"
        elif MODEL_SIZE == "large":
            checkpoint = os.path.join(APP_ROOT, "checkpoints/sam2.1_hiera_large.pt")
            model_cfg = "configs/sam2.1/sam2.1_hiera_l.yaml"
        else:
            checkpoint = os.path.join(APP_ROOT, "checkpoints/sam2.1_hiera_base_plus.pt")
            model_cfg = "configs/sam2.1/sam2.1_hiera_b+.yaml"

        logger.info("loading SAM2 video predictor: cfg=%s", model_cfg)
        predictor = build_sam2_video_predictor(model_cfg, ckpt_path=checkpoint, device=device)
        return predictor

    def autocast_context(self):
        if self.device.type == "cuda":
            return torch.autocast("cuda", dtype=torch.bfloat16)
        return contextlib.nullcontext()

    def start_session(self, path: Optional[Union[str, bytes]] = None, session_id: Optional[str] = None) -> str:
        """Create a new session and return its id.

        If `path` (str path or bytes) is provided, call `self.predictor.init_state(path, ...)`
        to initialize a full video inference_state immediately. If `path` is None, create an
        empty state that will be populated on the first `predict` call for that session.
        """
        with self.autocast_context(), self.inference_lock:
            if not session_id:
                session_id = str(uuid.uuid4())
            offload_video_to_cpu = self.device.type == "mps"

            if path is not None:
                inference_state = self.predictor.init_state(
                    path,
                    offload_video_to_cpu=offload_video_to_cpu,
                )
            else:
                # Initialize an empty state manually
                inference_state = {}
                inference_state["images"] = None
                inference_state["num_frames"] = 0
                inference_state["offload_video_to_cpu"] = offload_video_to_cpu
                inference_state["offload_state_to_cpu"] = False
                inference_state["video_height"] = None
                inference_state["video_width"] = None
                inference_state["device"] = self.device
                inference_state["storage_device"] = self.device
                inference_state["point_inputs_per_obj"] = {}
                inference_state["mask_inputs_per_obj"] = {}
                inference_state["cached_features"] = {}
                inference_state["constants"] = {}
                inference_state["obj_id_to_idx"] = OrderedDict()
                inference_state["obj_idx_to_id"] = OrderedDict()
                inference_state["obj_ids"] = []
                inference_state["output_dict_per_obj"] = {}
                inference_state["temp_output_dict_per_obj"] = {}
                inference_state["frames_tracked_per_obj"] = {}

            self.session_states[session_id] = {"canceled": False, "state": inference_state}
            return session_id

    def close_session(self, session_id: str) -> bool:
        """Remove a session and free its state."""
        with self.inference_lock:
            session = self.session_states.pop(session_id, None)
            if session is None:
                logger.warning("cannot close session %s as it does not exist", session_id)
                return False
            logger.info("removed session %s", session_id)
            return True

    def __get_session(self, session_id: str):
        session = self.session_states.get(session_id, None)
        if session is None:
            raise RuntimeError(
                f"Cannot find session {session_id}; it might have expired"
            )
        return session

    def predict(self, payload: PredictPayload, return_binary: bool = False) -> FrameResult:
        """Run prediction for a single frame.
        
        Args:
            payload: Prediction request payload
            return_binary: If True, mask.data contains raw PNG bytes instead of base64 string
        
        Returns:
            FrameResult with mask data (base64 or binary depending on return_binary)
        """
        if not payload.videoPath:
            raise HTTPException(status_code=400, detail="videoPath is required")
        frame_index = payload.frameIndex
        if frame_index is None:
            raise HTTPException(status_code=400, detail="frameIndex is required")

        resolved_video_path = resolve_video_path(payload.videoPath)
        image = get_video_frame(str(resolved_video_path), frame_index)
        if image is None:
            raise HTTPException(status_code=400, detail="Failed to extract frame from video")
        video_W, video_H = image.size

        # Offload frames to CPU for MPS as demo does
        offload_video_to_cpu = self.device.type == "mps"

        # Prepare a normalized tensor for the model
        transforms = SAM2Transforms(resolution=self.predictor.image_size, mask_threshold=self.score_thresh)
        pil_img = image.convert("RGB")
        img_tensor = transforms(pil_img)  # 3 x H x W (model resolution)
        images = img_tensor.unsqueeze(0)  # 1 x 3 x R x R
        if not offload_video_to_cpu:
            images = images.to(self.device)

        # Require a session for predict: use the centralized __get_session helper.
        session_id = getattr(payload, "sessionId", None)
        if not session_id:
            # If no sessionId provided, generate one (though frontend should usually provide it)
            session_id = str(uuid.uuid4())
            payload.sessionId = session_id

        # Auto-create session if missing (stateless/lazy init support)
        if session_id not in self.session_states:
            logger.info("Auto-creating session %s for predict call", session_id)
            self.start_session(path=None, session_id=session_id)

        session = self.__get_session(session_id)
        inference_state = session["state"]
        
        # Determine if we are in "Single Image / Stateless" mode.
        # If num_frames <= 1, we assume we are handling frames one by one via payload.
        # If num_frames > 1, we assume a full video was loaded via start_session(path=...).
        is_stateless_mode = inference_state.get("num_frames", 0) <= 1
        target_frame_idx = frame_index

        if is_stateless_mode:
            # In stateless mode, we only hold one image in memory (the current one).
            # We must map the requested frameIndex to 0.
            
            # Check if the frame has changed since the last call
            last_frame_idx = session.get("last_frame_idx", -1)
            current_frame_idx = frame_index
            
            if last_frame_idx != current_frame_idx:
                # Frame changed: Reset state and update image
                # We reset state because the previous points/masks belong to a different image
                self.predictor.reset_state(inference_state)
                inference_state["cached_features"] = {}
                session["last_frame_idx"] = current_frame_idx
                
                # Update the image in inference_state
                inference_state["images"] = images
                inference_state["num_frames"] = 1
                inference_state["video_height"] = video_H
                inference_state["video_width"] = video_W
                inference_state["device"] = self.device
                inference_state["storage_device"] = torch.device("cpu") if inference_state["offload_state_to_cpu"] else self.device
                
                # Ensure dictionaries exist (in case reset_state cleared them differently or first run)
                inference_state.setdefault("point_inputs_per_obj", {})
                inference_state.setdefault("mask_inputs_per_obj", {})
                inference_state.setdefault("cached_features", {})
                inference_state.setdefault("constants", {})
                inference_state.setdefault("obj_id_to_idx", OrderedDict())
                inference_state.setdefault("obj_idx_to_id", OrderedDict())
                inference_state.setdefault("obj_ids", [])
                inference_state.setdefault("output_dict_per_obj", {})
                inference_state.setdefault("temp_output_dict_per_obj", {})
                inference_state.setdefault("frames_tracked_per_obj", {})
            
            # If frame hasn't changed, we reuse the existing image and state (refining mask)
            # But we must ensure inference_state["images"] is set (for the very first call)
            if inference_state.get("images") is None:
                 inference_state["images"] = images
                 inference_state["num_frames"] = 1
                 inference_state["video_height"] = video_H
                 inference_state["video_width"] = video_W
                 inference_state["device"] = self.device
                 inference_state["storage_device"] = torch.device("cpu") if inference_state["offload_state_to_cpu"] else self.device
                 session["last_frame_idx"] = current_frame_idx

            # Force internal frame index to 0
            target_frame_idx = 0

        results: list[ObjectResult] = []

        with self.autocast_context(), self.inference_lock:
            logger.debug(
                "predict called: session=%s frame=%s (mapped to %s) objects=%d",
                payload.sessionId,
                frame_index,
                target_frame_idx,
                len(list(payload.iter_objects())),
            )

            for obj in payload.iter_objects():
                logger.debug("processing object %s with %d points", obj.objectId, len(obj.points))
                if not obj.points:
                    logger.debug("skipping object %s because it has no points", obj.objectId)
                    continue

                coords = np.array([[p.x, p.y] for p in obj.points], dtype=np.float32)
                labels = np.array([p.label for p in obj.points], dtype=np.int32)

                # add new prompts/state and get updated masks for all objects
                frame_idx_out, object_ids, video_res_masks = self.predictor.add_new_points_or_box(
                    inference_state=inference_state,
                    frame_idx=target_frame_idx,
                    obj_id=obj.objectId,
                    points=coords,
                    labels=labels,
                    clear_old_points=True,
                    normalize_coords=False,
                )

                # video_res_masks: torch tensor [num_objects, 1, H, W]
                logger.debug(
                    "predictor returned: frame_idx=%s obj_ids=%s masks_shape=%s",
                    frame_idx_out,
                    object_ids,
                    None if video_res_masks is None else tuple(video_res_masks.shape),
                )
                video_res_masks = video_res_masks.cpu().numpy()
                try:
                    obj_index = list(object_ids).index(obj.objectId)
                except ValueError:
                    # Shouldn't happen, but skip if not found
                    continue

                mask = video_res_masks[obj_index, 0]
                binary_mask = (mask > self.score_thresh).astype(np.uint8) * 255

                # Derive a simple per-object confidence score from the mask logits.
                # We take the mean of the mask scores and pass through a sigmoid to map to [0,1].
                try:
                    raw_score = float(np.mean(mask))
                    score = float(1.0 / (1.0 + np.exp(-raw_score)))
                    if not np.isfinite(score):
                        score = 0.0
                except Exception:
                    score = 0.0

                # Get PNG bytes
                png_bytes = mask_png_bytes(binary_mask)
                
                encoded_mask = EncodedMask(
                    width=video_W,
                    height=video_H,
                    format="png",
                    data=png_bytes if return_binary else base64.b64encode(png_bytes).decode("ascii"),
                )

                results.append(
                    ObjectResult(
                        objectId=obj.objectId,
                        score=score,
                        mask=encoded_mask,
                        meta=obj.meta,
                    )
                )

        return FrameResult(
            sessionId=payload.sessionId,
            frameIndex=frame_index,
            results=results,
            meta=payload.meta,
        )
