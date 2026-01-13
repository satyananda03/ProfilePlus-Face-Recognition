from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from src.routes import router as face_router

app = FastAPI()

static_path = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(static_path)), name="static")
app.include_router(face_router)