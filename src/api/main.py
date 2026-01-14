from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from src.api.routes import detect_router

def create_app() -> FastAPI:
    app = FastAPI()
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    static_path = Path(__file__).parent.parent / "static"
    app.mount("/static", StaticFiles(directory=str(static_path)), name="static")
    app.include_router(detect_router)
    return app

app = create_app()