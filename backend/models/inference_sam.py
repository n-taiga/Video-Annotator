from pydantic import BaseModel, Field
from typing import Optional, Iterable, Union
from enum import Enum
import numpy as np

class PointPayload(BaseModel):
    """Single annotation point expressed in normalized coordinates."""
    id: str
    x: float = Field(ge=0.0, le=1.0)
    y: float = Field(ge=0.0, le=1.0)
    label: int = Field(ge=0)

    def to_pixel(self, image_size: tuple[int, int]) -> tuple[float, float, int]:
        width, height = image_size
        return (self.x * width, self.y * height, int(self.label))

class ObjectMeta(BaseModel):
    lastTimestamp: Optional[float] = None
    lastSource: Optional[str] = None
    frameIndex: Optional[int] = None
    objectId: Optional[int] = None


class ObjectPayload(BaseModel):
    objectId: Optional[int] = None
    points: list[PointPayload] = Field(default_factory=list)
    meta: Optional[ObjectMeta] = None
    
    def points_as_pixels(self, image_size: tuple[int, int]) -> np.ndarray:
        if not self.points:
            return np.zeros((0, 3), dtype=np.float32)
        pixels = [point.to_pixel(image_size) for point in self.points]
        return np.asarray(pixels, dtype=np.float32)

class FrameMeta(BaseModel):
    pointCount: int
    objectCount: int

class PredictPayload(BaseModel):
    # Required top-level metadata
    sessionId: Optional[str] = None
    frameIndex: Optional[int] = None
    videoPath: Optional[str] = None
    image: Optional[str] = None
    objects: list[ObjectPayload] = Field(default_factory=list)   
    meta: Optional[FrameMeta] = None

    def iter_objects(self) -> Iterable[ObjectPayload]:
        """Iterator over contained ObjectPayload instances."""
        return iter(self.objects)
    
class EncodedMask(BaseModel):
    width: int
    height: int
    format: str
    data: Union[str, bytes]  # str for base64, bytes for binary


class PropagateMode(str, Enum):
    bidirectional = "bidirectional"
    forward = "forward"
    reverse = "reverse"


class PropagateClick(BaseModel):
    frameIndex: int
    objectId: int
    points: list[PointPayload] = Field(default_factory=list)


class PropagatePayload(BaseModel):
    sessionId: Optional[str] = None
    videoPath: str
    source: PropagateClick
    target: PropagateClick
    maxSeconds: float = 10.0
    mode: PropagateMode = PropagateMode.bidirectional


class ObjectResult(BaseModel):
    objectId: int
    score: float
    mask: EncodedMask
    meta: Optional[ObjectMeta] = None


class FrameResult(BaseModel):
    sessionId: str
    frameIndex: int
    results: list[ObjectResult] = Field(default_factory=list)
    meta: Optional[FrameMeta] = None
