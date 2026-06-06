import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db, seed_default_finance_categories
from app.deps import get_current_user
from app.models import APIUsage, Conversation, Message, User
from app.schemas import ChatRequest, ChatResponse, ConversationOut, MessageOut
from app.services.ai_service import ai_service
from app.services.audit_service import log_action
from app.services.finance_service import create_transaction_from_text, describe_transaction, should_create_finance_entry
from app.services.memory_service import create_memory, search_memories
from app.services.pc_control_service import handle_safe_pc_command
from app.services.personal_files_service import analyze_file, file_roots, resolve_personal_path, search_files
from app.services.web_tools_service import build_tool_context, direct_datetime_answer, should_search_web

router = APIRouter(prefix="/chat", tags=["chat"])

MODEL_PRICING_PER_MTOK = {
    "gpt-4.1-mini": {"input": 0.4, "output": 1.6},
    "gpt-4.1": {"input": 2.0, "output": 8.0},
}
SIMPLE_RESPONSE_CACHE: dict[str, str] = {}


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[ConversationOut]:
    conversations = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .limit(50)
        .all()
    )
    return [ConversationOut.model_validate(item) for item in conversations]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(
    conversation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[MessageOut]:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at.asc()).all()
    return [MessageOut.model_validate(item) for item in messages]


@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    conversation = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == current_user.id)
        .first()
    )
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversa nao encontrada")
    db.delete(conversation)
    db.commit()
    log_action(db, "chat.delete", current_user.id, target=str(conversation_id), details="Conversa excluida")
    return {"ok": True}


@router.post("", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> ChatResponse:
    conversation = get_or_create_conversation(payload, current_user, db)

    attachment_note = ""
    if payload.attachments:
        attachment_names = ", ".join(attachment.name for attachment in payload.attachments)
        attachment_note = f"\n\n[Anexos: {attachment_names}]"
    user_message = Message(conversation_id=conversation.id, role="user", content=payload.message + attachment_note)
    db.add(user_message)
    db.commit()

    if should_create_finance_entry(payload.message):
        seed_default_finance_categories(db, current_user.id)
        tx = create_transaction_from_text(db, current_user.id, payload.message)
        reply = (
            f"{describe_transaction(db, tx)}\n\n"
            "Tambem deixei isso salvo no seu historico local do chat. Quando abrir a aba Financeiro, o lancamento ja aparece la."
        )
        return save_local_reply(
            db=db,
            current_user=current_user,
            conversation=conversation,
            payload=payload,
            reply=reply,
            model="local-finance",
            provider="local_tool",
            action="finance.chat_entry",
        )

    file_reply = handle_personal_file_request(payload.message)
    if file_reply:
        return save_local_reply(
            db=db,
            current_user=current_user,
            conversation=conversation,
            payload=payload,
            reply=file_reply,
            model="local-files",
            provider="local_tool",
            action="files.chat_request",
        )

    local_reply = handle_safe_pc_command(payload.message)
    if local_reply:
        return save_local_reply(
            db=db,
            current_user=current_user,
            conversation=conversation,
            payload=payload,
            reply=local_reply,
            model="local-pc-control",
            provider="local_tool",
            action="pc.safe_command",
        )

    datetime_reply = direct_datetime_answer(payload.message)
    if datetime_reply:
        return save_local_reply(
            db=db,
            current_user=current_user,
            conversation=conversation,
            payload=payload,
            reply=datetime_reply,
            model="local-datetime",
            provider="local_tool",
            action="tool.datetime",
        )

    recent_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation.id)
        .order_by(Message.created_at.desc())
        .limit(10)
        .all()
    )
    history = [{"role": item.role, "content": item.content} for item in reversed(recent_messages) if item.id != user_message.id]
    memories = search_memories(db, current_user.id, payload.message, limit=5)
    tool_context = build_tool_context(payload.message) if should_search_web(payload.message) else ""

    cache_key = make_cache_key(current_user.id, payload.mode, payload.message)
    cached_reply = SIMPLE_RESPONSE_CACHE.get(cache_key) if can_cache(payload.message, payload.attachments, tool_context) else None
    if cached_reply:
        assistant_message = Message(conversation_id=conversation.id, role="assistant", content=cached_reply, tokens=0)
        db.add(assistant_message)
        db.commit()
        db.refresh(assistant_message)
        log_action(db, "chat.cache_hit", current_user.id, target=str(conversation.id), details=f"Modo {payload.mode}")
        return ChatResponse(
            conversation_id=conversation.id,
            message_id=assistant_message.id,
            reply=cached_reply,
            mode=payload.mode,
            model="response-cache",
            provider="local_cache",
            usage={"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
            memories_used=[memory.summary or memory.content for memory in memories],
        )

    result = ai_service.respond(
        message=payload.message,
        history=history,
        memories=[memory.summary or memory.content for memory in memories],
        mode=payload.mode,
        attachments=[attachment.model_dump() for attachment in payload.attachments],
        tool_context=tool_context,
    )

    assistant_message = Message(
        conversation_id=conversation.id,
        role="assistant",
        content=result.text,
        tokens=result.usage.get("total_tokens", 0),
    )
    db.add(assistant_message)
    db.add(
        APIUsage(
            user_id=current_user.id,
            model=result.model,
            mode=payload.mode,
            input_tokens=result.usage.get("input_tokens", 0),
            output_tokens=result.usage.get("output_tokens", 0),
            total_tokens=result.usage.get("total_tokens", 0),
            estimated_cost=estimate_cost(result.model, result.usage),
        )
    )
    db.commit()
    db.refresh(assistant_message)

    lowered = payload.message.lower()
    if "salvar na memoria" in lowered or "salvar na memória" in lowered or "lembre" in lowered:
        create_memory(db, current_user.id, payload.message, source="chat", importance=4)
    if can_cache(payload.message, payload.attachments, tool_context) and result.provider == "openai":
        SIMPLE_RESPONSE_CACHE[cache_key] = result.text

    log_action(
        db,
        "chat.message",
        current_user.id,
        target=str(conversation.id),
        details=f"Modo {payload.mode}" + (" com busca web" if tool_context else ""),
    )
    return ChatResponse(
        conversation_id=conversation.id,
        message_id=assistant_message.id,
        reply=result.text,
        mode=payload.mode,
        model=result.model,
        provider=result.provider,
        usage=result.usage,
        memories_used=[memory.summary or memory.content for memory in memories],
    )


def get_or_create_conversation(payload: ChatRequest, current_user: User, db: Session) -> Conversation:
    if payload.conversation_id:
        conversation = (
            db.query(Conversation)
            .filter(Conversation.id == payload.conversation_id, Conversation.user_id == current_user.id)
            .first()
        )
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversa nao encontrada")
        return conversation

    title = payload.message[:72] + ("..." if len(payload.message) > 72 else "")
    conversation = Conversation(user_id=current_user.id, project_id=payload.project_id, title=title, mode=payload.mode)
    db.add(conversation)
    db.commit()
    db.refresh(conversation)
    return conversation


def save_local_reply(
    *,
    db: Session,
    current_user: User,
    conversation: Conversation,
    payload: ChatRequest,
    reply: str,
    model: str,
    provider: str,
    action: str,
) -> ChatResponse:
    assistant_message = Message(conversation_id=conversation.id, role="assistant", content=reply)
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)
    log_action(db, action, current_user.id, target=str(conversation.id), details=payload.message)
    return ChatResponse(
        conversation_id=conversation.id,
        message_id=assistant_message.id,
        reply=reply,
        mode=payload.mode,
        model=model,
        provider=provider,
        usage={"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
        memories_used=[],
    )


def handle_personal_file_request(message: str) -> str | None:
    normalized = remove_accents(message.lower())
    wants_file = any(word in normalized for word in ["arquivo", "arquivos", "documento", "documentos", "planilha", "foto", "imagem"])
    if not wants_file:
        return None

    path = extract_windows_path(message)
    wants_analysis = any(word in normalized for word in ["analise", "analisar", "resuma", "resumir", "ler ", "leia "])
    wants_search = any(word in normalized for word in ["procure", "procurar", "buscar", "busque", "encontre", "pesquise"])

    if path and wants_analysis:
        try:
            data = analyze_file(resolve_personal_path(path=path))
        except (ValueError, FileNotFoundError, PermissionError) as exc:
            return f"Nao consegui analisar esse arquivo: {exc}"
        return (
            f"Analisei `{data['name']}` localmente.\n\n"
            f"{data.get('summary') or data.get('preview') or 'Nao encontrei texto extraivel nesse formato.'}\n\n"
            "Pastas de sistema e arquivos sensiveis continuam bloqueados por seguranca."
        )

    if wants_search:
        query = extract_file_query(message)
        if len(query) < 2:
            return "Me diga o nome ou trecho do arquivo que voce quer procurar. Exemplo: `procure arquivo boleto`."
        matches = []
        searchable_roots = [root for root in file_roots() if root["id"] in {"desktop", "documents", "downloads", "pictures", "codex"}]
        for root in searchable_roots:
            try:
                response = search_files(resolve_personal_path(root_id=root["id"]), query, limit=8)
            except ValueError:
                continue
            for item in response["items"]:
                matches.append({**item, "root_label": root["label"]})
            if len(matches) >= 10:
                break
        if not matches:
            return f"Procurei por `{query}` nas pastas pessoais liberadas e nao encontrei nada ainda."
        lines = [f"Encontrei estes arquivos para `{query}`:"]
        for item in matches[:10]:
            snippet = f" - {item['snippet']}" if item.get("snippet") else ""
            lines.append(f"- {item['name']} ({item['root_label']})\n  `{item['path']}`{snippet}")
        lines.append("\nSe quiser, me mande `analise o arquivo C:\\\\caminho\\\\arquivo.ext` ou abra a aba Arquivos para clicar nele.")
        return "\n".join(lines)

    if "acesso" in normalized or "analisar tudo" in normalized:
        return (
            "Agora eu tenho acesso seguro as suas pastas pessoais pela aba Arquivos: Desktop, Documentos, Downloads, Imagens e Projetos Codex. "
            "Eu leio e analiso sob demanda, sem entrar em Windows, AppData, Program Files, Users inteiro ou arquivos `.env`."
        )
    return None


def extract_windows_path(message: str) -> str | None:
    quoted = re.search(r"[`\"']([A-Za-z]:[\\/][^`\"']+)[`\"']", message)
    if quoted:
        return quoted.group(1).strip()
    direct = re.search(r"([A-Za-z]:[\\/][^\n\r]+)", message)
    if not direct:
        return None
    return direct.group(1).strip().rstrip(" .,;)")


def extract_file_query(message: str) -> str:
    cleaned = re.sub(r"[`\"']", "", message).strip()
    cleaned = re.sub(r"(?i)\b(procure|procurar|buscar|busque|encontre|pesquise)\b", "", cleaned)
    cleaned = re.sub(r"(?i)\b(arquivo|arquivos|documento|documentos|planilha|foto|imagem|nos|meus|minhas|do|da|de|por)\b", "", cleaned)
    return " ".join(cleaned.split()).strip()


def remove_accents(value: str) -> str:
    replacements = {
        "á": "a",
        "à": "a",
        "â": "a",
        "ã": "a",
        "é": "e",
        "ê": "e",
        "í": "i",
        "ó": "o",
        "ô": "o",
        "õ": "o",
        "ú": "u",
        "ç": "c",
    }
    for source, target in replacements.items():
        value = value.replace(source, target)
    return value


def estimate_cost(model: str, usage: dict) -> float:
    pricing = MODEL_PRICING_PER_MTOK.get(model, MODEL_PRICING_PER_MTOK["gpt-4.1-mini"])
    input_cost = (usage.get("input_tokens", 0) / 1_000_000) * pricing["input"]
    output_cost = (usage.get("output_tokens", 0) / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 6)


def make_cache_key(user_id: int, mode: str, message: str) -> str:
    normalized = " ".join(message.lower().strip().split())
    return f"{user_id}:{mode}:{normalized}"


def can_cache(message: str, attachments: list, tool_context: str) -> bool:
    if attachments or tool_context:
        return False
    normalized = message.strip().lower()
    if len(normalized) > 220:
        return False
    blocked = ["hoje", "agora", "atual", "pesquise", "busque", "tela", "camera", "câmera", "arquivo", "openai"]
    return not any(word in normalized for word in blocked)
