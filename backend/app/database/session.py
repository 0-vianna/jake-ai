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

    db = SessionLocal()
    try:
        admin = db.query(models.User).filter(models.User.username == "admin").first()
        if not admin:
            admin = models.User(
                name="João",
                username="admin",
                email="admin@jake.local",
                password_hash=get_password_hash("admin123"),
                role="admin",
                permissions="{}",
                theme="light",
            )
            db.add(admin)
            db.commit()
            seed_default_finance_categories(db, admin.id)
    finally:
        db.close()


def seed_default_finance_categories(db: Session, user_id: int) -> None:
    from app.models import FinanceCategory

    categories = [
        ("Alimentação", "expense", "#f97316"),
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

