from datetime import date, datetime

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database.session import Base


class TimestampMixin:
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    username = Column(String(80), unique=True, index=True, nullable=False)
    email = Column(String(160), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(30), default="user", nullable=False)
    permissions = Column(Text, default="{}", nullable=False)
    theme = Column(String(20), default="light", nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String(255), nullable=True)
    verification_sent_at = Column(DateTime, nullable=True)

    conversations = relationship("Conversation", back_populates="user")


class SessionRecord(Base, TimestampMixin):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    user_agent = Column(String(255), nullable=True)
    ip_address = Column(String(80), nullable=True)


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    title = Column(String(180), default="Nova conversa", nullable=False)
    mode = Column(String(40), default="chat", nullable=False)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")


class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    role = Column(String(30), nullable=False)
    content = Column(Text, nullable=False)
    tokens = Column(Integer, default=0, nullable=False)
    metadata_json = Column(Text, default="{}", nullable=False)

    conversation = relationship("Conversation", back_populates="messages")


class Memory(Base, TimestampMixin):
    __tablename__ = "memories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    content = Column(Text, nullable=False)
    summary = Column(String(240), nullable=True)
    tags = Column(String(255), default="", nullable=False)
    source = Column(String(80), default="manual", nullable=False)
    importance = Column(Integer, default=3, nullable=False)
    embedding_json = Column(Text, nullable=True)
    archived = Column(Boolean, default=False, nullable=False)


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(160), nullable=False)
    description = Column(Text, default="", nullable=False)
    status = Column(String(40), default="active", nullable=False)
    notes = Column(Text, default="", nullable=False)


class ProjectFile(Base, TimestampMixin):
    __tablename__ = "project_files"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    file_path = Column(Text, nullable=False)
    file_type = Column(String(80), nullable=True)
    summary = Column(Text, nullable=True)


class Automation(Base, TimestampMixin):
    __tablename__ = "automations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(160), nullable=False)
    description = Column(Text, default="", nullable=False)
    trigger = Column(Text, default="", nullable=False)
    actions_json = Column(Text, default="[]", nullable=False)
    active = Column(Boolean, default=True, nullable=False)
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)


class AutomationLog(Base, TimestampMixin):
    __tablename__ = "automation_logs"

    id = Column(Integer, primary_key=True, index=True)
    automation_id = Column(Integer, ForeignKey("automations.id"), nullable=False)
    status = Column(String(40), nullable=False)
    message = Column(Text, nullable=False)


class FinanceCategory(Base, TimestampMixin):
    __tablename__ = "finance_categories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(120), nullable=False)
    type = Column(String(20), default="expense", nullable=False)
    color = Column(String(20), default="#f97316", nullable=False)
    parent_id = Column(Integer, ForeignKey("finance_categories.id"), nullable=True)


class FinanceAccount(Base, TimestampMixin):
    __tablename__ = "finance_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(120), nullable=False)
    balance = Column(Float, default=0.0, nullable=False)
    currency = Column(String(12), default="BRL", nullable=False)


class FinanceTransaction(Base, TimestampMixin):
    __tablename__ = "finance_transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("finance_categories.id"), nullable=True)
    account_id = Column(Integer, ForeignKey("finance_accounts.id"), nullable=True)
    type = Column(String(20), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String(240), default="", nullable=False)
    transaction_date = Column(Date, default=date.today, nullable=False)
    recurrence = Column(String(80), nullable=True)
    installments = Column(Integer, nullable=True)
    metadata_json = Column(Text, default="{}", nullable=False)


class FinanceGoal(Base, TimestampMixin):
    __tablename__ = "finance_goals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(160), nullable=False)
    target_amount = Column(Float, nullable=False)
    current_amount = Column(Float, default=0.0, nullable=False)
    deadline = Column(Date, nullable=True)


class FinanceBudget(Base, TimestampMixin):
    __tablename__ = "finance_budgets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("finance_categories.id"), nullable=True)
    month = Column(String(7), nullable=False)
    amount = Column(Float, nullable=False)


class FilesIndex(Base, TimestampMixin):
    __tablename__ = "files_index"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    file_path = Column(Text, nullable=False)
    file_hash = Column(String(128), nullable=True)
    summary = Column(Text, nullable=True)
    tags = Column(String(255), default="", nullable=False)


class Setting(Base, TimestampMixin):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    key = Column(String(120), nullable=False)
    value = Column(Text, nullable=False)


class APIUsage(Base, TimestampMixin):
    __tablename__ = "api_usage"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider = Column(String(60), default="openai", nullable=False)
    model = Column(String(80), nullable=False)
    mode = Column(String(40), nullable=False)
    input_tokens = Column(Integer, default=0, nullable=False)
    output_tokens = Column(Integer, default=0, nullable=False)
    total_tokens = Column(Integer, default=0, nullable=False)
    estimated_cost = Column(Float, default=0.0, nullable=False)


class WhatsAppSession(Base, TimestampMixin):
    __tablename__ = "whatsapp_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(40), default="disconnected", nullable=False)
    qr_code = Column(Text, nullable=True)
    whitelist_json = Column(Text, default="[]", nullable=False)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(120), nullable=False)
    target = Column(Text, nullable=True)
    details = Column(Text, default="", nullable=False)
    level = Column(String(30), default="info", nullable=False)


class WorkspaceLayout(Base, TimestampMixin):
    __tablename__ = "workspace_layouts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(160), nullable=False)
    description = Column(Text, default="", nullable=False)
    state_json = Column(Text, default="{}", nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)


class WorkspacePanel(Base, TimestampMixin):
    __tablename__ = "workspace_panels"

    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("workspace_layouts.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    panel_type = Column(String(80), nullable=False)
    title = Column(String(160), nullable=False)
    position_x = Column(Float, default=0.0, nullable=False)
    position_y = Column(Float, default=0.0, nullable=False)
    width = Column(Float, default=420.0, nullable=False)
    height = Column(Float, default=320.0, nullable=False)
    z_index = Column(Integer, default=1, nullable=False)
    content_ref = Column(Text, nullable=True)
    state_json = Column(Text, default="{}", nullable=False)


class WorkspaceConnection(Base, TimestampMixin):
    __tablename__ = "workspace_connections"

    id = Column(Integer, primary_key=True, index=True)
    layout_id = Column(Integer, ForeignKey("workspace_layouts.id"), nullable=False, index=True)
    source_panel_id = Column(Integer, ForeignKey("workspace_panels.id"), nullable=False)
    target_panel_id = Column(Integer, ForeignKey("workspace_panels.id"), nullable=False)
    label = Column(String(120), default="", nullable=False)


class WorkspaceAction(Base, TimestampMixin):
    __tablename__ = "workspace_actions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    action_type = Column(String(80), nullable=False)
    payload_json = Column(Text, default="{}", nullable=False)
    source = Column(String(40), default="ui", nullable=False)


class GestureBinding(Base, TimestampMixin):
    __tablename__ = "gesture_bindings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    gesture_name = Column(String(120), nullable=False)
    action_type = Column(String(120), nullable=False)
    action_payload_json = Column(Text, default="{}", nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    sensitivity = Column(Integer, default=50, nullable=False)
