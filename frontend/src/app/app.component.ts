import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ExtractedInvoice {
  invoiceNumber: string;
  invoiceDate: string;
  vendorName: string;
  vendorNif: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  irpfAmount: number;
  total: number;
  currency: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Invoice2CSV';
  selectedFiles: File[] = [];
  invoices: ExtractedInvoice[] = [];
  exportFormat: 'STANDARD' | 'HOLDED' | 'ANFIX' = 'HOLDED';
  isProcessing = false;

  onFileSelected(event: any) {
    if (event.target.files && event.target.files.length > 0) {
      this.selectedFiles = Array.from(event.target.files);
    }
  }

  async processInvoices() {
    if (this.selectedFiles.length === 0) return;
    this.isProcessing = true;

    const formData = new FormData();
    this.selectedFiles.forEach(file => {
      formData.append('invoices', file);
    });

    try {
      const response = await fetch('http://localhost:3000/api/v1/invoices/extract', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.invoices) {
        this.invoices = data.invoices;
      }
    } catch (err) {
      alert('Error de conexión con el backend de Invoice2CSV');
    } finally {
      this.isProcessing = false;
    }
  }

  async downloadCsv() {
    if (this.invoices.length === 0) return;

    try {
      const response = await fetch('http://localhost:3000/api/v1/invoices/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format: this.exportFormat,
          invoices: this.invoices
        })
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `facturas_${this.exportFormat.toLowerCase()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      alert('Error generando el archivo CSV');
    }
  }
}
