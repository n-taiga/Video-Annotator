from pydantic import BaseModel
from typing import List

class Interaction(BaseModel):
    start_time: float
    end_time: float
    start_frame: int
    end_frame: int
    action_label: str
    contact: bool

class Annotation(BaseModel):
    scenario_id: str
    video_id: str
    video_filename: str
    task_label: str
    environment: str
    object: str
    actions: List[str]
    interactions: List[Interaction]