import { Injectable } from '@nestjs/common';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

@Injectable()
export class ExportService {
  private readonly exportRoot = path.resolve(process.cwd(), 'uploads', 'exports');

  constructor() {
    if (!fs.existsSync(this.exportRoot)) {
      fs.mkdirSync(this.exportRoot, { recursive: true });
    }
  }

  // Automatic clean up of exports older than 1 hour
  cleanOldExports() {
    try {
      const files = fs.readdirSync(this.exportRoot);
      const now = Date.now();
      for (const file of files) {
        const filePath = path.join(this.exportRoot, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > 60 * 60 * 1000) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (err) {
      console.error('Failed to cleanup old exports:', err);
    }
  }

  generateCsvContent(headers: string[], rows: any[][]): string {
    const formatValue = (val: any) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    const headerLine = headers.map(formatValue).join(',');
    const rowLines = rows.map(row => row.map(formatValue).join(','));
    return [headerLine, ...rowLines].join('\n');
  }

  generateExcelXmlContent(title: string, headers: string[], rows: any[][]): string {
    // Basic XML spreadsheet format that Microsoft Excel opens directly
    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Worksheet ss:Name="Sheet1">
  <Table>
   <Row ss:Height="25">
    <Cell ss:MergeAcross="${headers.length - 1}"><Data ss:Type="String">${title}</Data></Cell>
   </Row>
   <Row>`;
    headers.forEach(h => {
      xml += `<Cell><Data ss:Type="String">${h}</Data></Cell>`;
    });
    xml += `</Row>`;
    rows.forEach(row => {
      xml += `<Row>`;
      row.forEach(cell => {
        const type = typeof cell === 'number' ? 'Number' : 'String';
        xml += `<Cell><Data ss:Type="${type}">${cell !== null && cell !== undefined ? cell : ''}</Data></Cell>`;
      });
      xml += `</Row>`;
    });
    xml += `  </Table>
 </Worksheet>
</Workbook>`;
    return xml;
  }

  async generatePdfContent(title: string, headers: string[], rows: any[][]): Promise<Buffer> {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4 Size
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const margin = 40;
    const width = 595.28 - margin * 2;
    let y = 800;

    // Draw Title
    page.drawText(title, { x: margin, y, font: boldFont, size: 16, color: rgb(0.09, 0.09, 0.15) });
    y -= 30;

    // Draw Headers
    const colWidth = width / headers.length;
    headers.forEach((h, index) => {
      page.drawText(h, { x: margin + index * colWidth, y, font: boldFont, size: 10, color: rgb(0.2, 0.2, 0.3) });
    });
    y -= 15;
    page.drawLine({
      start: { x: margin, y },
      end: { x: margin + width, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.8)
    });
    y -= 20;

    // Draw Rows
    for (const row of rows) {
      if (y < 50) {
        // Add new page
        page = pdfDoc.addPage([595.28, 841.89]);
        y = 800;
        // Repeat headers
        headers.forEach((h, index) => {
          page.drawText(h, { x: margin + index * colWidth, y, font: boldFont, size: 10, color: rgb(0.2, 0.2, 0.3) });
        });
        y -= 15;
        page.drawLine({
          start: { x: margin, y },
          end: { x: margin + width, y },
          thickness: 1,
          color: rgb(0.7, 0.7, 0.8)
        });
        y -= 20;
      }

      row.forEach((cell, index) => {
        const text = String(cell !== null && cell !== undefined ? cell : '');
        page.drawText(text, { x: margin + index * colWidth, y, font, size: 8, color: rgb(0.1, 0.1, 0.1) });
      });
      y -= 18;
    }

    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }

  async createExportFile(reportType: string, format: 'csv' | 'excel' | 'pdf', title: string, headers: string[], rows: any[][]): Promise<string> {
    this.cleanOldExports();
    
    const randomHex = crypto.randomBytes(16).toString('hex');
    const ext = format === 'csv' ? 'csv' : format === 'excel' ? 'xml' : 'pdf';
    const filename = `${reportType}-${Date.now()}-${randomHex}.${ext}`;
    const filePath = path.join(this.exportRoot, filename);

    if (format === 'csv') {
      const content = this.generateCsvContent(headers, rows);
      fs.writeFileSync(filePath, content, 'utf8');
    } else if (format === 'excel') {
      const content = this.generateExcelXmlContent(title, headers, rows);
      fs.writeFileSync(filePath, content, 'utf8');
    } else if (format === 'pdf') {
      const buffer = await this.generatePdfContent(title, headers, rows);
      fs.writeFileSync(filePath, buffer);
    }

    return filename;
  }

  getFilePath(filename: string): string {
    return path.join(this.exportRoot, filename);
  }
}
