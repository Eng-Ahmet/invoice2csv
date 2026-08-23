# Invoice2CSV — Internal Data Architecture

## 1. MongoDB Document Collections

### Collection: `parsing_templates`
```json
{
  "_id": "ObjectId",
  "vendor_nif": "B12345678",
  "vendor_name": "Acme Supplies S.L.",
  "rules": {
    "date_pattern": "Fecha:\\s*(\\d{2}/\\d{2}/\\d{4})",
    "total_pattern": "Total\\s*Factura:\\s*([0-9.,]+)",
    "tax_pattern": "IVA\\s*21%:\\s*([0-9.,]+)"
  },
  "created_at": "ISODate"
}
```

### Collection: `invoice_jobs`
```json
{
  "_id": "ObjectId",
  "user_id": "String",
  "file_name": "invoice_2026_01.pdf",
  "status": "PROCESSED",
  "extracted_data": {
    "invoice_number": "INV-2026-001",
    "invoice_date": "2026-01-15",
    "vendor_name": "Tech Supplies S.L.",
    "vendor_nif": "B87654321",
    "subtotal": 100.00,
    "tax_amount": 21.00,
    "total": 121.00
  },
  "created_at": "ISODate"
}
```
