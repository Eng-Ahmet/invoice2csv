# Invoice2CSV — Technology Stack Decisions

| Layer | Technology | Decision Justification | Rejected Alternatives |
| :--- | :--- | :--- | :--- |
| **Backend Language** | Node.js (v20) + TypeScript | Rich PDF processing libraries (`pdf2json`, `pdf-parse`) and native async event-driven stream parsing. | Java / Spring Boot (Overly verbose for lightweight text extraction regex routines). |
| **Backend Framework** | Express.js | Standardized REST API middleware for handling multipart file streams (`multer`). | NestJS (Unnecessary abstraction layer for single-purpose document parsing). |
| **Database** | MongoDB | Schemaless document structure ideal for storing non-uniform vendor PDF extraction templates and tax rules. | PostgreSQL (Relational schema limits flexibility for dynamic vendor parsing rules). |
| **Frontend Framework** | Angular (v17+) | Advanced reactive form controls and editable grid tables for reviewing extracted invoice line items. | HTML+CSS+JS (Inadequate state handling for reviewing multi-invoice batch edits). |
