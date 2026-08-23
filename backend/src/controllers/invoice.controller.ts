import { Request, Response } from 'express';
import { PdfParserService } from '../services/pdf-parser.service.js';
import { CsvExporterService } from '../services/csv-exporter.service.js';
import { InvoiceJob, IExtractedInvoice } from '../models/invoice-job.model.js';

const pdfParser = new PdfParserService();
const csvExporter = new CsvExporterService();

export class InvoiceController {
  public async handleHealth(req: Request, res: Response): Promise<void> {
    res.status(200).json({
      status: 'UP',
      service: 'Invoice2CSV Automated Data Extractor',
      mode: 'TypeScript Node.js Express'
    });
  }

  public async handleExtractBatch(req: Request, res: Response): Promise<void> {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        res.status(400).json({ error: 'No PDF invoice files provided in request field "invoices"' });
        return;
      }

      const results: IExtractedInvoice[] = [];

      for (const file of files) {
        const extracted = await pdfParser.extractInvoiceData(file.buffer);
        results.push(extracted);

        // Optionally persist snapshot to MongoDB if available
        try {
          await InvoiceJob.create({
            filename: file.originalname,
            status: 'PROCESSED',
            extractedData: extracted
          });
        } catch (e) {
          // Ignore DB save errors if stateless
        }
      }

      res.status(200).json({
        totalFiles: files.length,
        invoices: results
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to process PDF invoice batch: ' + error.message });
    }
  }

  public async handleExportCsv(req: Request, res: Response): Promise<void> {
    try {
      const { invoices, format } = req.body;
      if (!invoices || !Array.isArray(invoices)) {
        res.status(400).json({ error: 'Invalid or missing "invoices" array payload' });
        return;
      }

      const csvContent = csvExporter.exportToCsv(invoices, format || 'STANDARD');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=invoices_${format || 'standard'}.csv`);
      res.status(200).send(csvContent);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to generate CSV export: ' + error.message });
    }
  }
}
