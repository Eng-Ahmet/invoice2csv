import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { connectDatabase } from './config/database.js';
import { InvoiceController } from './controllers/invoice.controller.js';

const app = express();
const port = process.env.PORT || 3000;

// Configure Multer for in-memory PDF file streams
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB file size limit
});

const invoiceController = new InvoiceController();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// REST API Endpoints
app.get('/api/v1/health', invoiceController.handleHealth.bind(invoiceController));
app.post('/api/v1/invoices/extract', upload.array('invoices', 50), invoiceController.handleExtractBatch.bind(invoiceController));
app.post('/api/v1/invoices/export', invoiceController.handleExportCsv.bind(invoiceController));

// Connect Database & Start Server
connectDatabase().then(() => {
  app.listen(port, () => {
    console.log(`🧾 Invoice2CSV API running on http://localhost:${port}`);
  });
});
