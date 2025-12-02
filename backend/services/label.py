import json
import os
from pathlib import Path
from threading import Lock
from fastapi import HTTPException


# Default label definitions mirror the current behaviour in main.py
DEFAULT_ACTION_LABELS: dict[str, str] = {
    "Grab": "#1FE100",
    "Put down": "#129EFF",
    "Carry": "#FFCF09",
    "Store": "#FD9100",
    "Point at": "#47ABF9",
    "Look at": "#F9419E",
    "Approach": "#89DE0A",
    "Move away": "#AD03A7",
}

DEFAULT_OBJECT_COLOR = "#94A3B8"

DATA_ROOT = Path(os.environ.get("DATA_ROOT", Path(__file__).resolve().parent.parent / "data"))

ACTION_LABELS_PATH = Path(
    os.environ.get("ACTION_LABELS_PATH", DATA_ROOT / "actionLabels.json")
).resolve()
OBJECT_LABELS_PATH = Path(
    os.environ.get("OBJECT_LABELS_PATH", DATA_ROOT / "objectLabels.json")
).resolve()

ACTION_LABEL_LOCK = Lock()
OBJECT_LABEL_LOCK = Lock()


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


def _normalize_action_labels(raw: dict[str, str], *, allow_empty: bool = False) -> dict[str, str]:
    normalized: dict[str, str] = {}
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


def _ensure_object_label_file() -> None:
    path = OBJECT_LABELS_PATH
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except PermissionError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot create directory for object labels: {path.parent}") from exc
    if path.exists():
        return
    try:
        path.write_text(json.dumps([], ensure_ascii=False, indent=2), encoding='utf-8')
    except PermissionError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot write object labels file: {path}") from exc


def load_action_labels() -> dict[str, str]:
    with ACTION_LABEL_LOCK:
        _ensure_action_label_file()
        try:
            data = json.loads(ACTION_LABELS_PATH.read_text(encoding='utf-8'))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to read action labels: {exc}") from exc
        if not isinstance(data, dict):
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


def save_action_labels(labels: dict[str, str]) -> dict[str, str]:
    normalized = _normalize_action_labels(labels)
    with ACTION_LABEL_LOCK:
        try:
            ACTION_LABELS_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding='utf-8')
        except PermissionError as exc:
            raise HTTPException(status_code=500, detail=f"Cannot write action labels file: {ACTION_LABELS_PATH}") from exc
    return normalized


def load_object_labels() -> dict[str, str]:
    with OBJECT_LABEL_LOCK:
        _ensure_object_label_file()
        try:
            data = json.loads(OBJECT_LABELS_PATH.read_text(encoding='utf-8'))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Failed to read object labels: {exc}") from exc
        if isinstance(data, dict):
            try:
                normalized = _normalize_action_labels(data, allow_empty=True)
            except HTTPException:
                OBJECT_LABELS_PATH.write_text(json.dumps([], ensure_ascii=False, indent=2), encoding='utf-8')
                return {}
            if normalized != data:
                OBJECT_LABELS_PATH.write_text(json.dumps(normalized, ensure_ascii=False, indent=2), encoding='utf-8')
            return normalized
        if isinstance(data, list):
            result: dict[str, str] = {}
            for item in data:
                if not isinstance(item, str):
                    continue
                name = item.strip()
                if not name:
                    continue
                result[name] = DEFAULT_OBJECT_COLOR
            return result
        OBJECT_LABELS_PATH.write_text(json.dumps([], ensure_ascii=False, indent=2), encoding='utf-8')
        return {}


def save_object_labels(labels: dict[str, str]) -> dict[str, str]:
    names: list[str] = []
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
    out: dict[str, str] = {}
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


__all__ = [
    "load_action_labels",
    "save_action_labels",
    "load_object_labels",
    "save_object_labels",
]
