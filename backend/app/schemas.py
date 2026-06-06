from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class UserOut(BaseModel):
    id: int
    name: str
    username: str
    email: str
    role: str
    theme: str
    is_active: bool

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserCreate(BaseModel):
    name: str
    username: str
    email: EmailStr
    password: str = Field(min_length=6)
    role: str = "user"


class ChatRequest(BaseModel):
    message: str
    conversation_id: int | None = None
    mode: str = "balanced"
    project_id: int | None = None
    attachments: list["ChatAttachment"] = Field(default_factory=list)


class ChatAttachment(BaseModel):
    name: str
    type: str
    kind: str
    content: str


class ChatResponse(BaseModel):
    conversation_id: int
    message_id: int
    reply: str
    mode: str
    model: str
    provider: str
    usage: dict[str, Any]
    memories_used: list[str]


class ConversationOut(BaseModel):
    id: int
    title: str
    mode: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MemoryCreate(BaseModel):
    content: str
    tags: str = ""
    project_id: int | None = None
    importance: int = 3


class MemoryOut(BaseModel):
    id: int
    content: str
    summary: str | None
    tags: str
    source: str
    importance: int
    archived: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    notes: str = ""


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str
    status: str
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FinanceCategoryCreate(BaseModel):
    name: str
    type: str = "expense"
    color: str = "#f97316"
    parent_id: int | None = None


class FinanceCategoryOut(BaseModel):
    id: int
    name: str
    type: str
    color: str
    parent_id: int | None

    model_config = {"from_attributes": True}


class FinanceTransactionCreate(BaseModel):
    type: str
    amount: float
    description: str = ""
    category_id: int | None = None
    transaction_date: date | None = None
    recurrence: str | None = None
    installments: int | None = None


class FinanceTransactionOut(BaseModel):
    id: int
    type: str
    amount: float
    description: str
    category_id: int | None
    transaction_date: date
    created_at: datetime

    model_config = {"from_attributes": True}


class QuickFinanceRequest(BaseModel):
    text: str


class SettingIn(BaseModel):
    key: str
    value: str


class SettingOut(BaseModel):
    key: str
    value: str


class AutomationCreate(BaseModel):
    name: str
    description: str = ""
    trigger: str = ""
    actions_json: str = "[]"
    active: bool = True
