from __future__ import annotations

import smtplib
from email.message import EmailMessage

from app.config import settings


def verification_link(token: str) -> str:
    base_url = settings.app_base_url.rstrip("/")
    return f"{base_url}/?verify_email={token}"


def send_verification_email(email: str, name: str, token: str) -> tuple[str, str | None]:
    link = verification_link(token)
    if not settings.smtp_host or not settings.smtp_from_email:
        delivery = "debug_link"
        debug_link = link if settings.app_env == "development" else None
        return delivery, debug_link

    message = EmailMessage()
    message["Subject"] = "Confirme seu email no Jake"
    message["From"] = (
        f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
        if settings.smtp_from_name
        else settings.smtp_from_email
    )
    message["To"] = email
    message.set_content(
        f"Oi, {name}!\n\n"
        f"Confirme seu email no Jake clicando aqui:\n{link}\n\n"
        "Se voce nao pediu esta conta, ignore esta mensagem."
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=20) as smtp:
        if settings.smtp_use_tls:
            smtp.starttls()
        if settings.smtp_username and settings.smtp_password:
            smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
    return "email", None
