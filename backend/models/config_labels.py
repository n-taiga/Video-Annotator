from pydantic import BaseModel

class ActionLabelPayload(BaseModel):
    """Payload for updating action labels (e.g., 'Grab': '#FF0000')."""
    labels: dict[str, str]
    
class ObjectLabelPayload(BaseModel):
    """Payload for updating object labels (e.g., 'spoon': '#00FF00')."""
    labels: dict[str, str]