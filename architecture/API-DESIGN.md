# Invoice2CSV — API Specifications

## 1. Node.js Backend REST Endpoints (Port 3840 / 3000)

* `POST /api/v1/invoices/extract` — Upload PDF files (multipart/form-data) for extraction. Returns structured JSON containing isolated Seller, Buyer, Financials, and Line Items.
* `POST /api/v1/invoices/export` — Export verified JSON payload to accounting CSV formats (`HOLDED`, `ANFIX`, `STANDARD`).
* `GET /health` — Service health check.

## 2. Python Vision Microservice REST Endpoints (Port 5000 / 5840)

* `POST /extract-vision` — Upload PDF/image file to PyTorch CUDA OCR engine (`python-vision-service`). Returns ExtractedInvoice JSON schema.
* `GET /health` — Check CUDA availability and FastAPI status.
