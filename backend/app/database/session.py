from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.config import settings


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app import models  # noqa: F401
    from app.security import get_password_hash

    Base.metadata.create_all(bind=engine)
    ensure_user_auth_columns()
    admin_password_hash = get_password_hash("Joao@Jake2026")

    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.username == "jprvianna").first()
        if not admin:
            admin = models.User(
                name="Joao Vianna",
                username="jprvianna",
                email="jprvianna@jake.local",
                password_hash=admin_password_hash,
                role="admin",
                permissions="{}",
                theme="light",
                email_verified=True,
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)
        else:
            admin.role = "admin"
            admin.email_verified = True
            admin.password_hash = admin_password_hash
            db.commit()
        seed_default_finance_categories(db, admin.id)
    finally:
        db.close()


def ensure_user_auth_columns() -> None:
    if not settings.database_url.startswith("sqlite"):
        return
    with engine.begin() as connection:
        columns = {row[1] for row in connection.exec_driver_sql("PRAGMA table_info(users)").fetchall()}
        if "email_verified" not in columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT 0")
        if "verification_token" not in columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN verification_token VARCHAR(255)")
        if "verification_sent_at" not in columns:
            connection.exec_driver_sql("ALTER TABLE users ADD COLUMN verification_sent_at DATETIME")


def seed_default_finance_categories(db: Session, user_id: int) -> None:
    from app.models import FinanceCategory

    categories = [
        ("Alimentacao", "expense", "#f97316"),
        ("Transporte", "expense", "#0ea5e9"),
        ("Casa", "expense", "#64748b"),
        ("Lazer", "expense", "#a855f7"),
        ("Trabalho", "income", "#16a34a"),
        ("Outros", "expense", "#78716c"),
    ]
    for name, kind, color in categories:
        exists = (
            db.query(FinanceCategory)
            .filter(FinanceCategory.user_id == user_id, FinanceCategory.name == name)
            .first()
        )
        if not exists:
            db.add(FinanceCategory(user_id=user_id, name=name, type=kind, color=color))
    db.commit()
