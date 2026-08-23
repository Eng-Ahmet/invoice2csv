import { Schema, model, Document } from 'mongoose';

export interface IExtractedInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  vendorName: string;
  vendorNif: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  irpfAmount: number;
  total: number;
  currency: string;
}

export interface IInvoiceJob extends Document {
  filename: string;
  status: 'PENDING' | 'PROCESSED' | 'FAILED';
  extractedData: IExtractedInvoice;
  createdAt: Date;
}

const InvoiceJobSchema = new Schema<IInvoiceJob>({
  filename: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'PROCESSED', 'FAILED'], default: 'PROCESSED' },
  extractedData: {
    invoiceNumber: { type: String, default: '' },
    invoiceDate: { type: String, default: '' },
    vendorName: { type: String, default: 'Desconocido' },
    vendorNif: { type: String, default: '' },
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 21 },
    taxAmount: { type: Number, default: 0 },
    irpfAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'EUR' }
  },
  createdAt: { type: Date, default: Date.now }
});

export const InvoiceJob = model<IInvoiceJob>('InvoiceJob', InvoiceJobSchema);
