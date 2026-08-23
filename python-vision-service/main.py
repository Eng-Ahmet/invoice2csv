import os
import json
import re
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import pdf2image
import pytesseract
import torch
import numpy as np

app = FastAPI(title="Invoice2CSV PyTorch & CUDA Vision Extraction Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# PyTorch CUDA / CPU device setup
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"[PyTorch Engine] Running on device: {device}")

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
        "service": "PyTorch & CUDA Vision OCR Engine",
        "device": str(device),
        "cuda_available": torch.cuda.is_available()
    }

@app.post("/extract-vision", response_model=ExtractedInvoice)
async def extract_invoice_vision(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        
        images = []
        if file.filename.endswith(".pdf"):
            images = pdf2image.convert_from_bytes(contents)
        
        ocr_text = ""
        for img in images:
            text_page = pytesseract.image_to_string(img, lang="spa+eng")
            ocr_text += text_page + "\n"

        if not ocr_text.strip():
            ocr_text = contents.decode("utf-8", errors="ignore")

        extractor = PyTorchInvoiceExtractor(ocr_text, device=device)
        return extractor.extract()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PyTorch Vision Extraction Error: {str(e)}")


class PyTorchInvoiceExtractor:
    def __init__(self, raw_text: str, device: torch.device = None):
        self.text = raw_text
        self.lines = [line.strip() for line in raw_text.split('\n') if line.strip()]
        self.device = device
        
        if self.lines:
            line_lens = [len(l) for l in self.lines]
            self.tensor_lens = torch.tensor(line_lens, dtype=torch.float32, device=self.device)
        else:
            self.tensor_lens = torch.tensor([], dtype=torch.float32, device=self.device)

    def extract(self) -> ExtractedInvoice:
        inv_num = self.extract_invoice_number()
        inv_date = self.extract_date()
        parties = self.extract_parties_nif_anchored()
        financials = self.extract_financials()
        items = self.extract_items()

        return ExtractedInvoice(
            invoiceNumber=inv_num,
            invoiceDate=inv_date,
            sellerName=parties["sellerName"],
            sellerNif=parties["sellerNif"],
            sellerAddress=parties["sellerAddress"],
            buyerName=parties["buyerName"],
            buyerNif=parties["buyerNif"],
            buyerAddress=parties["buyerAddress"],
            items=items,
            subtotal=financials["subtotal"],
            taxRate=financials["taxRate"],
            taxAmount=financials["taxAmount"],
            irpfAmount=financials["irpfAmount"],
            total=financials["total"],
            currency=financials["currency"]
        )

    def extract_invoice_number(self) -> str:
        patterns = [
            r'(?:Factura\s*Nº|Nº\s*Factura|Num\s*Factura|Factura\s*#|Invoice\s*No|Invoice\s*#|Invoice\s*Number)\s*:?\s*([A-Z0-9\-/]+)',
            r'(?:Factura|Invoice)\s*:?\s*([A-Z0-9\-/]{3,20})',
            r'(?:Nº|N°|Ref)\s*:?\s*([A-Z0-9\-/]{3,20})'
        ]
        for p in patterns:
            match = re.search(p, self.text, re.IGNORECASE)
            if match:
                res = match.group(1).strip()
                if len(res) >= 2 and not res.lower() in ["de", "del", "fecha", "date"]:
                    return res
        return ""

    def extract_date(self) -> str:
        patterns = [
            r'(?:Fecha\s*Factura|Fecha\s*de\s*expedición|Fecha\s*Emisión|Fecha|Issue\s*Date|Date)\s*:?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})',
            r'(?:Fecha\s*Factura|Fecha\s*de\s*expedición|Fecha\s*Emisión|Fecha|Issue\s*Date|Date)\s*:?\s*(\d{4}[\/\.-]\d{1,2}[\/\.-]\d{1,2})',
            r'\b(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})\b',
            r'\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})\b'
        ]
        for p in patterns:
            match = re.search(p, self.text, re.IGNORECASE)
            if match:
                return self.format_date_iso(match.group(1))
        return ""

    def format_date_iso(self, date_str: str) -> str:
        parts = re.split(r'[\/\.-]', date_str)
        if len(parts) == 3:
            if len(parts[0]) == 4:
                return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
            return f"{parts[2]}-{parts[1].zfill(2)}-{parts[0].zfill(2)}"
        return date_str

    def extract_nifs_with_line_indices(self) -> List[Dict[str, Any]]:
        """Find all NIFs in document with their line numbers."""
        nifs = []
        patterns = [
            r'(?:NIF\s*\/\s*CIF|NIF|CIF|NIE|VAT|Tax\s*ID|DNI|C\.I\.F\.|N\.I\.F\.)\s*:?\s*([A-Z0-9\-\.]{8,12})',
            r'\b([ABCDEFGHJNPQRSUVW]\s*-?\s*\d{7,8}\s*[0-9A-J])\b',
            r'\b(\d{8}\s*-?\s*[A-Z])\b',
            r'\b([XYZ]\s*-?\s*[0-9]{7}\s*[A-Z])\b',
            r'\b(ES\s*-?\s*[A-Z0-9]{8,10})\b'
        ]
        
        seen_nifs = set()
        for idx, line in enumerate(self.lines):
            for p in patterns:
                match = re.search(p, line, re.IGNORECASE)
                if match:
                    clean_nif = re.sub(r'[\s\.-]', '', match.group(1)).upper()
                    if len(clean_nif) >= 8 and clean_nif not in seen_nifs:
                        seen_nifs.add(clean_nif)
                        nifs.append({"nif": clean_nif, "line_idx": idx})
        return nifs

    def is_address_line(self, line: str) -> bool:
        return bool(re.search(r'(?:Calle|C\/|C\.|Avda|Av\.|Avenue|Carretera|Ctra|Street|St\.|Address|Plaza|Pl\.|Pº|Paseo|Road|Rd\.|Via|Rua|Piso|Puerta|Bloque|Esc\.|Escalera|Conil|Málaga|Malaga|Madrid|Barcelona|Sevilla|Valencia|\b\d{5}\b)', line, re.IGNORECASE))

    def is_header_or_label_line(self, line: str) -> bool:
        clean = line.strip()
        if not clean:
            return True

        if re.search(r'^(?:Official\s*invoice\s*document|Official\s*invoice|Tax\s*Invoice|Commercial\s*Invoice|Invoice\s*Document|Factura\s*Proforma|Factura|Receipt|Recibo)$', clean, re.IGNORECASE):
            return True

        if re.search(r'^(?:Invoice\s*No|Issue\s*Date|Generated|Tax\s*Number|Verification\s*Code|Ref|Fecha|CR:)\b', clean, re.IGNORECASE):
            return True
        if re.search(r'^[A-Z0-9]{10,}(?:-[A-Z0-9]+)+$', clean, re.IGNORECASE):
            return True

        header_words = [
            'SUPPLIER', 'VENDEDOR', 'EMISOR', 'PROVEEDOR', 'DE:', 'FROM:',
            'FACTURADO A', 'DATOS DEL CLIENTE', 'DATOS DEL VENDEDOR', 'DATOS DEL EMISOR',
            'CLIENT IDENTITY KYC', 'CLIENT IDENTITY', 'IDENTITY KYC', 'COMPRADOR',
            'CLIENTE', 'BILL TO', 'INVOICE TO', 'SHIP TO', 'ENVIADO A', 'RECEPTOR',
            'CLIENT', 'COMPANY / AUTÓNOMO', 'AUTÓNOMO', 'COMPANY', 'CUSTOMER', 'NAME', 'NOMBRE'
        ]

        normalized = re.sub(r'[\/\:\-\s]+', ' ', clean).strip().upper()
        temp = normalized
        for hw in header_words:
            temp = temp.replace(hw, '').strip()
        if len(temp) == 0:
            return True

        return False

    def is_blacklisted_line(self, line: str) -> bool:
        if self.is_header_or_label_line(line):
            return True
        blacklists = [
            r'about:srcdoc', r'about:blank', r'http', r'https', r'www\.',
            r'HW\s*AI'
        ]
        for b in blacklists:
            if re.search(b, line, re.IGNORECASE):
                return True
        return False

    def extract_nif(self, text: str) -> str:
        patterns = [
            r'(?:NIF\s*\/\s*CIF|NIF|CIF|NIE|VAT|Tax\s*ID|DNI|C\.I\.F\.|N\.I\.F\.|ID\s*\/\s*Tax\s*No|Tax\s*No)\s*:?\s*([A-Z0-9\-\.]{8,12})',
            r'\b([ABCDEFGHJNPQRSUVW]\s*-?\s*\d{7,8}\s*[0-9A-J])\b',
            r'\b(\d{8}\s*-?\s*[A-Z])\b',
            r'\b([XYZ]\s*-?\s*[0-9]{7}\s*[A-Z])\b',
            r'\b(ES\s*-?\s*[A-Z0-9]{8,10})\b'
        ]
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                clean = re.sub(r'[\s\.-]', '', match.group(1)).upper()
                if len(clean) >= 8:
                    return clean
        return ""

    def split_side_by_side_names(self, line: str) -> Optional[Dict[str, str]]:
        clean = line.strip()
        if not clean:
            return None

        multi_space_parts = [p.strip() for p in re.split(r'\s{2,}|\t', clean) if p.strip()]
        if len(multi_space_parts) >= 2:
            if len(multi_space_parts[0]) > 2 and len(multi_space_parts[1]) > 2:
                return {"seller": multi_space_parts[0], "buyer": multi_space_parts[-1]}

        regex_two_names = r'^([A-Z\s]{4,30})\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{4,40})$'
        match = re.match(regex_two_names, clean)
        if match and ' ' in match.group(1).strip() and ' ' in match.group(2).strip():
            return {"seller": match.group(1).strip(), "buyer": match.group(2).strip()}

        return None

    def extract_parties_nif_anchored(self) -> Dict[str, str]:
        """NIF-anchored spatial neighborhood party extraction to accurately isolate Seller vs Buyer."""
        seller_name, seller_nif, seller_addr = "", "", ""
        buyer_name, buyer_nif, buyer_addr = "", "", ""

        buyer_marker_idx = 9999
        for idx, line in enumerate(self.lines):
            if re.search(r'(?:FACTURADO\s*A|DATOS\s*DEL\s*CLIENTE|CLIENT\s*IDENTITY|CLIENTE|COMPRADOR|BILL\s*TO|INVOICE\s*TO|CLIENT|RECEPTOR)', line, re.IGNORECASE):
                buyer_marker_idx = idx
                break

        nif_entries = self.extract_nifs_with_line_indices()

        # Parse each NIF neighborhood
        for entry in nif_entries:
            nif_val = entry["nif"]
            l_idx = entry["line_idx"]

            start_i = max(0, l_idx - 4)
            end_i = min(len(self.lines), l_idx + 5)
            neighborhood = self.lines[start_i:end_i]

            party_name, party_addr = "", ""
            for line in neighborhood:
                clean_l = re.sub(r'^(EMISOR|PROVEEDOR|VENDEDOR|SUPPLIER|DE:|FROM:|FACTURADO\s*A|DATOS\s*DEL\s*CLIENTE|CLIENTE|COMPRADOR|BILL\s*TO|Nombre|Name)\s*:?\s*', '', line, flags=re.IGNORECASE).strip()
                clean_l = re.sub(r'^[\/\:\-\s]+', '', clean_l).strip()

                if self.is_blacklisted_line(clean_l) or self.extract_nif(clean_l):
                    continue
                if self.is_address_line(clean_l):
                    if not party_addr:
                        party_addr = clean_l
                    continue

                if len(clean_l) > 2 and not party_name and not re.match(r'^(NIF|CIF|NIE|VAT|ID|Tel|Email|Tax|Factura|Fecha|Invoice|CR:)', clean_l, re.IGNORECASE):
                    side_by_side = self.split_side_by_side_names(clean_l)
                    if side_by_side:
                        party_name = side_by_side["buyer"] if l_idx >= buyer_marker_idx else side_by_side["seller"]
                    else:
                        party_name = clean_l

            if l_idx >= buyer_marker_idx:
                if not buyer_name:
                    buyer_name, buyer_nif, buyer_addr = party_name, nif_val, party_addr
            else:
                if not seller_name:
                    seller_name, seller_nif, seller_addr = party_name, nif_val, party_addr

        if not seller_name or not buyer_name:
            fallback = self.fallback_party_extraction(buyer_marker_idx)
            if not seller_name: seller_name = fallback["sellerName"]
            if not seller_nif: seller_nif = fallback["sellerNif"]
            if not seller_addr: seller_addr = fallback["sellerAddress"]
            
            if not buyer_name: buyer_name = fallback["buyerName"]
            if not buyer_nif: buyer_nif = fallback["buyerNif"]
            if not buyer_addr: buyer_addr = fallback["buyerAddress"]

        return {
            "sellerName": seller_name,
            "sellerNif": seller_nif,
            "sellerAddress": seller_addr,
            "buyerName": buyer_name,
            "buyerNif": buyer_nif,
            "buyerAddress": buyer_addr
        }

    def fallback_party_extraction(self, buyer_marker_idx: int) -> Dict[str, str]:
        seller_lines = self.lines[:buyer_marker_idx] if buyer_marker_idx < len(self.lines) else self.lines[:6]
        buyer_lines = self.lines[buyer_marker_idx:] if buyer_marker_idx < len(self.lines) else self.lines[6:]

        def get_party(lines_list: List[str], is_buyer_flag: bool = False) -> Dict[str, str]:
            n = ""
            a = ""
            nf = self.extract_nif("\n".join(lines_list))
            for l in lines_list:
                clean = re.sub(r'^(EMISOR|PROVEEDOR|VENDEDOR|SUPPLIER|DE:|FROM:|FACTURADO\s*A|DATOS\s*DEL\s*CLIENTE|CLIENTE|COMPRADOR|BILL\s*TO|Nombre|Name)\s*:?\s*', '', l, flags=re.IGNORECASE).strip()
                clean = re.sub(r'^[\/\:\-\s]+', '', clean).strip()

                if self.is_blacklisted_line(clean) or self.is_blacklisted_line(l) or self.extract_nif(clean):
                    continue
                if self.is_address_line(clean):
                    if not a: a = clean
                    continue
                if len(clean) > 2 and not n and not re.match(r'^(NIF|CIF|NIE|VAT|ID|Tel|Email|Tax|Factura|Fecha|Invoice|CR:)', clean, re.IGNORECASE):
                    side_by_side = self.split_side_by_side_names(clean)
                    if side_by_side:
                        n = side_by_side["buyer"] if is_buyer_flag else side_by_side["seller"]
                    else:
                        n = clean
            return {"name": n, "nif": nf, "address": a}

        s_info = get_party(seller_lines, False)
        b_info = get_party(buyer_lines, True)

        return {
            "sellerName": s_info["name"], "sellerNif": s_info["nif"], "sellerAddress": s_info["address"],
            "buyerName": b_info["name"], "buyerNif": b_info["nif"], "buyerAddress": b_info["address"]
        }

    def extract_financials(self) -> Dict[str, Any]:
        subtotal, tax_amount, tax_rate, irpf_amount, total = 0.0, 0.0, 0.0, 0.0, 0.0
        currency = "EUR"

        if "$" in self.text or "USD" in self.text:
            currency = "USD"
        elif "£" in self.text or "GBP" in self.text:
            currency = "GBP"

        sub_match = re.search(r'(?:Subtotal|Base\s*Imponible|Importe\s*Neto|Net\s*Amount)\s*[€$£]?\s*([0-9.,]+)', self.text, re.IGNORECASE)
        if sub_match:
            subtotal = self.parse_money(sub_match.group(1))

        tot_match = re.search(r'(?:Total\s*Factura|Total\s*Due|Importe\s*Total|TOTAL|Total\s*€|Total)\s*[€$£]?\s*([0-9.,]+)', self.text, re.IGNORECASE)
        if tot_match:
            total = self.parse_money(tot_match.group(1))

        tax_match = re.search(r'(?:IVA|VAT|Tax)\s*(?:\((\d+(?:\.\d+)?)%\))?\s*[€$£]?\s*([0-9.,]+)', self.text, re.IGNORECASE)
        if tax_match:
            if tax_match.group(1):
                tax_rate = float(tax_match.group(1))
            tax_amount = self.parse_money(tax_match.group(2))

        if tax_rate == 0:
            rate_match = re.search(r'\b(21|10|4)%\b', self.text)
            if rate_match:
                tax_rate = float(rate_match.group(1))

        irpf_match = re.search(r'(?:IRPF|Retención)\s*(?:\(\s*-?(\d+(?:\.\d+)?)%\s*\))?\s*[€$£]?\s*([0-9.,]+)', self.text, re.IGNORECASE)
        if irpf_match:
            irpf_amount = self.parse_money(irpf_match.group(2))

        if subtotal > 0 and tax_amount > 0 and total == 0:
            total = subtotal + tax_amount - irpf_amount
        elif total > 0 and subtotal == 0 and tax_amount > 0:
            subtotal = total - tax_amount + irpf_amount
        elif total > 0 and subtotal == 0 and tax_rate > 0:
            subtotal = total / (1 + tax_rate / 100)
            tax_amount = total - subtotal

        return {
            "subtotal": round(subtotal, 2),
            "taxRate": round(tax_rate, 2),
            "taxAmount": round(tax_amount, 2),
            "irpfAmount": round(irpf_amount, 2),
            "total": round(total, 2),
            "currency": currency
        }

    def extract_items(self) -> List[InvoiceItem]:
        items = []
        line_regex = re.compile(r'^\s*(\d+)\s+([A-Za-z0-9_\-\s]{2,40})\s+([A-Za-z0-9_\-\s]{2,40})?\s*.*?[€$£]?\s*([0-9.,]+)$', re.MULTILINE)
        matches = line_regex.findall(self.text)
        
        idx = 1
        for match in matches:
            amt = self.parse_money(match[3])
            if amt > 0:
                desc = f"{match[1].strip()}" + (f" - {match[2].strip()}" if match[2] else "")
                items.append(InvoiceItem(
                    itemNumber=idx,
                    description=desc,
                    quantity=1.0,
                    unitPrice=amt,
                    amount=amt
                ))
                idx += 1
        return items

    def parse_money(self, val_str: str) -> float:
        if not val_str:
            return 0.0
        clean = re.sub(r'[€$£\s]', '', val_str)
        if ',' in clean and '.' in clean:
            if clean.find(',') < clean.find('.'):
                clean = clean.replace(',', '')
            else:
                clean = clean.replace('.', '').replace(',', '.')
        elif ',' in clean:
            clean = clean.replace(',', '.')
        try:
            return float(clean)
        except ValueError:
            return 0.0


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5000)
