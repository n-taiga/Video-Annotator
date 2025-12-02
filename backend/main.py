from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.config import router as config_router
from routers.videos import router as videos_router
from routers.annotations import router as annotations_router
from routers.metadata import router as metadata_router
from routers.inference_sam import router as sam2_router

app = FastAPI(
    title="Video Annotation Backend",
    description="Backend API for video annotation tool",
    version="1.0.0",
)

# ---------------------------------------------------------
# CORS settings
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------
# Include Routers
# ---------------------------------------------------------
app.include_router(config_router)
app.include_router(videos_router)
app.include_router(annotations_router)
app.include_router(metadata_router)
app.include_router(sam2_router)

# ---------------------------------------------------------
# Health check (optional)
# ---------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "ok"}