from typing import Dict, Generator, List, Tuple, Union
import uuid


class MultipartResponseBuilder:
    """Builder for a single multipart part."""
    message: bytes

    def __init__(self, boundary: str) -> None:
        self.message = b"--" + boundary.encode("utf-8") + b"\r\n"

    @classmethod
    def build(
        cls, boundary: str, headers: Dict[str, str], body: Union[str, bytes]
    ) -> "MultipartResponseBuilder":
        builder = cls(boundary=boundary)
        for k, v in headers.items():
            builder.__append_header(key=k, value=v)
        if isinstance(body, bytes):
            builder.__append_body(body)
        elif isinstance(body, str):
            builder.__append_body(body.encode("utf-8"))
        else:
            raise ValueError(
                f"body needs to be of type bytes or str but got {type(body)}"
            )

        return builder

    def get_message(self) -> bytes:
        return self.message

    def __append_header(self, key: str, value: str) -> "MultipartResponseBuilder":
        self.message += key.encode("utf-8") + b": " + value.encode("utf-8") + b"\r\n"
        return self

    def __close_header(self) -> "MultipartResponseBuilder":
        self.message += b"\r\n"
        return self

    def __append_body(self, body: bytes) -> "MultipartResponseBuilder":
        self.__append_header(key="Content-Length", value=str(len(body)))
        self.__close_header()
        self.message += body
        return self


def generate_boundary() -> str:
    """Generate a unique boundary string for multipart response."""
    return f"mask-{uuid.uuid4().hex[:16]}"


def build_multipart_closing(boundary: str) -> bytes:
    """Build the closing boundary marker."""
    return b"\r\n--" + boundary.encode("utf-8") + b"--\r\n"


def build_json_part(boundary: str, data: dict) -> bytes:
    """Build a JSON part for multipart response."""
    import json
    body = json.dumps(data)
    builder = MultipartResponseBuilder.build(
        boundary=boundary,
        headers={"Content-Type": "application/json"},
        body=body
    )
    return builder.get_message()


def build_binary_part(
    boundary: str,
    data: bytes,
    content_type: str = "image/png",
    extra_headers: Dict[str, str] = None
) -> bytes:
    """Build a binary part (e.g., PNG image) for multipart response."""
    headers = {"Content-Type": content_type}
    if extra_headers:
        headers.update(extra_headers)
    builder = MultipartResponseBuilder.build(
        boundary=boundary,
        headers=headers,
        body=data
    )
    return builder.get_message()


def create_multipart_response(
    parts: List[Tuple[str, Union[str, bytes, dict], Dict[str, str]]],
    boundary: str
) -> Generator[bytes, None, None]:
    """
    Generate multipart response from a list of parts.
    
    Args:
        parts: List of tuples (content_type, data, extra_headers)
               - content_type: MIME type (e.g., "application/json", "image/png")
               - data: Content as str, bytes, or dict (dict will be JSON-encoded)
               - extra_headers: Additional headers for this part
        boundary: Boundary string for multipart
    
    Yields:
        bytes: Each part of the multipart response
    """
    import json
    
    for i, (content_type, data, extra_headers) in enumerate(parts):
        # Convert dict to JSON string
        if isinstance(data, dict):
            data = json.dumps(data)
            content_type = "application/json"
        
        # Build headers
        headers = {"Content-Type": content_type}
        if extra_headers:
            headers.update(extra_headers)
        
        # Build and yield the part
        builder = MultipartResponseBuilder.build(
            boundary=boundary,
            headers=headers,
            body=data
        )
        yield builder.get_message()
        
        # Add CRLF between parts (except for the last one before closing)
        if i < len(parts) - 1:
            yield b"\r\n"
    
    # Yield closing boundary
    yield build_multipart_closing(boundary)


class MultipartMaskResponse:
    """
    Helper class to build multipart response for mask prediction results.
    
    Usage:
        response = MultipartMaskResponse()
        response.add_metadata(session_id="abc", frame_index=0)
        response.add_mask(object_id=1, score=0.95, width=1920, height=1080, png_bytes=mask_data)
        response.add_mask(object_id=2, score=0.88, width=1920, height=1080, png_bytes=mask_data)
        
        return StreamingResponse(
            response.generate(),
            media_type=response.content_type
        )
    """
    
    def __init__(self, boundary: str = None):
        self.boundary = boundary or generate_boundary()
        self.parts: List[Tuple[str, Union[str, bytes, dict], Dict[str, str]]] = []
    
    @property
    def content_type(self) -> str:
        return f"multipart/mixed; boundary={self.boundary}"
    
    def add_metadata(self, session_id: str, frame_index: int, object_count: int = None) -> "MultipartMaskResponse":
        """Add the initial metadata part."""
        metadata = {
            "sessionId": session_id,
            "frameIndex": frame_index,
        }
        if object_count is not None:
            metadata["objectCount"] = object_count
        self.parts.append(("application/json", metadata, {}))
        return self
    
    def add_mask(
        self,
        object_id: int,
        score: float,
        width: int,
        height: int,
        png_bytes: bytes
    ) -> "MultipartMaskResponse":
        """Add an object's metadata and mask image."""
        # Add object metadata
        obj_meta = {
            "objectId": object_id,
            "score": score,
            "width": width,
            "height": height,
        }
        self.parts.append(("application/json", obj_meta, {}))
        
        # Add mask image
        self.parts.append((
            "image/png",
            png_bytes,
            {"X-Object-Id": str(object_id)}
        ))
        return self
    
    def generate(self) -> Generator[bytes, None, None]:
        """Generate the multipart response."""
        yield from create_multipart_response(self.parts, self.boundary)


def build_multipart_response(
    session_id: str,
    frame_index: int,
    masks: List[Tuple[int, float, int, int, bytes]]
):
    """
    Build a multipart/mixed StreamingResponse for mask prediction results.
    
    Args:
        session_id: Session identifier
        frame_index: Frame index
        masks: List of (object_id, score, width, height, png_bytes) tuples
    
    Returns:
        StreamingResponse with multipart/mixed content
    """
    from fastapi.responses import StreamingResponse
    
    response = MultipartMaskResponse()
    response.add_metadata(
        session_id=session_id,
        frame_index=frame_index,
        object_count=len(masks)
    )
    
    for object_id, score, width, height, png_bytes in masks:
        response.add_mask(
            object_id=object_id,
            score=score,
            width=width,
            height=height,
            png_bytes=png_bytes
        )
    
    return StreamingResponse(
        response.generate(),
        media_type=response.content_type
    )
