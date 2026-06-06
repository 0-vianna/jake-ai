from __future__ import annotations

import math
import threading
import time
from dataclasses import dataclass
from typing import Any


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

            pyautogui.FAILSAFE = True
            pyautogui.PAUSE = 0
            screen_w, screen_h = pyautogui.size()
            cap = cv2.VideoCapture(self._camera_index, cv2.CAP_DSHOW)
            if not cap.isOpened():
                raise RuntimeError("Nao consegui abrir a camera pelo controlador nativo.")

            mp_hands = mp.solutions.hands
            hands = mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=1,
                min_detection_confidence=0.62,
                min_tracking_confidence=0.55,
            )
            previous_center: tuple[float, float] | None = None
            previous_mouse: tuple[float, float] | None = None
            last_action_at: dict[str, float] = {}
            last_frame = time.perf_counter()

            while not self._stop_event.is_set():
                ok, frame = cap.read()
                if not ok:
                    self._set_error("Camera nativa nao retornou frame.")
                    time.sleep(0.1)
                    continue

                frame = cv2.flip(frame, 1)
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = hands.process(rgb)
                now = time.perf_counter()
                fps = int(1 / max(now - last_frame, 0.001))
                last_frame = now

                if not result.multi_hand_landmarks:
                    previous_center = None
                    self._set_state("Aguardando mao", "Nenhuma", 0.0, fps)
                    continue

                landmarks = result.multi_hand_landmarks[0].landmark
                points = [(item.x, item.y, item.z) for item in landmarks]
                confidence = 86.0
                if result.multi_handedness:
                    confidence = float(result.multi_handedness[0].classification[0].score * 100)

                center = palm_center(points)
                target_x = min(screen_w - 1, max(0, center[0] * screen_w))
                target_y = min(screen_h - 1, max(0, center[1] * screen_h))
                if previous_mouse:
                    target_x = previous_mouse[0] * 0.72 + target_x * 0.28
                    target_y = previous_mouse[1] * 0.72 + target_y * 0.28
                pyautogui.moveTo(target_x, target_y, duration=0)
                previous_mouse = (target_x, target_y)

                gesture = detect_native_gesture(points)
                action = "Movimento da mao -> mouse"

                if previous_center:
                    dy = center[1] - previous_center[1]
                    if abs(dy) > 0.08 and allow_action("scroll", last_action_at, now, 0.22):
                        clicks = int(max(3, min(8, abs(dy) * 70)))
                        pyautogui.scroll(clicks if dy < 0 else -clicks)
                        action = "Arrastar mao para cima/baixo -> scroll"
                previous_center = center

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

    index_up = index_tip[1] < index_pip[1] - 0.025
    middle_up = middle_tip[1] < middle_pip[1] - 0.025
    ring_up = ring_tip[1] < ring_pip[1] - 0.025
    pinky_up = pinky_tip[1] < pinky_pip[1] - 0.025
    folded_count = [not index_up, not middle_up, not ring_up, not pinky_up].count(True)
    pinch_distance = distance(thumb_tip, index_tip)
    thumb_vertical = abs(thumb_tip[1] - wrist[1]) > 0.12 and abs(thumb_tip[1] - thumb_mcp[1]) > 0.08

    if pinch_distance < 0.055:
        return "Pinca"
    if index_up and middle_up and not ring_up and not pinky_up:
        return "Dois dedos"
    if folded_count >= 4 and not thumb_vertical:
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
