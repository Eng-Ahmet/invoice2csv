# Invoice2CSV — Internal Data Architecture

## 1. Extracted Invoice Interface Data Schema

```typescript
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
  sellerName: string;
  sellerNif: string;
  sellerAddress: string;
  buyerName: string;
  buyerNif: string;
  buyerAddress: string;
  items: IInvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  irpfAmount: number;
  total: number;
  currency: string;
}
```

## 2. MongoDB Document Collections

### Collection: `invoice_jobs`
```json
{
  "_id": "ObjectId",
  "fileName": "Tax_Invoice_2026.pdf",
  "status": "PROCESSED",
  "extractedData": {
    "invoiceNumber": "1787052224744",
    "invoiceDate": "2026-08-18",
    "sellerName": "ASAAD HAMMOUD ABDALLAH",
    "sellerNif": "Z0800692K",
    "sellerAddress": "Calle CEUTA 36, Esc. 1, Piso BJ, Puerta B, Malaga, Spain",
    "buyerName": "Nicolás de Freitas Jover",
    "buyerNif": "76089966D",
    "buyerAddress": "Carretera del Pradillo km 1.3 Conil de la Frontera",
    "subtotal": 1650.00,
    "taxRate": 21.00,
    "taxAmount": 346.50,
    "total": 1996.50,
    "currency": "EUR"
  },
  "createdAt": "ISODate"
}
```
