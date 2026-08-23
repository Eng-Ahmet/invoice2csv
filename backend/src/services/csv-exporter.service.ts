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
        'Nombre Contacto': inv.vendorName,
        'NIF Contacto': inv.vendorNif,
        'Subtotal': inv.subtotal,
        '% IVA': inv.taxRate,
        'Total IVA': inv.taxAmount,
        'Total': inv.total
      }));
      return parseCsv(holdedMapped);
    }

    if (format === 'ANFIX') {
      const anfixMapped = invoices.map(inv => ({
        'N_FACTURA': inv.invoiceNumber,
        'FECHA_EXPEDICION': inv.invoiceDate,
        'RAZON_SOCIAL': inv.vendorName,
        'CIF_NIF': inv.vendorNif,
        'BASE_IMPONIBLE': inv.subtotal,
        'TIPO_IVA': inv.taxRate,
        'CUOTA_IVA': inv.taxAmount,
        'TOTAL_FACTURA': inv.total
      }));
      return parseCsv(anfixMapped);
    }

    // Standard Default CSV Preset
    return parseCsv(invoices);
  }
}
