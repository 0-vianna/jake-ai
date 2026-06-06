from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database.session import init_db
from app.routes import auth, chat, code_workspace, files, finance, hand_control, logs, memory, modules, projects, settings as settings_routes, tools, users, whatsapp


app = FastAPI(title="Jake API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "app": settings.app_name,
        "env": settings.app_env,
        "openai_configured": bool(settings.openai_api_key),
    }


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(code_workspace.router, prefix="/api")
app.include_router(files.router, prefix="/api")
app.include_router(memory.router, prefix="/api")
app.include_router(projects.router, prefix="/api")
app.include_router(finance.router, prefix="/api")
app.include_router(hand_control.router, prefix="/api")
app.include_router(settings_routes.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(modules.router, prefix="/api")
app.include_router(tools.router, prefix="/api")
app.include_router(whatsapp.router, prefix="/api")


@app.websocket("/ws/logs")
async def logs_ws(websocket: WebSocket) -> None:
    await websocket.accept()
    await websocket.send_json({"type": "status", "message": "Jake logs websocket conectado"})
    await websocket.close()
