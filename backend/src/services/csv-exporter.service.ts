import { parse as parseCsv } from 'json2csv';
import { IExtractedInvoice } from '../models/invoice-job.model.js';

export class CsvExporterService {
  /**
   * Convert list of extracted invoice items to accounting CSV format (Holded, Anfix, or Standard)
   * Supports itemized (1 row per line item) or summary (1 row per invoice) export formats.
   */
  public exportToCsv(
    invoices: IExtractedInvoice[],
    format: 'STANDARD' | 'HOLDED' | 'ANFIX' = 'STANDARD',
    itemized: boolean = true
  ): string {
    if (format === 'HOLDED') {
      const rows: any[] = [];
      for (const inv of invoices) {
        if (itemized && inv.items && inv.items.length > 0) {
          for (const item of inv.items) {
            rows.push({
              'Num Factura': inv.invoiceNumber,
              'Fecha': inv.invoiceDate,
              'Vendedor (Proveedor)': inv.sellerName,
              'NIF Vendedor': inv.sellerNif,
              'Dirección Vendedor': inv.sellerAddress,
              'Comprador (Cliente)': inv.buyerName,
              'NIF Comprador': inv.buyerNif,
              'Dirección Comprador': inv.buyerAddress,
              'Línea Nº': item.itemNumber,
              'Concepto / Artículo': item.description,
              'Cantidad': item.quantity,
              'Precio Unitario': item.unitPrice,
              'Importe Línea': item.amount,
              'Subtotal Factura': inv.subtotal,
              '% IVA': inv.taxRate,
              'Total IVA': inv.taxAmount,
              'Total Factura': inv.total,
              'Moneda': inv.currency
            });
          }
        } else {
          rows.push({
            'Num Factura': inv.invoiceNumber,
            'Fecha': inv.invoiceDate,
            'Vendedor (Proveedor)': inv.sellerName,
            'NIF Vendedor': inv.sellerNif,
            'Dirección Vendedor': inv.sellerAddress,
            'Comprador (Cliente)': inv.buyerName,
            'NIF Comprador': inv.buyerNif,
            'Dirección Comprador': inv.buyerAddress,
            'Línea Nº': 1,
            'Concepto / Artículo': inv.items && inv.items.length > 0 ? inv.items.map(i => i.description).join(' | ') : 'Conceptos generales',
            'Cantidad': 1,
            'Precio Unitario': inv.subtotal,
            'Importe Línea': inv.subtotal,
            'Subtotal Factura': inv.subtotal,
            '% IVA': inv.taxRate,
            'Total IVA': inv.taxAmount,
            'Total Factura': inv.total,
            'Moneda': inv.currency
          });
        }
      }
      return parseCsv(rows);
    }

    if (format === 'ANFIX') {
      const rows: any[] = [];
      for (const inv of invoices) {
        if (itemized && inv.items && inv.items.length > 0) {
          for (const item of inv.items) {
            rows.push({
              'N_FACTURA': inv.invoiceNumber,
              'FECHA_EXPEDICION': inv.invoiceDate,
              'RAZON_SOCIAL_EMISOR': inv.sellerName,
              'CIF_EMISOR': inv.sellerNif,
              'DIRECCION_EMISOR': inv.sellerAddress,
              'RAZON_SOCIAL_RECEPTOR': inv.buyerName,
              'CIF_RECEPTOR': inv.buyerNif,
              'DIRECCION_RECEPTOR': inv.buyerAddress,
              'NUMERO_LINEA': item.itemNumber,
              'DESCRIPCION_LINEA': item.description,
              'CANTIDAD': item.quantity,
              'PRECIO_UNITARIO': item.unitPrice,
              'IMPORTE_LINEA': item.amount,
              'BASE_IMPONIBLE': inv.subtotal,
              'TIPO_IVA': inv.taxRate,
              'CUOTA_IVA': inv.taxAmount,
              'TOTAL_FACTURA': inv.total,
              'MONEDA': inv.currency
            });
          }
        } else {
          rows.push({
            'N_FACTURA': inv.invoiceNumber,
            'FECHA_EXPEDICION': inv.invoiceDate,
            'RAZON_SOCIAL_EMISOR': inv.sellerName,
            'CIF_EMISOR': inv.sellerNif,
            'DIRECCION_EMISOR': inv.sellerAddress,
            'RAZON_SOCIAL_RECEPTOR': inv.buyerName,
            'CIF_RECEPTOR': inv.buyerNif,
            'DIRECCION_RECEPTOR': inv.buyerAddress,
            'NUMERO_LINEA': 1,
            'DESCRIPCION_LINEA': inv.items && inv.items.length > 0 ? inv.items.map(i => i.description).join(' | ') : 'Servicios',
            'CANTIDAD': 1,
            'PRECIO_UNITARIO': inv.subtotal,
            'IMPORTE_LINEA': inv.subtotal,
            'BASE_IMPONIBLE': inv.subtotal,
            'TIPO_IVA': inv.taxRate,
            'CUOTA_IVA': inv.taxAmount,
            'TOTAL_FACTURA': inv.total,
            'MONEDA': inv.currency
          });
        }
      }
      return parseCsv(rows);
    }

    // Standard Default CSV Preset
    const rows: any[] = [];
    for (const inv of invoices) {
      if (itemized && inv.items && inv.items.length > 0) {
        for (const item of inv.items) {
          rows.push({
            'Invoice Number': inv.invoiceNumber,
            'Invoice Date': inv.invoiceDate,
            'Seller Name': inv.sellerName,
            'Seller Tax ID': inv.sellerNif,
            'Seller Address': inv.sellerAddress,
            'Buyer Name': inv.buyerName,
            'Buyer Tax ID': inv.buyerNif,
            'Buyer Address': inv.buyerAddress,
            'Item #': item.itemNumber,
            'Item Description': item.description,
            'Quantity': item.quantity,
            'Unit Price': item.unitPrice,
            'Line Amount': item.amount,
            'Invoice Subtotal': inv.subtotal,
            'Tax Rate (%)': inv.taxRate,
            'Tax Amount': inv.taxAmount,
            'Total Amount': inv.total,
            'Currency': inv.currency
          });
        }
      } else {
        rows.push({
          'Invoice Number': inv.invoiceNumber,
          'Invoice Date': inv.invoiceDate,
          'Seller Name': inv.sellerName,
          'Seller Tax ID': inv.sellerNif,
          'Seller Address': inv.sellerAddress,
          'Buyer Name': inv.buyerName,
          'Buyer Tax ID': inv.buyerNif,
          'Buyer Address': inv.buyerAddress,
          'Item #': 1,
          'Item Description': inv.items && inv.items.length > 0 ? inv.items.map(i => i.description).join(' | ') : 'General Items',
          'Quantity': 1,
          'Unit Price': inv.subtotal,
          'Line Amount': inv.subtotal,
          'Invoice Subtotal': inv.subtotal,
          'Tax Rate (%)': inv.taxRate,
          'Tax Amount': inv.taxAmount,
          'Total Amount': inv.total,
          'Currency': inv.currency
        });
      }
    }
    return parseCsv(rows);
  }
}
