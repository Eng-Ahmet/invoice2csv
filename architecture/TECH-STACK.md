# Invoice2CSV — Technology Stack Decisions

| Layer | Technology | Decision Justification | Rejected Alternatives |
| :--- | :--- | :--- | :--- |
| **Backend Language** | Node.js (v20) + TypeScript | Rich PDF processing libraries (`pdf-parse`) and native async event-driven stream parsing. | Java / Spring Boot (Overly verbose for lightweight text extraction regex routines). |
| **Backend Framework** | Express.js | Standardized REST API middleware for handling multipart file streams (`multer`) on port 3840 / 3000. | NestJS (Unnecessary abstraction layer for single-purpose document parsing). |
| **Vision Microservice** | Python 3.11 + PyTorch + FastAPI | GPU-accelerated OCR & Vision extraction service (`python-vision-service` on port 5000/5840) using PyTesseract and Poppler utils. | Cloud OCR APIs (Violates 100% offline local data privacy model). |
| **Database** | MongoDB | Schemaless document structure ideal for storing non-uniform vendor PDF extraction templates and invoice jobs. | PostgreSQL (Relational schema limits flexibility for dynamic vendor parsing rules). |
| **Frontend Framework** | Angular (v19) | Advanced reactive form controls and editable grid tables for reviewing extracted invoice line items on port 4840. | HTML+CSS+JS (Inadequate state handling for reviewing multi-invoice batch edits). |
