from typing import Optional, Any
from pydantic import BaseModel, Field, root_validator, validator


class Interaction(BaseModel):
	"""A single annotated interaction within a video.

	Many fields are optional to be tolerant of older/partial exports.
	"""
	start_time: Optional[float] = 0.0
	end_time: Optional[float] = 0.0
	start_frame: Optional[int] = 0
	end_frame: Optional[int] = 0
	action_label: Optional[str] = ""
	contact: Optional[bool] = False

	# Per-interaction convenience fields (may be present in hybrid exports)
	video_path: Optional[str] = None
	object: Optional[str] = None
	environment: Optional[str] = None

	@validator("start_time", "end_time", pre=True, always=True)
	def _coerce_time(cls, v):
		try:
			return float(v) if v is not None and v != "" else 0.0
		except Exception:
			return 0.0

	@validator("start_frame", "end_frame", pre=True, always=True)
	def _coerce_frame(cls, v):
		try:
			return int(v) if v is not None and v != "" else 0
		except Exception:
			return 0

	@validator("action_label", pre=True, always=True)
	def _coerce_label(cls, v):
		return "" if v is None else str(v)


class Annotation(BaseModel):
	"""Top-level annotation payload accepted by the backend.

	This model is intentionally permissive: many fields are optional or
	defaulted so older annotations (or partial frontend payloads) validate.
	It also accepts the legacy 'task_label' key and maps it to 'task'.
	"""
	scenario_id: Optional[str] = ""
	video_id: Optional[str] = ""
	video_path: Optional[str] = ""
	video_filename: Optional[str] = ""
	# canonical field name is 'task'
	task: Optional[str] = Field("", description="Canonical task name")
	environment: Optional[str] = ""
	object: Optional[str] = ""
	actions: Optional[list[str]] = Field(default_factory=list)
	interactions: Optional[list[Interaction]] = Field(default_factory=list)

	# Accept unknown extras but ignore them
	class Config:
		extra = "ignore"
		allow_population_by_field_name = True

	@root_validator(pre=True)
	def _map_legacy_keys(cls, values: dict[str, Any]) -> dict[str, Any]:
		# Support old 'task_label' key by mapping it to 'task' when present
		if "task_label" in values and "task" not in values:
			values["task"] = values.get("task_label")
		# Normalize interactions to an empty list if missing
		if "interactions" not in values or values.get("interactions") is None:
			values["interactions"] = []
		return values