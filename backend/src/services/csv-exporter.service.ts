import { parse as parseCsv } from 'json2csv';
import { IExtractedInvoice } from '../models/invoice-job.model.js';

export class CsvExporterService {
  /**
   * Convert list of extracted invoice items to accounting CSV format (Holded, Anfix, or Standard)
   */
  public exportToCsv(invoices: IExtractedInvoice[], format: 'STANDARD' | 'HOLDED' | 'ANFIX' = 'STANDARD'): string {
    if (format === 'HOLDED') {
      const holdedMapped = invoices.map(inv => ({
        'Num Factura': inv.invoiceNumber,
        'Fecha': inv.invoiceDate,
        'Vendedor (Proveedor)': inv.sellerName,
        'NIF Vendedor': inv.sellerNif,
        'Comprador (Cliente)': inv.buyerName,
        'NIF Comprador': inv.buyerNif,
        'Subtotal': inv.subtotal,
        '% IVA': inv.taxRate,
        'Total IVA': inv.taxAmount,
        'Total': inv.total,
        'Moneda': inv.currency
      }));
      return parseCsv(holdedMapped);
    }

    if (format === 'ANFIX') {
      const anfixMapped = invoices.map(inv => ({
        'N_FACTURA': inv.invoiceNumber,
        'FECHA_EXPEDICION': inv.invoiceDate,
        'RAZON_SOCIAL_EMISOR': inv.sellerName,
        'CIF_EMISOR': inv.sellerNif,
        'RAZON_SOCIAL_RECEPTOR': inv.buyerName,
        'CIF_RECEPTOR': inv.buyerNif,
        'BASE_IMPONIBLE': inv.subtotal,
        'TIPO_IVA': inv.taxRate,
        'CUOTA_IVA': inv.taxAmount,
        'TOTAL_FACTURA': inv.total,
        'MONEDA': inv.currency
      }));
      return parseCsv(anfixMapped);
    }

    // Standard Default CSV Preset (Flat structure including Seller, Buyer & Financials)
    const standardMapped = invoices.map(inv => ({
      'Invoice Number': inv.invoiceNumber,
      'Invoice Date': inv.invoiceDate,
      'Seller Name': inv.sellerName,
      'Seller Tax ID': inv.sellerNif,
      'Buyer Name': inv.buyerName,
      'Buyer Tax ID': inv.buyerNif,
      'Items Count': inv.items ? inv.items.length : 0,
      'Subtotal': inv.subtotal,
      'Tax Rate (%)': inv.taxRate,
      'Tax Amount': inv.taxAmount,
      'Total Amount': inv.total,
      'Currency': inv.currency
    }));
    return parseCsv(standardMapped);
  }
}
