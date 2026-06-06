import re
from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.models import FinanceCategory, FinanceTransaction


MONEY_RE = re.compile(r"(?:r\$\s*)?(\d+(?:[.,]\d{1,2})?)", re.IGNORECASE)
FINANCE_TRIGGER_RE = re.compile(
    r"\b("
    r"gastei|gasto|paguei|pagar|comprei|compra|despesa|debito|debitei|"
    r"anote|anota|registre|registra|lance|lanca|lancar|"
    r"recebi|ganhei|ganho|entrada|salario|renda|pix"
    r")\b",
    re.IGNORECASE,
)
QUESTION_RE = re.compile(r"\b(quanto|qual|mostre|liste|resumo|relatorio|saldo|total)\b", re.IGNORECASE)


def should_create_finance_entry(text: str) -> bool:
    normalized = normalize_text(text)
    if not MONEY_RE.search(normalized):
        return False
    explicit_register = any(word in normalized for word in ["anote", "anota", "registre", "registra", "lance", "lanca", "lancar"])
    if QUESTION_RE.search(normalized) and not explicit_register:
        return False
    return bool(FINANCE_TRIGGER_RE.search(normalized))


def create_transaction_from_text(db: Session, user_id: int, text: str) -> FinanceTransaction:
    data = infer_transaction_from_text(db, user_id, text)
    tx = FinanceTransaction(user_id=user_id, **data)
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


def infer_transaction_from_text(db: Session, user_id: int, text: str) -> dict:
    normalized = normalize_text(text)
    match = MONEY_RE.search(normalized)
    amount = parse_money(match.group(1)) if match else 0.0
    kind = "income" if any(word in normalized for word in ["recebi", "ganhei", "ganho", "entrada", "salario", "renda"]) else "expense"
    category_name = infer_category_name(normalized, kind)
    category = find_category(db, user_id, category_name)
    return {
        "type": kind,
        "amount": amount,
        "description": build_description(normalized, text),
        "category_id": category.id if category else None,
        "transaction_date": date.today(),
    }


def infer_category_name(normalized: str, kind: str) -> str:
    if kind == "income":
        return "Trabalho"
    if any(word in normalized for word in ["lanche", "comida", "mercado", "restaurante", "ifood", "pizza", "hamburguer"]):
        return "Alimentacao"
    if any(word in normalized for word in ["uber", "onibus", "gasolina", "transporte", "99", "taxi"]):
        return "Transporte"
    if any(word in normalized for word in ["aluguel", "luz", "agua", "internet", "casa", "condominio"]):
        return "Casa"
    if any(word in normalized for word in ["remedio", "farmacia", "medico", "consulta"]):
        return "Saude"
    if any(word in normalized for word in ["jogo", "netflix", "spotify", "cinema", "lazer"]):
        return "Lazer"
    return "Outros"


def find_category(db: Session, user_id: int, category_name: str) -> FinanceCategory | None:
    expected = normalize_text(category_name)
    categories = db.query(FinanceCategory).filter(FinanceCategory.user_id == user_id).all()
    for category in categories:
        if normalize_text(category.name) == expected:
            return category
    return None


def describe_transaction(db: Session, tx: FinanceTransaction) -> str:
    kind = "receita" if tx.type == "income" else "despesa"
    category = db.query(FinanceCategory).filter(FinanceCategory.id == tx.category_id).first() if tx.category_id else None
    category_name = category.name if category else "Sem categoria"
    return (
        f"Anotei no Financeiro: {kind} de {format_brl(tx.amount)} "
        f"em {category_name}, descricao \"{tx.description}\"."
    )


def build_description(normalized: str, original: str) -> str:
    description = MONEY_RE.sub(" ", normalized)
    description = re.sub(r"[,.;:!?]+", " ", description)
    for word in [
        "jake",
        "anote",
        "anota",
        "registre",
        "registra",
        "lance",
        "lanca",
        "lancar",
        "gastei",
        "gasto",
        "paguei",
        "pagar",
        "comprei",
        "compra",
        "despesa",
        "debito",
        "debitei",
        "recebi",
        "ganhei",
        "ganho",
        "entrada",
        "reais",
        "real",
        "r$",
        "com",
        "de",
        "em",
        "no",
        "na",
        "um",
        "uma",
    ]:
        description = description.replace(word, " ")
    description = " ".join(description.split())
    return description or original.strip()


def parse_money(value: str) -> float:
    return float(value.replace(",", "."))


def normalize_text(text: str) -> str:
    return (
        text.lower()
        .replace("ç", "c")
        .replace("á", "a")
        .replace("à", "a")
        .replace("ã", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("õ", "o")
        .replace("ú", "u")
    )


def format_brl(value: float) -> str:
    formatted = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"R$ {formatted}"


def finance_summary(db: Session, user_id: int) -> dict:
    transactions = db.query(FinanceTransaction).filter(FinanceTransaction.user_id == user_id).all()
    income = sum(t.amount for t in transactions if t.type == "income")
    expense = sum(t.amount for t in transactions if t.type == "expense")
    by_category: dict[str, float] = defaultdict(float)
    categories = {c.id: c.name for c in db.query(FinanceCategory).filter(FinanceCategory.user_id == user_id).all()}
    monthly: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expense": 0.0})
    for tx in transactions:
        category = categories.get(tx.category_id, "Sem categoria")
        if tx.type == "expense":
            by_category[category] += tx.amount
        month = tx.transaction_date.strftime("%Y-%m")
        monthly[month][tx.type] += tx.amount
    top_category = max(by_category.items(), key=lambda item: item[1], default=("Sem dados", 0.0))
    return {
        "income": income,
        "expense": expense,
        "balance": income - expense,
        "by_category": [{"name": name, "value": value} for name, value in by_category.items()],
        "monthly": [{"month": month, **values} for month, values in sorted(monthly.items())],
        "analysis": {
            "top_category": top_category[0],
            "top_category_value": top_category[1],
            "suggestion": "Continue registrando receitas e despesas pelo chat para o Jake identificar padroes e avisos.",
        },
    }
