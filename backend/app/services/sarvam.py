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
Classify its category, materiality score, directional sentiment, and write a 2-4 sentence plain-language explanation of what happened and why it matters for stock investors.

You must output strictly valid JSON with no markdown wrapping. Example output format:
{
  "category": "Quarterly Results",
  "materiality": "high",
  "sentiment": "positive",
  "summary": "Eternal Ltd reported a strong 45% YoY surge in Q1 net profit to Rs 850 crore. The earnings beat driven by expanding operational margins is likely to boost investor sentiment and drive positive stock price movement."
}

Allowed Values:
- category: MUST be one of ["Quarterly Results", "Guidance Cut", "Regulatory/Legal", "Management Change", "Dividend/Bonus", "M&A", "Credit Rating", "Board Meeting", "General News"]
- materiality: MUST be one of ["high", "medium", "low"]
- sentiment: MUST be one of ["positive", "negative", "neutral", "unclear"]
"""


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
        # Match the verified standalone connection call in backend/llm.py.
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

        # Extract JSON object using raw_decode to ignore any extra trailing text/markdown.
        # The API can occasionally return a plain-text answer even when instructed to
        # emit JSON; retain that answer instead of failing the entire ingestion job.
        try:
            if "{" in clean_text:
                start_idx = clean_text.find("{")
                decoder = json.JSONDecoder()
                parsed, _ = decoder.raw_decode(clean_text[start_idx:])
            else:
                parsed = json.loads(clean_text)
        except json.JSONDecodeError:
            logger.warning("Sarvam returned non-JSON content; using a neutral fallback.")
            return {
                "category": "General News",
                "materiality": "medium",
                "sentiment": "neutral",
                "summary": clean_text or title,
            }

        return {
            "category": parsed.get("category", "General News"),
            "materiality": str(parsed.get("materiality", "medium")).lower(),
            "sentiment": str(parsed.get("sentiment", "neutral")).lower(),
            "summary": parsed.get("summary", title)
        }
    except Exception as e:
        logger.error(f"Sarvam API request failed: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=502,
            detail=f"Sarvam AI service error: {str(e)}"
        )
