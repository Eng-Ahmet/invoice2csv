# Invoice2CSV — API Specifications

## 1. REST Endpoints

* `POST /api/v1/invoices/extract` — Upload PDF files (multipart) for parsing.
* `POST /api/v1/invoices/export` — Export verified JSON payload to accounting CSV (Holded, Anfix, Standard).
* `GET /api/v1/templates` — List vendor-specific extraction rules.
* `POST /api/v1/templates` — Save custom parsing rule for a vendor NIF.
