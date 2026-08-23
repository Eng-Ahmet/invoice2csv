import pdfParse from 'pdf-parse';
import { IExtractedInvoice, IInvoiceItem } from '../models/invoice-job.model.js';

export class PdfParserService {
  /**
   * Universal PDF invoice parsing engine.
   * STRICT RULE: Zero hardcoded fallback values. Only extracts real PDF text data.
   */
  public async extractInvoiceData(pdfBuffer: Buffer): Promise<IExtractedInvoice> {
    const data = await pdfParse(pdfBuffer);
    const text = data.text;

    // 1. Comprehensive Contextual Rule Engine Extraction
    const invoiceNumber = this.extractInvoiceNumber(text);
    const invoiceDate = this.extractDate(text);
    const { sellerName, sellerNif, sellerAddress } = this.extractSellerInfo(text);
    const { buyerName, buyerNif, buyerAddress } = this.extractBuyerInfo(text);
    const items = this.extractLineItems(text);
    const financials = this.extractFinancials(text);

    const nativeExtracted: IExtractedInvoice = {
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

    // If native text parsing got clear seller and buyer names, return immediately
    if (nativeExtracted.sellerName && nativeExtracted.buyerName && nativeExtracted.sellerName !== nativeExtracted.buyerName) {
      return nativeExtracted;
    }

    // 2. Try Python PyTorch & Vision Service as fallback if needed
    const pythonVisionExtracted = await this.extractWithPythonVision(pdfBuffer);
    if (pythonVisionExtracted && pythonVisionExtracted.sellerName && pythonVisionExtracted.buyerName && pythonVisionExtracted.sellerName !== pythonVisionExtracted.buyerName) {
      return pythonVisionExtracted;
    }

    return nativeExtracted;
  }

  /**
   * Forward PDF buffer to Python Computer Vision & OCR FastAPI service
   */
  private async extractWithPythonVision(pdfBuffer: Buffer): Promise<IExtractedInvoice | null> {
    try {
      const pythonServiceUrl = process.env.PYTHON_VISION_URL || 'http://localhost:5840/extract-vision';
      const formData = new Blob([pdfBuffer as unknown as BlobPart], { type: 'application/pdf' });
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

  private extractNif(blockText: string): string {
    const patterns = [
      /(?:NIF\s*\/\s*CIF|NIF|CIF|NIE|VAT|Tax\s*ID|DNI|C\.I\.F\.|N\.I\.F\.)\s*:?\s*([A-Z0-9\-\.]{8,12})/i,
      /\b([ABCDEFGHJNPQRSUVW]\s*-?\s*\d{7,8}\s*[0-9A-J])\b/i,
      /\b(\d{8}\s*-?\s*[A-Z])\b/i,
      /\b([XYZ]\s*-?\s*\d{7}\s*[A-Z])\b/i,
      /\b(ES\s*-?\s*[A-Z0-9]{8,10})\b/i
    ];
    for (const p of patterns) {
      const match = blockText.match(p);
      if (match) {
        const clean = match[1].replace(/[\s\.-]/g, '').toUpperCase();
        if (clean.length >= 8) return clean;
      }
    }
    return '';
  }

  private isHeaderOrLabelLine(line: string): boolean {
    const clean = line.trim();
    if (!clean) return true;

    // Document titles & headers
    if (/^(?:Official\s*invoice\s*document|Official\s*invoice|Tax\s*Invoice|Commercial\s*Invoice|Invoice\s*Document|Factura\s*Proforma|Factura|Receipt|Recibo)$/i.test(clean)) return true;

    // Metadata / Date / Invoice No / Verification / Registry lines
    if (/^(?:Invoice\s*No|Issue\s*Date|Generated|Tax\s*Number|Verification\s*Code|Ref|Fecha|CR:)\b/i.test(clean)) return true;
    if (/^[A-Z0-9]{10,}(?:-[A-Z0-9]+)+$/i.test(clean)) return true;

    // Party block headers & combined headers (e.g. 'BILL TO / CLIENT IDENTITY KYC')
    const headerWords = [
      'SUPPLIER', 'VENDEDOR', 'EMISOR', 'PROVEEDOR', 'DE:', 'FROM:',
      'FACTURADO A', 'DATOS DEL CLIENTE', 'DATOS DEL VENDEDOR', 'DATOS DEL EMISOR',
      'CLIENT IDENTITY KYC', 'CLIENT IDENTITY', 'IDENTITY KYC', 'COMPRADOR',
      'CLIENTE', 'BILL TO', 'INVOICE TO', 'SHIP TO', 'ENVIADO A', 'RECEPTOR',
      'CLIENT', 'COMPANY / AUTÓNOMO', 'AUTÓNOMO', 'COMPANY', 'CUSTOMER', 'NAME', 'NOMBRE'
    ];

    const normalized = clean.replace(/[\/\:\-\s]+/g, ' ').trim().toUpperCase();
    let temp = normalized;
    for (const hw of headerWords) {
      temp = temp.replace(hw, '').trim();
    }
    if (temp.length === 0) return true;

    return false;
  }

  private isBlacklistedLine(line: string): boolean {
    if (this.isHeaderOrLabelLine(line)) return true;
    const blacklists = [
      /about:srcdoc/i, /about:blank/i, /http/i, /https/i, /www\./i,
      /HW\s*AI/i
    ];
    return blacklists.some(b => b.test(line));
  }

  private splitSideBySideNames(line: string): { seller: string; buyer: string } | null {
    const clean = line.trim();
    if (!clean) return null;

    const multiSpaceParts = clean.split(/\s{2,}|\t/).map(p => p.trim()).filter(p => p.length > 0);
    if (multiSpaceParts.length >= 2) {
      if (multiSpaceParts[0].length > 2 && multiSpaceParts[1].length > 2) {
        return { seller: multiSpaceParts[0], buyer: multiSpaceParts[multiSpaceParts.length - 1] };
      }
    }

    const regexTwoNames = /^([A-Z\s]{4,30})\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\s]{4,40})$/;
    const match = clean.match(regexTwoNames);
    if (match && match[1].trim().includes(' ') && match[2].trim().includes(' ')) {
      return { seller: match[1].trim(), buyer: match[2].trim() };
    }

    return null;
  }

  private parseSinglePartyBlock(blockText: string, isBuyer: boolean = false): { name: string; nif: string; address: string } {
    let name = '';
    let address = '';

    const nif = this.extractNif(blockText);
    const lines = blockText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const validLines: string[] = [];

    for (const line of lines) {
      const cleanL = line.replace(/^[\/\:\-\s]+/, '').trim();
      if (!this.isBlacklistedLine(cleanL) && cleanL.length > 0) {
        validLines.push(cleanL);
      }
    }

    for (let i = 0; i < validLines.length; i++) {
      const line = validLines[i];
      let cleaned = line.replace(/^(EMISOR|PROVEEDOR|VENDEDOR|SUPPLIER|DE:|FROM:|FACTURADO\s*A|DATOS\s*DEL\s*CLIENTE|CLIENTE|COMPRADOR|BILL\s*TO|Nombre|Name)\s*:?\s*/i, '').trim();
      cleaned = cleaned.replace(/^[\/\:\-\s]+/, '').trim();

      const lineNif = this.extractNif(cleaned);
      if (lineNif && lineNif === nif && cleaned.length < 20) continue;

      if (this.isAddressLine(cleaned)) {
        if (!address) {
          address = cleaned;
          if (i + 1 < validLines.length) {
            const nextL = validLines[i + 1];
            if (/^(?:Spain|España|Cádiz|Cadiz|Malaga|Málaga|Madrid|Barcelona|UK|USA|France|Germany|[A-Z][a-z]+|\([A-Za-záéíóúÁÉÍÓÚñÑ\s]+\))$/i.test(nextL) && !this.isAddressLine(nextL) && !this.extractNif(nextL)) {
              address += `, ${nextL}`;
            }
          }
        }
        continue;
      }

      if (cleaned.length > 2 && !name && !/^(NIF|CIF|NIE|VAT|ID|Tel|Email|Tax|Factura|Fecha|Invoice|CR:)/i.test(cleaned)) {
        const sideBySide = this.splitSideBySideNames(cleaned);
        if (sideBySide) {
          name = isBuyer ? sideBySide.buyer : sideBySide.seller;
        } else {
          name = cleaned;
        }
      }
    }

    if (!address) {
      for (const line of validLines) {
        if (line !== name && !this.extractNif(line) && this.isAddressLine(line)) {
          address = line;
          break;
        }
      }
    }

    return { name, nif, address: address.replace(/,\s*,/g, ',').trim() };
  }

  private splitSideBySidePartyBlocks(text: string): { sellerText: string; buyerText: string } {
    const lines = text.split('\n');
    const sellerLines: string[] = [];
    const buyerLines: string[] = [];

    let inSideBySideSection = false;

    for (const line of lines) {
      const parts = line.split(/\s{2,}|\t/).map(p => p.trim()).filter(p => p.length > 0);
      if (parts.length >= 2) {
        const leftIsSeller = /(?:SUPPLIER|EMISOR|VENDEDOR|PROVEEDOR|DE:|FROM:)/i.test(parts[0]);
        const rightIsBuyer = /(?:FACTURADO\s*A|DATOS\s*DEL\s*CLIENTE|CLIENT\s*IDENTITY|CLIENTE|COMPRADOR|BILL\s*TO|INVOICE\s*TO|CLIENT|RECEPTOR)/i.test(parts[1]);

        if (leftIsSeller || rightIsBuyer || inSideBySideSection) {
          inSideBySideSection = true;
          sellerLines.push(parts[0]);
          buyerLines.push(parts[1] || parts[parts.length - 1]);
          continue;
        }
      } else {
        if (inSideBySideSection && (line.trim().length === 0 || /^(?:#|Project|Item|Description|Subtotal|Total|Payment|Terms)/i.test(line.trim()))) {
          inSideBySideSection = false;
        }
      }

      if (!inSideBySideSection) {
        sellerLines.push(line);
      }
    }

    if (buyerLines.length === 0) {
      const buyerMarker = text.match(/(?:FACTURADO\s*A|DATOS\s*DEL\s*CLIENTE|CLIENT\s*IDENTITY\s*KYC|CLIENT\s*IDENTITY|CLIENTE|COMPRADOR|BILL\s*TO|INVOICE\s*TO|CLIENT|RECEPTOR)/i);
      const sellerText = buyerMarker && buyerMarker.index !== undefined ? text.substring(0, buyerMarker.index) : text.split('\n').slice(0, 7).join('\n');
      const buyerText = buyerMarker && buyerMarker.index !== undefined ? text.substring(buyerMarker.index) : text.split('\n').slice(7).join('\n');
      return { sellerText, buyerText };
    }

    return {
      sellerText: sellerLines.join('\n'),
      buyerText: buyerLines.join('\n')
    };
  }

  private extractSellerInfo(text: string): { sellerName: string; sellerNif: string; sellerAddress: string } {
    const { sellerText } = this.splitSideBySidePartyBlocks(text);
    const parsed = this.parseSinglePartyBlock(sellerText, false);
    return { sellerName: parsed.name, sellerNif: parsed.nif, sellerAddress: parsed.address };
  }

  private isAddressLine(line: string): boolean {
    return /(?:Calle|C\/|C\.|Avda|Av\.|Avenue|Carretera|Ctra|Street|St\.|Address|Plaza|Pl\.|Pº|Paseo|Road|Rd\.|Via|Rua|Piso|Puerta|Bloque|Esc\.|Escalera|Conil|Málaga|Malaga|Madrid|Barcelona|Sevilla|Valencia|\b\d{5}\b)/i.test(line);
  }

  private extractBuyerInfo(text: string): { buyerName: string; buyerNif: string; buyerAddress: string } {
    const { buyerText } = this.splitSideBySidePartyBlocks(text);
    const parsed = this.parseSinglePartyBlock(buyerText, true);

    return { buyerName: parsed.name, buyerNif: parsed.nif, buyerAddress: parsed.address };
  }

  private formatItemDescription(rawDesc: string): string {
    if (!rawDesc) return '';
    let str = rawDesc.trim();

    // 1. Separate leading item digits: '1MOODIF' -> '1 MOODIF'
    str = str.replace(/^(\d+)([A-Za-z])/, '$1 $2');

    // 2. Separate UPPERCASE block followed by lowercase word: 'MOODIFsecunda' -> 'MOODIF secunda'
    str = str.replace(/([A-Z])([a-z])/g, '$1 $2');

    // 3. Separate lowercase word followed by UPPERCASE word: 'pagoMILESTONE' -> 'pago MILESTONE'
    str = str.replace(/([a-z])([A-Z])/g, '$1 $2');

    // 4. Separate letter followed by digit: 'pago0' -> 'pago 0'
    str = str.replace(/([A-Za-z])(\d)/g, '$1 $2');

    // 5. Separate digit/percentage followed by letter: '0%Milestone' -> '0% Milestone'
    str = str.replace(/([%0-9])([A-Za-z])/g, '$1 $2');

    return str.replace(/\s{2,}/g, ' ').trim();
  }

  private extractLineItems(text: string): IInvoiceItem[] {
    const items: IInvoiceItem[] = [];
    
    // Look for tabular line items (spaced or unspaced from PDF extraction)
    const lineRegex = /(?:^|\n)\s*(\d+)\s*([A-Za-z0-9_\-\s%]{2,60}?)\s*[€$£]?\s*([0-9]{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))/gm;
    let match;
    let index = 1;

    while ((match = lineRegex.exec(text)) !== null) {
      const amt = this.parseMoney(match[3]);
      if (amt > 0) {
        items.push({
          itemNumber: index++,
          description: this.formatItemDescription(match[2]),
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

    // Total / Total Due (Word boundary to prevent matching 'Subtotal')
    const totalMatch = text.match(/\b(?:Total\s*Due|Total\s*Factura|Total|Importe\s*Total)\s*[€$£]?\s*([0-9.,]+)/i);
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
