from io import BytesIO
from zipfile import ZipFile
import xml.etree.ElementTree as ET
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.auth import get_current_user
from app.database import DatabaseManager
from app.services.analysis import build_analysis
from app.services.ingestion import ingest_for_symbols

router = APIRouter(prefix="/api", tags=["analysis"])
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}


def user_id(user: dict) -> str:
    value = user.get("sub") or user.get("id")
    if not value:
        raise HTTPException(status_code=401, detail="User ID not found in token")
    return value


class ManualHolding(BaseModel):
    symbol: str
    company_name: str | None = None
    quantity: float
    buy_price: float
    exchange: str = "NSE"


def parse_xlsx(raw: bytes) -> List[Dict[str, Any]]:
    with ZipFile(BytesIO(raw)) as book:
        strings_root = ET.fromstring(book.read("xl/sharedStrings.xml"))
        strings = ["".join(t.text or "" for t in si.findall(".//m:t", NS)) for si in strings_root.findall("m:si", NS)]
        sheet = ET.fromstring(book.read("xl/worksheets/sheet3.xml"))
        rows = []
        for row in sheet.findall(".//m:row", NS):
            values = {}
            for cell in row.findall("m:c", NS):
                value = cell.find("m:v", NS)
                if value is None:
                    continue
                text = value.text or ""
                if cell.attrib.get("t") == "s":
                    text = strings[int(text)]
                values[cell.attrib["r"][0]] = text
            if values:
                rows.append(values)
        header = next((row for row in rows if row.get("B") == "Symbol"), None)
        if not header:
            raise ValueError("Could not find the Combined holdings table")
        return [{"symbol": row.get("B", "").strip(), "quantity": float(row.get("F", 0) or 0), "buy_price": float(row.get("K", 0) or 0)} for row in rows[rows.index(header) + 1:] if row.get("B", "").strip() and row.get("F") and row.get("K")]


@router.post("/holdings/manual")
def add_manual(payload: ManualHolding, user: dict = Depends(get_current_user)):
    data = payload.model_dump()
    data["symbol"] = data["symbol"].strip().upper()
    data["company_name"] = data["company_name"] or f"{data['symbol']} Ltd"
    return DatabaseManager.add_holding(user_id(user), data)


@router.post("/holdings/import")
async def import_holdings(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    if not file.filename or not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Upload an .xlsx holdings file.")
    try:
        rows = parse_xlsx(await file.read())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read spreadsheet: {exc}")
    imported = [DatabaseManager.add_holding(user_id(user), {**row, "company_name": f"{row['symbol']} Holdings", "exchange": "NSE"}) for row in rows]
    return {"count": len(imported), "holdings": imported}


@router.get("/analysis/{holding_id}")
def analyze(holding_id: str, user: dict = Depends(get_current_user)):
    holdings = DatabaseManager.get_holdings(user_id(user))
    holding = next((item for item in holdings if item["id"] == holding_id), None)
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    try:
        ingest_for_symbols([holding["symbol"]])
    except Exception:
        pass
    news = DatabaseManager.get_news_by_symbol(holding["symbol"], max_days=30)
    return build_analysis(holding, news)
