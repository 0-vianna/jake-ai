from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db, seed_default_finance_categories
from app.deps import get_current_user
from app.models import FinanceCategory, FinanceTransaction, User
from app.schemas import (
    FinanceCategoryCreate,
    FinanceCategoryOut,
    FinanceTransactionCreate,
    FinanceTransactionOut,
    QuickFinanceRequest,
)
from app.services.finance_service import finance_summary, infer_transaction_from_text
from app.services.audit_service import log_action

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get("/summary")
def summary(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    seed_default_finance_categories(db, current_user.id)
    return finance_summary(db, current_user.id)


@router.get("/categories", response_model=list[FinanceCategoryOut])
def categories(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[FinanceCategoryOut]:
    seed_default_finance_categories(db, current_user.id)
    rows = db.query(FinanceCategory).filter(FinanceCategory.user_id == current_user.id).order_by(FinanceCategory.name.asc()).all()
    return [FinanceCategoryOut.model_validate(row) for row in rows]


@router.post("/categories", response_model=FinanceCategoryOut)
def create_category(
    payload: FinanceCategoryCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FinanceCategoryOut:
    category = FinanceCategory(user_id=current_user.id, **payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    return FinanceCategoryOut.model_validate(category)


@router.get("/transactions", response_model=list[FinanceTransactionOut])
def transactions(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[FinanceTransactionOut]:
    rows = (
        db.query(FinanceTransaction)
        .filter(FinanceTransaction.user_id == current_user.id)
        .order_by(FinanceTransaction.transaction_date.desc(), FinanceTransaction.created_at.desc())
        .limit(100)
        .all()
    )
    return [FinanceTransactionOut.model_validate(row) for row in rows]


@router.post("/transactions", response_model=FinanceTransactionOut)
def create_transaction(
    payload: FinanceTransactionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FinanceTransactionOut:
    data = payload.model_dump()
    data["transaction_date"] = data["transaction_date"] or date.today()
    tx = FinanceTransaction(user_id=current_user.id, **data)
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return FinanceTransactionOut.model_validate(tx)


@router.post("/quick-entry", response_model=FinanceTransactionOut)
def quick_entry(
    payload: QuickFinanceRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> FinanceTransactionOut:
    seed_default_finance_categories(db, current_user.id)
    data = infer_transaction_from_text(db, current_user.id, payload.text)
    tx = FinanceTransaction(user_id=current_user.id, **data)
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return FinanceTransactionOut.model_validate(tx)


@router.delete("/reset")
def reset_finance(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict:
    deleted = db.query(FinanceTransaction).filter(FinanceTransaction.user_id == current_user.id).delete()
    db.commit()
    log_action(db, "finance.reset", current_user.id, details=f"{deleted} lançamentos removidos")
    return {"ok": True, "deleted": deleted}
