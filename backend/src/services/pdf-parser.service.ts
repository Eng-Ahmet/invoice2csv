import pdfParse from 'pdf-parse';
import { IExtractedInvoice, IInvoiceItem } from '../models/invoice-job.model.js';

export class PdfParserService {
  /**
   * Universal PDF invoice parsing engine.
   * STRICT RULE: Zero hardcoded fallback values. Only extracts real PDF text data.
   */
  public async extractInvoiceData(pdfBuffer: Buffer): Promise<IExtractedInvoice> {
    // 1. Try Python Vision & Tesseract/CUDA Service if active
    const pythonVisionExtracted = await this.extractWithPythonVision(pdfBuffer);
    if (pythonVisionExtracted) {
      return pythonVisionExtracted;
    }

    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    // 2. Try local Ollama LLM extraction if available locally
    const ollamaExtracted = await this.extractWithOllama(text);
    if (ollamaExtracted) {
      return ollamaExtracted;
    }

    // 2. Comprehensive Contextual Rule Engine
    const invoiceNumber = this.extractInvoiceNumber(text);
    const invoiceDate = this.extractDate(text);
    const { sellerName, sellerNif, sellerAddress } = this.extractSellerInfo(text);
    const { buyerName, buyerNif, buyerAddress } = this.extractBuyerInfo(text);
    const items = this.extractLineItems(text);
    const financials = this.extractFinancials(text);

    return {
      invoiceNumber: invoiceNumber,
      invoiceDate: invoiceDate,
      sellerName: sellerName,
      sellerNif: sellerNif,
      sellerAddress: sellerAddress,
      buyerName: buyerName,
      buyerNif: buyerNif,
      buyerAddress: buyerAddress,
      items: items,
      subtotal: financials.subtotal,
      taxRate: financials.taxRate,
      taxAmount: financials.taxAmount,
      irpfAmount: financials.irpfAmount,
      total: financials.total,
      currency: financials.currency
    };
  }

  /**
   * Forward PDF buffer to Python Computer Vision & OCR FastAPI service
   */
  private async extractWithPythonVision(pdfBuffer: Buffer): Promise<IExtractedInvoice | null> {
    try {
      const pythonServiceUrl = process.env.PYTHON_VISION_URL || 'http://localhost:5840/extract-vision';
      const formData = new Blob([pdfBuffer], { type: 'application/pdf' });
      const body = new FormData();
      body.append('file', formData, 'invoice.pdf');

      const res = await fetch(pythonServiceUrl, {
        method: 'POST',
        body: body
      });

      if (!res.ok) return null;
      const data = await res.json();
      if (data && (data.invoiceNumber || data.total || data.sellerName)) {
        return data as IExtractedInvoice;
      }
    } catch (e) {
      // Python Vision Service offline - fallback gracefully
    }
    return null;
  }

  /**
   * Zero-fallback Ollama local LLM vision/text prompt
   */
  private async extractWithOllama(text: string): Promise<IExtractedInvoice | null> {
    try {
      const prompt = `You are a professional invoice data extraction system. Parse this invoice text and return JSON matching this EXACT structure.
Do NOT invent fake data. Return empty string "" or 0 if a field is not present in the document.

JSON Schema:
{
  "invoiceNumber": "string",
  "invoiceDate": "YYYY-MM-DD",
  "sellerName": "string",
  "sellerNif": "string",
  "sellerAddress": "string",
  "buyerName": "string",
  "buyerNif": "string",
  "buyerAddress": "string",
  "items": [
    {
      "itemNumber": 1,
      "description": "string",
      "quantity": 1,
      "unitPrice": 0,
      "amount": 0
    }
  ],
  "subtotal": 0,
  "taxRate": 0,
  "taxAmount": 0,
  "irpfAmount": 0,
  "total": 0,
  "currency": "EUR/USD"
}

Invoice Raw Text:
${text.substring(0, 4000)}`;

      const res = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3',
          prompt: prompt,
          stream: false,
          format: 'json'
        })
      });

      if (!res.ok) return null;
      const resJson = await res.json();
      const parsed = JSON.parse(resJson.response);

      if (parsed && (parsed.invoiceNumber || parsed.total || parsed.sellerName)) {
        return {
          invoiceNumber: parsed.invoiceNumber || '',
          invoiceDate: parsed.invoiceDate || '',
          sellerName: parsed.sellerName || '',
          sellerNif: parsed.sellerNif || '',
          sellerAddress: parsed.sellerAddress || '',
          buyerName: parsed.buyerName || '',
          buyerNif: parsed.buyerNif || '',
          buyerAddress: parsed.buyerAddress || '',
          items: Array.isArray(parsed.items) ? parsed.items : [],
          subtotal: Number(parsed.subtotal) || 0,
          taxRate: Number(parsed.taxRate) || 0,
          taxAmount: Number(parsed.taxAmount) || 0,
          irpfAmount: Number(parsed.irpfAmount) || 0,
          total: Number(parsed.total) || 0,
          currency: parsed.currency || ''
        };
      }
    } catch (e) {
      // Ollama not responding or model not loaded
    }
    return null;
  }

  // --- CONTEXTUAL EXTRACTORS (NO HARDCODED FALLBACKS) ---

  private extractInvoiceNumber(text: string): string {
    const patterns = [
      /(?:Invoice\s*No|Invoice\s*#|Factura\s*Nº|Nº\s*Factura|Num\s*Factura)\s*:?\s*([A-Z0-9\-/]+)/i,
      /(?:Invoice|Factura)\s*:?\s*([A-Z0-9\-/]+)/i
    ];
    for (const p of patterns) {
      const match = text.match(p);
      if (match) return match[1].trim();
    }
    return '';
  }

  private extractDate(text: string): string {
    const patterns = [
      /(?:Issue\s*Date|Fecha\s*de\s*expedición|Fecha\s*Factura|Fecha)\s*:?\s*(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})/i,
      /\b(\d{4}[\/\.-]\d{2}[\/\.-]\d{2})\b/,
      /\b(\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{4})\b/
    ];
    for (const p of patterns) {
      const match = text.match(p);
      if (match) {
        return this.formatDateIso(match[1]);
      }
    }
    return '';
  }

  private extractSellerInfo(text: string): { sellerName: string; sellerNif: string; sellerAddress: string } {
    let name = '';
    let nif = '';
    let address = '';

    // Match Supplier / Seller block
    const supplierBlock = text.match(/(?:SUPPLIER|PROVEEDOR|VENDEDOR|EMISOR)([\s\S]*?)(?:BILL\s*TO|CLIENT|CLIENTE|COMPRADOR|#|\n\n\n)/i);
    const blockText = supplierBlock ? supplierBlock[1] : text;

    // Extract Tax ID / NIF / CIF
    const nifMatch = blockText.match(/(?:ID\s*\/\s*Tax\s*No|Tax\s*Number|NIF|CIF|NIE|VAT\s*ID)\s*:?\s*([A-Z0-9]{8,11})/i);
    if (nifMatch) {
      nif = nifMatch[1].toUpperCase();
    }

    // Extract Name
    const lines = blockText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length > 0) {
      name = lines[0].replace(/^(SUPPLIER|PROVEEDOR|VENDEDOR|EMISOR)\s*:?/i, '').trim();
    }

    // Extract Address if present
    const addrMatch = blockText.match(/(?:Calle|C\/|Avda|Avenue|Carretera|Street|Address)\s*[^,\n]+,[^\n]+/i);
    if (addrMatch) {
      address = addrMatch[0].trim();
    }

    return { sellerName: name, sellerNif: nif, sellerAddress: address };
  }

  private extractBuyerInfo(text: string): { buyerName: string; buyerNif: string; buyerAddress: string } {
    let name = '';
    let nif = '';
    let address = '';

    // Match Buyer / Client block
    const buyerBlock = text.match(/(?:BILL\s*TO|CLIENT|CLIENTE|COMPRADOR|RECEPTOR)([\s\S]*?)(?:#|Project|Description|Subtotal|\n\n\n)/i);
    if (buyerBlock) {
      const blockText = buyerBlock[1];
      const lines = blockText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      
      if (lines.length > 0) {
        name = lines[0].replace(/^(BILL\s*TO|CLIENT|CLIENTE|COMPRADOR)\s*:?/i, '').trim();
      }

      const nifMatch = blockText.match(/(?:ID\s*\/\s*Tax\s*No|ID|Tax\s*No|NIF|CIF|NIE|DNI)\s*:?\s*([A-Z0-9]{8,11})/i);
      if (nifMatch) {
        nif = nifMatch[1].toUpperCase();
      }

      const addrMatch = blockText.match(/(?:Calle|C\/|Avda|Avenue|Carretera|Street|Road)\s*[^,\n]+,[^\n]+/i);
      if (addrMatch) {
        address = addrMatch[0].trim();
      }
    }

    return { buyerName: name, buyerNif: nif, buyerAddress: address };
  }

  private extractLineItems(text: string): IInvoiceItem[] {
    const items: IInvoiceItem[] = [];
    
    // Look for tabular line items
    // Example: 1  MOODIF  secunda pago  0% Milestone  €1,650.00  2026-08-18  Paid
    const lineRegex = /^\s*(\d+)\s+([A-Za-z0-9_\-\s]{2,20})\s+([A-Za-z0-9_\-\s]{2,40})\s+.*?[€$]?\s*([0-9.,]+)/gm;
    let match;
    let index = 1;

    while ((match = lineRegex.exec(text)) !== null) {
      const amt = this.parseMoney(match[4]);
      if (amt > 0) {
        items.push({
          itemNumber: index++,
          description: `${match[2].trim()} - ${match[3].trim()}`,
          quantity: 1,
          unitPrice: amt,
          amount: amt
        });
      }
    }

    return items;
  }

  private extractFinancials(text: string): { subtotal: number; taxRate: number; taxAmount: number; irpfAmount: number; total: number; currency: string } {
    let subtotal = 0;
    let taxAmount = 0;
    let taxRate = 0;
    let irpfAmount = 0;
    let total = 0;
    let currency = '';

    // Currency Detection
    if (text.includes('€') || /EUR/i.test(text)) currency = 'EUR';
    else if (text.includes('$') || /USD/i.test(text)) currency = 'USD';
    else if (text.includes('£') || /GBP/i.test(text)) currency = 'GBP';

    // Subtotal
    const subMatch = text.match(/(?:Subtotal|Base\s*Imponible)\s*[€$£]?\s*([0-9.,]+)/i);
    if (subMatch) subtotal = this.parseMoney(subMatch[1]);

    // Total / Total Due
    const totalMatch = text.match(/(?:Total\s*Due|Total\s*Factura|Total|Importe\s*Total)\s*[€$£]?\s*([0-9.,]+)/i);
    if (totalMatch) total = this.parseMoney(totalMatch[1]);

    // VAT / IVA / Tax
    const vatMatch = text.match(/(?:VAT|IVA|Tax)\s*\((?:(\d+(?:\.\d+)?)%)\)?\s*[€$£]?\s*([0-9.,]+)/i);
    if (vatMatch) {
      if (vatMatch[1]) taxRate = parseFloat(vatMatch[1]);
      taxAmount = this.parseMoney(vatMatch[2]);
    }

    // Mathematical consistency check if some values were missing in raw text
    if (subtotal > 0 && taxAmount > 0 && total === 0) {
      total = subtotal + taxAmount;
    } else if (total > 0 && subtotal === 0 && taxAmount > 0) {
      subtotal = total - taxAmount;
    } else if (total > 0 && subtotal === 0 && taxRate > 0) {
      subtotal = total / (1 + taxRate / 100);
      taxAmount = total - subtotal;
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxRate: taxRate,
      taxAmount: Math.round(taxAmount * 100) / 100,
      irpfAmount: irpfAmount,
      total: Math.round(total * 100) / 100,
      currency: currency
    };
  }

  private parseMoney(str: string): number {
    if (!str) return 0;
    let clean = str.replace(/[€$£]/g, '').trim();
    if (clean.includes(',') && clean.includes('.')) {
      if (clean.indexOf(',') < clean.indexOf('.')) {
        clean = clean.replace(/,/g, '');
      } else {
        clean = clean.replace(/\./g, '').replace(',', '.');
      }
    } else if (clean.includes(',')) {
      clean = clean.replace(',', '.');
    }
    return parseFloat(clean) || 0;
  }

  private formatDateIso(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split(/[\/\.-]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  }
}
