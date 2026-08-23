import os
import json
import re
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import pdf2image
import pytesseract
import ollama

app = FastAPI(title="Invoice2CSV Python Vision & Local LLM Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class InvoiceItem(BaseModel):
    itemNumber: int
    description: str
    quantity: float
    unitPrice: float
    amount: float

class ExtractedInvoice(BaseModel):
    invoiceNumber: str
    invoiceDate: str
    sellerName: str
    sellerNif: str
    sellerAddress: str
    buyerName: str
    buyerNif: str
    buyerAddress: str
    items: List[InvoiceItem]
    subtotal: float
    taxRate: float
    taxAmount: float
    irpfAmount: float
    total: float
    currency: str

@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "service": "Python Vision & CUDA LLM OCR Engine",
        "ollama_host": os.getenv("OLLAMA_HOST", "http://localhost:11434")
    }

@app.post("/extract-vision", response_model=ExtractedInvoice)
async def extract_invoice_vision(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        # 1. Convert PDF pages to PIL Images in memory
        images = []
        if file.filename.endswith(".pdf"):
            images = pdf2image.convert_from_bytes(contents)
        
        ocr_text = ""
        for img in images:
            ocr_text += pytesseract.image_to_string(img) + "\n"

        if not ocr_text.strip():
            ocr_text = contents.decode("utf-8", errors="ignore")

        # 2. Query Local Ollama LLM with structured Vision/OCR prompt
        extracted = query_ollama_llm(ocr_text)
        if extracted:
            return extracted

        # 3. Fallback Regex Parsing if LLM fails
        return parse_fallback_regex(ocr_text)

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Python Vision Extraction Error: {str(e)}")


def query_ollama_llm(ocr_text: str) -> Optional[ExtractedInvoice]:
    try:
        prompt = f"""You are an expert AI Invoice Extraction System powered by Local Vision LLM.
Analyze the following raw OCR text extracted from an invoice PDF image and return STRICT JSON with NO conversational text.

Required JSON Structure:
{{
  "invoiceNumber": "string",
  "invoiceDate": "YYYY-MM-DD",
  "sellerName": "string",
  "sellerNif": "string",
  "sellerAddress": "string",
  "buyerName": "string",
  "buyerNif": "string",
  "buyerAddress": "string",
  "items": [
    {{
      "itemNumber": 1,
      "description": "string",
      "quantity": 1.0,
      "unitPrice": 0.0,
      "amount": 0.0
    }}
  ],
  "subtotal": 0.0,
  "taxRate": 0.0,
  "taxAmount": 0.0,
  "irpfAmount": 0.0,
  "total": 0.0,
  "currency": "EUR"
}}

Raw OCR Text:
{ocr_text[:4000]}
"""
        client = ollama.Client(host=os.getenv("OLLAMA_HOST", "http://localhost:11434"))
        response = client.generate(
            model=os.getenv("OLLAMA_MODEL", "llama3"),
            prompt=prompt,
            format="json",
            stream=False
        )

        raw_json = response.get("response", "")
        data = json.loads(raw_json)
        
        return ExtractedInvoice(
            invoiceNumber=data.get("invoiceNumber", ""),
            invoiceDate=data.get("invoiceDate", ""),
            sellerName=data.get("sellerName", ""),
            sellerNif=data.get("sellerNif", ""),
            sellerAddress=data.get("sellerAddress", ""),
            buyerName=data.get("buyerName", ""),
            buyerNif=data.get("buyerNif", ""),
            buyerAddress=data.get("buyerAddress", ""),
            items=data.get("items", []),
            subtotal=float(data.get("subtotal", 0)),
            taxRate=float(data.get("taxRate", 0)),
            taxAmount=float(data.get("taxAmount", 0)),
            irpfAmount=float(data.get("irpfAmount", 0)),
            total=float(data.get("total", 0)),
            currency=data.get("currency", "EUR")
        )
    except Exception:
        return None


def parse_fallback_regex(text: str) -> ExtractedInvoice:
    # Python Regular Expression Fallback
    inv_num = ""
    match_num = re.search(r'(?:Invoice\s*No|Factura\s*Nº)\s*:?\s*([A-Z0-9\-/]+)', text, re.I)
    if match_num:
        inv_num = match_num.group(1)

    inv_date = ""
    match_date = re.search(r'(?:Issue\s*Date|Fecha)\s*:?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})', text, re.I)
    if match_date:
        inv_date = match_date.group(1)

    seller_name = ""
    match_seller = re.search(r'SUPPLIER\s*\n+([^\n]+)', text, re.I)
    if match_seller:
        seller_name = match_seller.group(1).strip()

    buyer_name = ""
    match_buyer = re.search(r'BILL\s*TO\s*\n+([^\n]+)', text, re.I)
    if match_buyer:
        buyer_name = match_buyer.group(1).strip()

    subtotal = 0.0
    match_sub = re.search(r'Subtotal\s*€?\s*([0-9.,]+)', text, re.I)
    if match_sub:
        subtotal = float(match_sub.group(1).replace(',', ''))

    total = 0.0
    match_tot = re.search(r'Total\s*Due\s*€?\s*([0-9.,]+)', text, re.I)
    if match_tot:
        total = float(match_tot.group(1).replace(',', ''))

    return ExtractedInvoice(
        invoiceNumber=inv_num,
        invoiceDate=inv_date,
        sellerName=seller_name,
        sellerNif="",
        sellerAddress="",
        buyerName=buyer_name,
        buyerNif="",
        buyerAddress="",
        items=[],
        subtotal=subtotal,
        taxRate=21.0,
        taxAmount=total - subtotal if total > subtotal else 0.0,
        irpfAmount=0.0,
        total=total,
        currency="EUR"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
