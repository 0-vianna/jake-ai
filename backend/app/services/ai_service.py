from dataclasses import dataclass
from typing import Any

from openai import OpenAI, OpenAIError

from app.agents.jake_prompt import JAKE_SYSTEM_PROMPT
from app.config import settings


MODEL_BY_MODE = {
    "economic": settings.economy_model,
    "economico": settings.economy_model,
    "economy": settings.economy_model,
    "balanced": settings.balanced_model,
    "equilibrado": settings.balanced_model,
    "maximum": settings.max_model,
    "maximo": settings.max_model,
    "max": settings.max_model,
}


@dataclass
class AIResult:
    text: str
    model: str
    provider: str
    usage: dict[str, Any]


class AIService:
    def __init__(self) -> None:
        self.client = OpenAI(api_key=settings.openai_api_key) if settings.openai_api_key else None

    def model_for_mode(self, mode: str) -> str:
        return MODEL_BY_MODE.get(mode, settings.balanced_model)

    def respond(
        self,
        *,
        message: str,
        history: list[dict[str, str]],
        memories: list[str],
        mode: str,
        attachments: list[dict[str, str]] | None = None,
        tool_context: str = "",
    ) -> AIResult:
        model = self.model_for_mode(mode)
        if not self.client:
            text = (
                "A integração com a OpenAI já está pronta, mas a OPENAI_API_KEY ainda não foi configurada. "
                "Quando você colar a chave no .env e reiniciar o backend, eu respondo usando o modelo selecionado. "
                f"Enquanto isso, registrei sua mensagem localmente: {message}"
            )
            return AIResult(
                text=text,
                model=model,
                provider="local_fallback",
                usage={"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
            )

        memory_context = ""
        if memories:
            joined = "\n".join(f"- {item}" for item in memories)
            memory_context = f"\n\nMemórias relevantes do usuário:\n{joined}"

        tool_instructions = ""
        if tool_context:
            tool_instructions = (
                "\n\nContexto de ferramentas do Jake:\n"
                f"{tool_context}\n\n"
                "Use esse contexto como informação atual quando responder. "
                "Quando houver fontes da web, cite as URLs mais úteis. "
                "Não diga que não consegue pesquisar se os resultados acima estiverem presentes."
            )

        instructions = f"{JAKE_SYSTEM_PROMPT}{memory_context}{tool_instructions}"
        input_messages: list[dict[str, Any]] = []
        for item in history[-10:]:
            role = item["role"] if item["role"] in {"user", "assistant"} else "user"
            input_messages.append({"role": role, "content": item["content"]})
        user_content: list[dict[str, Any]] = [{"type": "input_text", "text": message}]
        for attachment in attachments or []:
            kind = attachment.get("kind")
            name = attachment.get("name", "anexo")
            content = attachment.get("content", "")
            if kind == "image" and content.startswith("data:image/"):
                user_content.append({"type": "input_image", "image_url": content})
            elif kind == "text" and content:
                user_content.append(
                    {
                        "type": "input_text",
                        "text": f"\n\nArquivo anexado: {name}\n{content[:60000]}",
                    }
                )
            elif name:
                user_content.append(
                    {
                        "type": "input_text",
                        "text": f"\n\nArquivo anexado sem leitura direta: {name}",
                    }
                )
        input_messages.append({"role": "user", "content": user_content})

        try:
            response = self.client.responses.create(
                model=model,
                instructions=instructions,
                input=input_messages,
                store=False,
            )
        except OpenAIError as exc:
            fallback_model = "gpt-4.1-mini"
            if model != fallback_model and self._looks_like_model_error(exc):
                try:
                    response = self.client.responses.create(
                        model=fallback_model,
                        instructions=instructions,
                        input=input_messages,
                        store=False,
                    )
                    model = fallback_model
                except OpenAIError as retry_exc:
                    return self._error_result(model=fallback_model, exc=retry_exc)
            else:
                return self._error_result(model=model, exc=exc)
        usage = getattr(response, "usage", None)
        usage_dict = {
            "input_tokens": getattr(usage, "input_tokens", 0) if usage else 0,
            "output_tokens": getattr(usage, "output_tokens", 0) if usage else 0,
            "total_tokens": getattr(usage, "total_tokens", 0) if usage else 0,
        }
        return AIResult(text=response.output_text, model=model, provider="openai", usage=usage_dict)

    def _looks_like_model_error(self, exc: OpenAIError) -> bool:
        message = str(exc).lower()
        return "model" in message or "not found" in message or "does not exist" in message

    def _error_result(self, *, model: str, exc: OpenAIError) -> AIResult:
        message = str(exc)
        lowered = message.lower()
        if "incorrect api key" in lowered or "invalid api key" in lowered or "401" in lowered:
            reason = "a chave da OpenAI parece inválida ou sem permissão para este projeto."
        elif "quota" in lowered or "billing" in lowered or "insufficient" in lowered or "429" in lowered:
            reason = "a conta/projeto parece sem crédito, com limite atingido ou bloqueio de cobrança."
        elif "model" in lowered:
            reason = "o modelo configurado não parece disponível para esta chave."
        else:
            reason = "a chamada para a OpenAI falhou."
        return AIResult(
            text=(
                f"Não consegui chamar a OpenAI agora: {reason} "
                "Verifique a chave, créditos e modelos em Configurações. A mensagem foi salva no histórico local."
            ),
            model=model,
            provider="openai_error",
            usage={"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
        )


ai_service = AIService()
