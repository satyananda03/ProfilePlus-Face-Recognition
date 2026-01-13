from pathlib import Path
from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

router = APIRouter()

current_file_dir = Path(__file__).resolve().parent
templates_path = current_file_dir / "templates"
templates = Jinja2Templates(directory=templates_path)

@router.get("/detect", response_class=HTMLResponse)
async def face_validation_page(request: Request):
    return templates.TemplateResponse("face-detection.html", {
        "request": request
    })