import os
import json
import logging
import httpx
from typing import Dict, Any
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("sarvam_service")

SARVAM_API_KEY = os.getenv("SARVAM_API_KEY", "")
SARVAM_ENDPOINT = "https://api.sarvam.ai/v1/chat/completions"
MODEL_NAME = "sarvam-105b"

SYSTEM_PROMPT = """You are an expert Indian financial market news analyst.
Analyze the provided corporate filing or news item for a listed Indian company (NSE/BSE).
Classify its category, materiality score, directional sentiment, and write a concise 2-3 sentence max (30-50 words) plain-language summary of what happened and why it matters for stock investors.

CRITICAL INSTRUCTION: Respond ONLY with a single valid JSON object. Do NOT include any introductory text, reasoning monologue, chain-of-thought, or text outside the JSON.

Example output format:
{
  "category": "Quarterly Results",
  "materiality": "high",
  "sentiment": "positive",
  "summary": "Eternal Ltd reported a strong 45% YoY surge in Q1 net profit to Rs 850 crore. Operational margin expansion is likely to support positive stock price momentum."
}

Allowed Values:
- category: MUST be one of ["Quarterly Results", "Guidance Cut", "Regulatory/Legal", "Management Change", "Dividend/Bonus", "M&A", "Credit Rating", "Board Meeting", "General News"]
- materiality: MUST be one of ["high", "medium", "low"]
- sentiment: MUST be one of ["positive", "negative", "neutral", "unclear"]
- summary: MUST be a concise 2 to 3 sentence maximum summary explaining key facts and investor impact.
"""


def is_reasoning_monologue(text: str) -> bool:
    """Checks if text contains raw LLM chain-of-thought monologue or prompt echoes."""
    lowered = text.lower()
    patterns = [
        "the user wants",
        "let me parse",
        "detailed content:",
        "title/headline:",
        "company symbol:",
        "analyze the provided",
        "wait, this seems to be",
        "this is a live market report",
    ]
    return any(p in lowered for p in patterns)


def sanitize_summary(summary_text: str, title: str, symbol: str) -> str:
    """Sanitizes summary string to prevent internal reasoning leakages."""
    if not summary_text or is_reasoning_monologue(summary_text):
        return f"{title}. Market intelligence report concerning {symbol}."
    return summary_text.strip()


def classify_and_summarize(symbol: str, title: str, content: str = "") -> Dict[str, Any]:
    """
    Classifies filing/news item exclusively using Sarvam AI API (sarvam-105b).
    """
    api_key = os.getenv("SARVAM_API_KEY", "") or SARVAM_API_KEY
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="SARVAM_API_KEY environment variable is not configured. Please set SARVAM_API_KEY in backend/.env to use Sarvam AI classification."
        )

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json"
    }

    user_content = f"Company Symbol: {symbol}\nTitle/Headline: {title}\nDetailed Content: {content[:2000] if content else 'N/A'}"

    payload = {
        "model": MODEL_NAME,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content}
        ],
        "max_tokens": 1024,
    }

    try:
        response = httpx.post(SARVAM_ENDPOINT, headers=headers, json=payload, timeout=30.0)
        response.raise_for_status()
        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            raise HTTPException(status_code=502, detail="Sarvam API returned empty choices.")

        message_obj = choices[0].get("message", {})
        content_raw = message_obj.get("content")

        if not content_raw:
            content_raw = message_obj.get("reasoning_content") or ""

        if not content_raw:
            logger.error(f"Sarvam API response message content is null/empty: {data}")
            raise HTTPException(
                status_code=502,
                detail="Sarvam AI response content was empty. Please check token budget or Sarvam API response structure."
            )

        clean_text = content_raw.replace("```json", "").replace("```", "").strip()

        parsed = None
        try:
            if "{" in clean_text and "}" in clean_text:
                start_idx = clean_text.find("{")
                end_idx = clean_text.rfind("}") + 1
                json_str = clean_text[start_idx:end_idx]
                parsed = json.loads(json_str)
            elif "{" in clean_text:
                start_idx = clean_text.find("{")
                decoder = json.JSONDecoder()
                parsed, _ = decoder.raw_decode(clean_text[start_idx:])
            else:
                parsed = json.loads(clean_text)
        except Exception:
            logger.warning("Sarvam returned non-JSON content; using neutral fallback.")
            return {
                "category": "General News",
                "materiality": "medium",
                "sentiment": "neutral",
                "summary": sanitize_summary("", title, symbol),
            }

        raw_summary = parsed.get("summary", "")
        final_summary = sanitize_summary(raw_summary, title, symbol)

        return {
            "category": parsed.get("category", "General News"),
            "materiality": str(parsed.get("materiality", "medium")).lower(),
            "sentiment": str(parsed.get("sentiment", "neutral")).lower(),
            "summary": final_summary
        }
    except Exception as e:
        logger.error(f"Sarvam API request failed: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=502,
            detail=f"Sarvam AI service error: {str(e)}"
        )
