# Invoice2CSV — Architecture Specification

## 1. System Architecture

Invoice2CSV processes PDF documents through a sequential multi-stage extraction pipeline.

```text
┌─────────────────────────────────────────────────────────────┐
│                      Angular Frontend                       │
│  [ Upload Dropzone ] ──► [ Verification & Editing Grid ]     │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Multipart PDF Upload / API)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Node.js + TypeScript Backend                 │
│  ┌────────────────────┐   ┌──────────────────────────────┐  │
│  │ PDF Text Extractor │──►│ Pattern Heuristics & Regex   │  │
│  └────────────────────┘   └──────────────┬───────────────┘  │
│                                          │                  │
│  ┌────────────────────┐   ┌──────────────▼───────────────┐  │
│  │ Tax Validator Rules│◄──│ Financial Data Structuring    │  │
│  └─────────┬──────────┘   └──────────────────────────────┘  │
└────────────┼────────────────────────────────────────────────┘
             │
             ▼
┌──────────────────────────┐      ┌──────────────────────────┐
│ MongoDB Storage          │      │ Export Adapter Generator │
│ (Vendor Template Rules)  │      │ (Holded / Anfix / CSV)   │
└──────────────────────────┘      └──────────────────────────┘
```

## 2. Extraction & Parsing Pipeline

1. **PDF Text Stream Tokenization:** Converts PDF page structures into spatial text streams with coordinates using `pdf2json`.
2. **Metadata Heuristic Engine:** Applies spatial regex logic:
   - Finds Tax IDs (CIF/NIF, VAT numbers).
   - Locates totals by detecting keywords (`TOTAL`, `SUBTOTAL`, `BASE IMPONIBLE`, `IVA`).
   - Parses dates using international ISO formats (`YYYY-MM-DD`, `DD/MM/YYYY`).
3. **Tax Validation:** Verifies mathematical consistency (`Subtotal + Tax = Total`).
4. **Verification Grid:** Serves structured JSON payload to the Angular UI for user review before generating CSV export.
