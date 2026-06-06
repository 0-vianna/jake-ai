from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from html import unescape
from urllib.parse import parse_qs, unquote, urlparse
from zoneinfo import ZoneInfo

import httpx
from bs4 import BeautifulSoup


SAO_PAULO = ZoneInfo("America/Sao_Paulo")

SEARCH_INTENT_RE = re.compile(
    r"\b("
    r"pesquise|pesquisar|busque|buscar|procure|internet|google|web|site|not[ií]cia|"
    r"atual|recente|pr[oó]ximo jogo|proximo jogo|placar|resultado|"
    r"hor[aá]rio|horario|que horas|data|dia"
    r")\b",
    re.IGNORECASE,
)

TIME_ONLY_RE = re.compile(
    r"\b(que horas|hor[aá]rio|horario|hora atual|data de hoje|que dia (?:é|e) hoje|dia de hoje)\b",
    re.IGNORECASE,
)


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str


def local_datetime_text() -> str:
    now = datetime.now(SAO_PAULO)
    return now.strftime("%A, %d/%m/%Y, %H:%M:%S").replace("Friday", "sexta-feira")


def direct_datetime_answer(message: str) -> str | None:
    normalized = message.strip().lower()
    if not TIME_ONLY_RE.search(normalized):
        return None
    if any(term in normalized for term in ["jogo", "placar", "resultado", "internet", "pesquise", "buscar", "busque"]):
        return None
    now = datetime.now(SAO_PAULO)
    return (
        "Agora são "
        f"{now:%H:%M} de {now:%d/%m/%Y} "
        "(horário de Brasília, America/Sao_Paulo)."
    )


def should_search_web(message: str) -> bool:
    normalized = message.lower()
    if "galo" in normalized and any(word in normalized for word in ["jogo", "placar", "resultado", "proximo", "próximo"]):
        return True
    return bool(SEARCH_INTENT_RE.search(normalized)) and not direct_datetime_answer(message)


def build_tool_context(message: str) -> str:
    parts = [
        "Data e hora locais confirmadas pelo sistema: "
        f"{datetime.now(SAO_PAULO):%d/%m/%Y %H:%M:%S} (America/Sao_Paulo)."
    ]
    if should_search_web(message):
        query = refine_query(message)
        results = search_web(query)
        if results:
            lines = [f"Busca web feita para: {query}"]
            for index, item in enumerate(results, start=1):
                lines.append(f"{index}. {item.title}\nURL: {item.url}\nResumo: {item.snippet}")
            parts.append("\n".join(lines))
        else:
            parts.append(
                "Busca web feita, mas nenhum resultado confiável foi extraído. "
                "Diga isso com clareza e sugira uma fonte oficial."
            )
    return "\n\n".join(parts)


def refine_query(message: str) -> str:
    normalized = message.lower()
    if "galo" in normalized or "atlético mineiro" in normalized or "atletico mineiro" in normalized:
        if any(word in normalized for word in ["jogo", "partida", "calendario", "calendário", "proximo", "próximo"]):
            return "próximo jogo Atlético Mineiro data horário fonte oficial"
    if "horário" in normalized or "horario" in normalized or "que horas" in normalized:
        return "horário atual Brasília"
    return message.strip()[:220]


def search_web(query: str, limit: int = 5) -> list[SearchResult]:
    results = _duckduckgo_html(query, limit=limit)
    if results:
        return results
    return _duckduckgo_instant_answer(query, limit=limit)


def _duckduckgo_html(query: str, limit: int) -> list[SearchResult]:
    try:
        with httpx.Client(timeout=8.0, follow_redirects=True, headers=_headers()) as client:
            response = client.get("https://duckduckgo.com/html/", params={"q": query})
            response.raise_for_status()
    except Exception:
        return []

    soup = BeautifulSoup(response.text, "html.parser")
    items: list[SearchResult] = []
    for result in soup.select(".result"):
        link = result.select_one(".result__a")
        if not link:
            continue
        title = clean_text(link.get_text(" ", strip=True))
        href = clean_url(link.get("href", ""))
        snippet_node = result.select_one(".result__snippet")
        snippet = clean_text(snippet_node.get_text(" ", strip=True) if snippet_node else "")
        if title and href:
            items.append(SearchResult(title=title, url=href, snippet=snippet or "Sem resumo disponível."))
        if len(items) >= limit:
            break
    return items


def _duckduckgo_instant_answer(query: str, limit: int) -> list[SearchResult]:
    try:
        with httpx.Client(timeout=8.0, follow_redirects=True, headers=_headers()) as client:
            response = client.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_redirect": 1, "no_html": 1},
            )
            response.raise_for_status()
            data = response.json()
    except Exception:
        return []

    items: list[SearchResult] = []
    abstract = clean_text(data.get("AbstractText", ""))
    url = data.get("AbstractURL") or "https://duckduckgo.com/"
    heading = data.get("Heading") or query
    if abstract:
        items.append(SearchResult(title=heading, url=url, snippet=abstract))
    for topic in data.get("RelatedTopics", []):
        if "Topics" in topic:
            for nested in topic["Topics"]:
                _append_instant_topic(items, nested)
        else:
            _append_instant_topic(items, topic)
        if len(items) >= limit:
            break
    return items[:limit]


def _append_instant_topic(items: list[SearchResult], topic: dict) -> None:
    text = clean_text(topic.get("Text", ""))
    first_url = topic.get("FirstURL", "")
    if text and first_url:
        title = text.split(" - ", 1)[0][:100]
        items.append(SearchResult(title=title, url=first_url, snippet=text))


def clean_url(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    if parsed.netloc.endswith("duckduckgo.com") and parsed.path.startswith("/l/"):
        target = parse_qs(parsed.query).get("uddg", [""])[0]
        return unquote(target) if target else url
    if url.startswith("//"):
        return f"https:{url}"
    return url


def clean_text(text: str) -> str:
    return " ".join(unescape(text).split())


def _headers() -> dict[str, str]:
    return {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36"
        )
    }
