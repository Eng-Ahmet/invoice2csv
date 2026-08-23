# Invoice2CSV — Automated PDF Invoice Data Extractor & Accounting Converter

> Specialized document processor that extracts structured financial line-items from PDF invoices and transforms them into standardized CSV/Excel formats customized for European & Spanish accounting software.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)](#) [![Complexity](https://img.shields.io/badge/complexity-Medium-orange)](#) [![Backend](https://img.shields.io/badge/backend-Node.js%20%2B%20TypeScript-blue)](#) [![Database](https://img.shields.io/badge/database-MongoDB-green)](#) [![Frontend](https://img.shields.io/badge/frontend-Angular-red)](#)

---

## 1. Product Overview

**Invoice2CSV** is a focused micro-SaaS and desktop document processing utility. It automates the extraction of key financial metadata from PDF invoices (Invoice Number, Date, Supplier CIF/NIF, Tax Rates, Subtotal, Total, Line Items) and converts them into ready-to-import CSV/Excel formats pre-configured for accounting software (e.g. Holded, Anfix, A3Software, QuickBooks).

* **Target Audience:** Freelancers, Small Business Owners, Accountants, Bookkeepers.
* **Core Philosophy:** *PDF Invoice Batch Upload → Intelligent Data Extraction → Accounting-Ready CSV Export.*

---

## 2. Problem Statement

Small business owners and bookkeepers spend dozens of hours every month manually typing numbers from PDF invoices into accounting spreadsheets or ERP software. Generic OCR tools produce raw, unstructured text that still requires manual formatting.

```text
PAINFUL WORKFLOW:
50 PDF Invoices → Open each PDF → Copy/Paste Invoice Number, Date, NIF, Tax Amount → Format Excel manually → Import to Accounting Software

OPTIMIZED WORKFLOW:
Upload PDF Invoice Batch
  ↓
Invoice2CSV Parsing Engine (Node.js + TS)
  ↓
Export Standardized Accounting CSV (Holded / Anfix / Standard Excel)
```

---

## 3. Core Value Proposition

* **Saves 90% Manual Entry Time:** Converts 50 PDF invoices into a clean accounting CSV in under 30 seconds.
* **Pre-Configured Regional Tax Presets:** Includes specific tax rule templates for Spanish/EU invoice requirements (IVA 21%, 10%, 4%, IRPF withholdings).
* **Batch Document Processing:** Drag-and-drop hundreds of PDF files in one session.

---

## 4. Target Users

| User | Primary Use Case | Value Delivered |
| :--- | :--- | :--- |
| **Freelancer / Gestoría Client** | Converting monthly expense invoices for tax filing | Eliminates manual typing before quarter deadlines |
| **Small Business Bookkeeper** | Preparing supplier invoices for ERP import | Saves 15+ hours per month |
| **Accounting Agency (Gestoría)** | Processing client document batches | Dramatically increases client throughput |

---

## 5. Product Workflow

```mermaid
flowchart LR
    A[Batch Drag & Drop PDF Invoices] --> B[Node.js + TS PDF Extraction Engine]
    B --> C[Structure Recognition & Regex Parser]
    C --> D[Validate Taxes & Calculate Subtotals]
    D --> E[Angular Interactive Data Verification Table]
    E --> F[Export Accounting CSV / Excel Template]
```

---

## 6. MVP Scope

### Included in MVP
* PDF invoice parsing (Text-based PDFs and structured digital invoices).
* Extraction of key fields: Supplier Name, NIF/Tax ID, Invoice Date, Invoice ID, Subtotal, Tax Rate (IVA/VAT), Total.
* Pre-configured export templates (Standard CSV, Holded CSV, Anfix Excel).
* Interactive Angular validation table for reviewing and editing extracted data before downloading.
* Data privacy setting: Processing performed locally / temporary RAM processing.

### Explicitly Excluded (Non-Goals)
* Full enterprise double-entry accounting software suite.
* Bank account transaction syncing or payment execution.
* Multi-year cloud document storage archive.

---

## 7. Monetization Strategy

* **Starter Pass:** **€9 / month** (Up to 100 invoices/month).
* **Pro Unlimited Pass:** **€29 / month** (Unlimited invoice parsing + priority accounting presets).
* **Desktop Lifetime License:** **€99** (Single-user offline desktop utility).

---

## 8. Product Evaluation Scorecard

| Criterion | Score | Justification |
| :--- | :---: | :--- |
| **Problem Pain** | 9/10 | Manual invoice data entry is universally tedious and error-prone. |
| **Problem Frequency** | 9/10 | Occurs monthly for every business and freelancer. |
| **Customer Clarity** | 9/10 | Highly specific target: Freelancers, SMEs, and Accounting Agencies. |
| **MVP Simplicity** | 7/10 | PDF parsing requires robust pattern matching algorithms. |
| **Monetization Potential** | 9/10 | High willingness to pay to save manual bookkeeping hours. |
| **Technical Feasibility** | 8/10 | Fits Node.js PDF parsing ecosystem (`pdf-parse`, `pdf2json`). |
| **Product Independence** | 10/10 | Standalone specialized document utility. |
| **Competitive Opportunity**| 8/10 | Niched down specifically for regional tax rules vs generic OCR tools. |
| **TOTAL SCORE** | **74 / 80** | **APPROVED HIGH-VALUE MICRO PRODUCT** |

---

## 9. Technology Stack & Justification

| Layer | Technology Selected | Reason for Selection |
| :--- | :--- | :--- |
| **Backend Language** | **Node.js + TypeScript** | Rich JavaScript PDF parsing libraries (`pdf-parse`, `pdf-lib`); native asynchronous file stream handling. |
| **Framework** | **Express.js** | Lightweight REST API for handling multi-part file uploads and CSV generation. |
| **Database** | **MongoDB** | Stores parsing templates, custom supplier layout rules, and user configuration settings. |
| **Frontend** | **Angular** | Powerful grid table components and reactive forms for reviewing and editing parsed invoice data before export. |

---

## 10. Proposed Future Repository Structure

```text
invoice2csv/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── pdf-parser.service.ts
│   │   │   ├── tax-calculator.service.ts
│   │   │   └── csv-exporter.service.ts
│   │   ├── models/
│   │   └── index.ts
├── frontend/
│   ├── src/app/
│   │   ├── components/
│   │   │   ├── upload-zone/
│   │   │   ├── verification-grid/
│   │   │   └── export-settings/
├── architecture/
│   ├── ARCHITECTURE.md
│   ├── TECH-STACK.md
│   ├── DATA-MODEL.md
│   └── API-DESIGN.md
├── agents/
│   ├── architect.md
│   ├── backend.md
│   ├── frontend.md
│   ├── database.md
│   └── qa.md
└── README.md
```

---

## 11. AI Agent Team Roles

* [architect.md](file:///home/ahmet/Desktop/Projects/micro-products/invoice2csv/agents/architect.md): Defines parsing pipelines, regex field extraction schemas, and export adapter interfaces.
* [backend.md](file:///home/ahmet/Desktop/Projects/micro-products/invoice2csv/agents/backend.md): Implements TypeScript PDF parsing routines, regex heuristic rules, and CSV format generators.
* [frontend.md](file:///home/ahmet/Desktop/Projects/micro-products/invoice2csv/agents/frontend.md): Builds the Angular drag-and-drop UI and dynamic data validation table.
* [database.md](file:///home/ahmet/Desktop/Projects/micro-products/invoice2csv/agents/database.md): Designs MongoDB collections for custom vendor parsing templates.
* [qa.md](file:///home/ahmet/Desktop/Projects/micro-products/invoice2csv/agents/qa.md): Validates extraction accuracy across diverse PDF invoice layouts.
