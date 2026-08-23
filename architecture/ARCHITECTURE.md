# Invoice2CSV — Architecture Specification

## 1. System Architecture

Invoice2CSV processes PDF documents through a sequential multi-stage extraction pipeline combining a spatial Node.js text extraction engine with a PyTorch & CUDA Computer Vision microservice.

```text
┌─────────────────────────────────────────────────────────────┐
│                 Angular Frontend (Port 4840)                │
│  [ Upload Dropzone ] ──► [ Verification & Editing Grid ]     │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Multipart PDF Upload / API)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│          Node.js + TypeScript Backend (Port 3840 / 3000)    │
│  ┌────────────────────────┐   ┌──────────────────────────┐  │
│  │ 2-Column Spatial Split │──►│ Compound Header Filter   │  │
│  │ (splitSideBySideParty) │   │ (isHeaderOrLabelLine)    │  │
│  └────────────────────────┘   └────────────┬─────────────┘  │
│                                            │                │
│  ┌────────────────────────┐   ┌────────────▼─────────────┐  │
│  │ Tax & Line Item Engine │◄──│ Dual-Party Isolator      │  │
│  └───────────┬────────────┘   │ (splitSideBySideNames)   │  │
│              │                └──────────────────────────┘  │
└──────────────┼──────────────────────────────────────────────┘
               │
               ├──────────────────────────────┐
               ▼                              ▼
┌──────────────────────────┐   ┌─────────────────────────────┐
│ MongoDB Storage (27017)  │   │ PyTorch CUDA Vision Service │
│ (Invoice Jobs & Logs)    │   │ (Port 5000 / 5840)          │
└──────────────────────────┘   └─────────────────────────────┘
```

## 2. Multi-Column Extraction & Party Separation Pipeline

1. **PDF Vector Text Stream Tokenization:** Converts PDF page structures into spatial text streams using `pdf-parse`.
2. **Compound Header & Document Title Blacklisting (`isHeaderOrLabelLine`):**
   - Filters out document titles (`Official invoice document`, `Tax Invoice`, `Factura Proforma`).
   - Rejects combined party block labels (`BILL TO / CLIENT IDENTITY KYC`, `SUPPLIER`, `COMPRADOR`, `VENDEDOR`).
   - Ignores system verification codes (`1787052224744-MSYKSJUB`) and registry entries (`CR: IAE 763`).
3. **2-Column Horizontal Side-by-Side Block Separator (`splitSideBySidePartyBlocks`):**
   - Detects multi-column lines where Supplier (Emisor) and Buyer (Comprador) are printed horizontally on the same line.
   - Splits left and right text streams to isolate Seller block from Buyer block.
4. **Dual-Party Name Isolator (`splitSideBySideNames`):**
   - Handles lines containing two side-by-side party names (e.g. `ASAAD HAMMOUD ABDALLAH Nicolas de Freitas Jover`).
   - Extracts `sellerName` (`ASAAD HAMMOUD ABDALLAH`) and `buyerName` (`Nicolás de Freitas Jover`) independently without text merging.
5. **Tax & Financial Validation:** Verifies mathematical consistency (`Subtotal + Tax = Total`).
6. **PyTorch CUDA Vision Fallback Microservice:**
   - If native text stream parsing requires OCR, forwards the PDF buffer to `python-vision-service` running PyTorch CUDA, PyTesseract, and Poppler.
7. **Verification Grid:** Serves structured JSON payload to the Angular UI for user review before generating CSV export.
