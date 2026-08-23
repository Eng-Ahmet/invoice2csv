import { Schema, model, Document } from 'mongoose';

export interface IInvoiceItem {
  itemNumber: number;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface IExtractedInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  // Seller / Supplier Info
  sellerName: string;
  sellerNif: string;
  sellerAddress: string;
  // Buyer / Client Info
  buyerName: string;
  buyerNif: string;
  buyerAddress: string;
  // Line Items
  items: IInvoiceItem[];
  // Financial Summary
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
    sellerName: { type: String, default: '' },
    sellerNif: { type: String, default: '' },
    sellerAddress: { type: String, default: '' },
    buyerName: { type: String, default: '' },
    buyerNif: { type: String, default: '' },
    buyerAddress: { type: String, default: '' },
    items: [
      {
        itemNumber: Number,
        description: String,
        quantity: Number,
        unitPrice: Number,
        amount: Number
      }
    ],
    subtotal: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    irpfAmount: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: '' }
  },
  createdAt: { type: Date, default: Date.now }
});

export const InvoiceJob = model<IInvoiceJob>('InvoiceJob', InvoiceJobSchema);
