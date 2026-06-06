from __future__ import annotations

import math
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.request import urlopen


@dataclass
class GestureState:
    gesture: str = "Aguardando mao"
    action: str = "Nenhuma"
    confidence: float = 0.0
    fps: int = 0


class NativeHandControlService:
    """Local webcam hand controller for Windows mouse and keyboard actions.

    Imports are intentionally lazy so the API keeps booting even on machines
    that still need to install MediaPipe/OpenCV/PyAutoGUI.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: threading.Thread | None = None
        self._running = False
        self._camera_index = 0
        self._state = GestureState()
        self._error: str | None = None
        self._history: list[dict[str, Any]] = []

    def start(self, camera_index: int = 0) -> dict[str, Any]:
        with self._lock:
            if self._running:
                already_running = True
            else:
                already_running = False
                self._camera_index = camera_index
                self._stop_event.clear()
                self._error = None
                self._state = GestureState()
                self._thread = threading.Thread(target=self._run, name="jake-native-hand-control", daemon=True)
                self._running = True
                self._thread.start()
        if already_running:
            return self.status()
        return self.status()

    def stop(self) -> dict[str, Any]:
        self._stop_event.set()
        thread = self._thread
        if thread and thread.is_alive():
            thread.join(timeout=2.0)
        with self._lock:
            self._running = False
            self._thread = None
            self._error = None
            self._state = GestureState(gesture="Parado", action="Controle nativo desligado")
        return self.status()

    def status(self) -> dict[str, Any]:
        with self._lock:
            return {
                "running": self._running,
                "camera_index": self._camera_index,
                "gesture": self._state.gesture,
                "action": self._state.action,
                "confidence": round(self._state.confidence, 1),
                "fps": self._state.fps,
                "error": self._error,
                "history": list(self._history[-12:]),
                "gesture_map": GESTURE_MAP,
            }

    def _run(self) -> None:
        cap = None
        hands = None
        try:
            import cv2
            import mediapipe as mp
            import pyautogui

            pyautogui.FAILSAFE = False
            pyautogui.PAUSE = 0
            screen_w, screen_h = pyautogui.size()
            cap = cv2.VideoCapture(self._camera_index, cv2.CAP_DSHOW)
            if not cap.isOpened():
                cap.release()
                cap = cv2.VideoCapture(self._camera_index)
            if not cap.isOpened():
                raise RuntimeError("Nao consegui abrir a camera pelo controlador nativo.")

            hands = create_hand_landmarker()
            previous_center: tuple[float, float] | None = None
            previous_mouse: tuple[float, float] | None = None
            last_action_at: dict[str, float] = {}
            gesture_candidate = ""
            gesture_streak = 0
            last_frame = time.perf_counter()

            while not self._stop_event.is_set():
                ok, frame = cap.read()
                if not ok:
                    self._set_error("Camera nativa nao retornou frame.")
                    time.sleep(0.1)
                    continue

                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                now = time.perf_counter()
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                result = hands.detect_for_video(mp_image, int(now * 1000))
                fps = int(1 / max(now - last_frame, 0.001))
                last_frame = now

                if not result.hand_landmarks:
                    previous_center = None
                    self._set_state("Aguardando mao", "Nenhuma", 0.0, fps)
                    continue

                landmarks = result.hand_landmarks[0]
                points = [(item.x, item.y, item.z) for item in landmarks]
                confidence = 86.0
                if result.handedness and result.handedness[0]:
                    confidence = float(result.handedness[0][0].score * 100)

                center = palm_center(points)
                target_x = min(screen_w - 1, max(0, center[0] * screen_w))
                target_y = min(screen_h - 1, max(0, center[1] * screen_h))
                if previous_mouse:
                    target_x = previous_mouse[0] * 0.72 + target_x * 0.28
                    target_y = previous_mouse[1] * 0.72 + target_y * 0.28
                pyautogui.moveTo(target_x, target_y, duration=0)
                previous_mouse = (target_x, target_y)

                gesture = detect_native_gesture(points)
                if gesture == gesture_candidate:
                    gesture_streak += 1
                else:
                    gesture_candidate = gesture
                    gesture_streak = 1
                action = "Movimento da mao -> mouse"

                if previous_center:
                    dy = center[1] - previous_center[1]
                    if abs(dy) > 0.08 and allow_action("scroll", last_action_at, now, 0.22):
                        clicks = int(max(3, min(8, abs(dy) * 70)))
                        pyautogui.scroll(clicks if dy < 0 else -clicks)
                        action = "Arrastar mao para cima/baixo -> scroll"
                previous_center = center

                executed = None
                if gesture_streak >= 3:
                    executed = execute_gesture_action(pyautogui, gesture, last_action_at, now)
                if executed:
                    action = executed
                    self._push_history(gesture, action)
                self._set_state(gesture, action, confidence, fps)
        except Exception as exc:  # pragma: no cover - hardware/runtime dependent
            self._set_error(str(exc))
        finally:
            if hands is not None:
                hands.close()
            if cap is not None:
                cap.release()
            with self._lock:
                self._running = False

    def _set_state(self, gesture: str, action: str, confidence: float, fps: int) -> None:
        with self._lock:
            self._state = GestureState(gesture=gesture, action=action, confidence=confidence, fps=fps)

    def _set_error(self, error: str) -> None:
        with self._lock:
            self._error = error

    def _push_history(self, gesture: str, action: str) -> None:
        with self._lock:
            self._history.append({"gesture": gesture, "action": action, "at": time.strftime("%H:%M:%S")})
            self._history = self._history[-20:]


GESTURE_MAP = {
    "Pinca": "Clique direito",
    "Dedo indicador levantado": "Clique esquerdo",
    "Movimento da mao": "Controle do mouse",
    "Arrastar mao para cima/baixo": "Scroll do mouse",
    "Dois dedos": "Alt + Tab",
    "Punho fechado": "Windows + D",
    "Joinha pra cima": "Despausar musica",
    "Joinha pra baixo": "Pausar musica",
}


def execute_gesture_action(pyautogui: Any, gesture: str, last_action_at: dict[str, float], now: float) -> str | None:
    if gesture == "Pinca" and allow_action(gesture, last_action_at, now, 0.8):
        pyautogui.click(button="right")
        return "Pinca -> clique direito"
    if gesture == "Dedo indicador levantado" and allow_action(gesture, last_action_at, now, 0.55):
        pyautogui.click(button="left")
        return "Indicador levantado -> clique esquerdo"
    if gesture == "Dois dedos" and allow_action(gesture, last_action_at, now, 1.0):
        pyautogui.hotkey("alt", "tab")
        return "Dois dedos -> Alt + Tab"
    if gesture == "Punho fechado" and allow_action(gesture, last_action_at, now, 1.4):
        pyautogui.hotkey("win", "d")
        return "Punho fechado -> Windows + D"
    if gesture == "Joinha pra cima" and allow_action(gesture, last_action_at, now, 1.0):
        pyautogui.press("playpause")
        return "Joinha pra cima -> despausar musica"
    if gesture == "Joinha pra baixo" and allow_action(gesture, last_action_at, now, 1.0):
        pyautogui.press("playpause")
        return "Joinha pra baixo -> pausar musica"
    return None


def allow_action(key: str, last_action_at: dict[str, float], now: float, cooldown: float) -> bool:
    previous = last_action_at.get(key, 0.0)
    if now - previous < cooldown:
        return False
    last_action_at[key] = now
    return True


def detect_native_gesture(points: list[tuple[float, float, float]]) -> str:
    thumb_tip, thumb_ip, thumb_mcp = points[4], points[3], points[2]
    index_tip, index_pip = points[8], points[6]
    middle_tip, middle_pip = points[12], points[10]
    ring_tip, ring_pip = points[16], points[14]
    pinky_tip, pinky_pip = points[20], points[18]
    wrist = points[0]
    middle_mcp = points[9]
    palm_size = max(distance(wrist, middle_mcp), 0.08)
    flex_margin = max(0.02, palm_size * 0.18)

    index_up = index_tip[1] < index_pip[1] - flex_margin
    middle_up = middle_tip[1] < middle_pip[1] - flex_margin
    ring_up = ring_tip[1] < ring_pip[1] - flex_margin
    pinky_up = pinky_tip[1] < pinky_pip[1] - flex_margin
    folded_count = [not index_up, not middle_up, not ring_up, not pinky_up].count(True)
    pinch_distance = distance(thumb_tip, index_tip)
    pinch_threshold = max(0.04, palm_size * 0.48)
    thumb_vertical = abs(thumb_tip[1] - wrist[1]) > palm_size * 0.55 and abs(thumb_tip[1] - thumb_mcp[1]) > palm_size * 0.42
    fist_compact = all(distance(points[item], wrist) < palm_size * 1.45 for item in (8, 12, 16, 20))

    if pinch_distance < pinch_threshold and not middle_up:
        return "Pinca"
    if index_up and middle_up and not ring_up and not pinky_up:
        return "Dois dedos"
    if fist_compact or (folded_count >= 4 and not thumb_vertical):
        return "Punho fechado"
    if folded_count >= 3 and thumb_vertical and thumb_tip[1] < wrist[1]:
        return "Joinha pra cima"
    if folded_count >= 3 and thumb_vertical and thumb_tip[1] > wrist[1]:
        return "Joinha pra baixo"
    if index_up and not middle_up and not ring_up and not pinky_up:
        return "Dedo indicador levantado"
    return "Movimento da mao"


def palm_center(points: list[tuple[float, float, float]]) -> tuple[float, float]:
    indexes = [0, 5, 9, 13, 17]
    return (
        sum(points[index][0] for index in indexes) / len(indexes),
        sum(points[index][1] for index in indexes) / len(indexes),
    )


def distance(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return math.hypot(a[0] - b[0], a[1] - b[1])


native_hand_control_service = NativeHandControlService()


MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
MODEL_PATH = Path(__file__).resolve().parents[1] / "vision" / "models" / "hand_landmarker.task"


def create_hand_landmarker() -> Any:
    from mediapipe.tasks.python import vision
    from mediapipe.tasks.python.core.base_options import BaseOptions
    from mediapipe.tasks.python.vision.core.vision_task_running_mode import VisionTaskRunningMode

    model_path = ensure_model_file()
    options = vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(model_path)),
        running_mode=VisionTaskRunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.55,
        min_hand_presence_confidence=0.45,
        min_tracking_confidence=0.45,
    )
    return vision.HandLandmarker.create_from_options(options)


def ensure_model_file() -> Path:
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists() and MODEL_PATH.stat().st_size > 0:
        return MODEL_PATH
    with urlopen(MODEL_URL, timeout=30) as response:
        MODEL_PATH.write_bytes(response.read())
    return MODEL_PATH
