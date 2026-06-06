from app.config import settings


def screen_status() -> dict:
    return {
        "enabled": settings.screen_control_enabled,
        "status": "ready_for_local_agent",
        "features": ["screenshot", "screen_analysis", "visual_clicking", "ocr"],
        "todo": "Conectar PyAutoGUI, Playwright e OCR local no agente desktop.",
    }


def camera_status() -> dict:
    return {
        "enabled": settings.vision_enabled,
        "status": "ready_for_mediapipe",
        "features": ["hand_tracking", "gesture_detection", "object_detection"],
        "todo": "Conectar OpenCV e MediaPipe Hands no serviço local.",
    }


def whatsapp_status() -> dict:
    return {
        "enabled": settings.whatsapp_enabled,
        "status": "disconnected",
        "features": ["qr_code", "authorized_users", "audio_transcription", "remote_pc_commands"],
        "todo": "Escolher conector Baileys/WPPConnect e isolar permissões.",
    }

