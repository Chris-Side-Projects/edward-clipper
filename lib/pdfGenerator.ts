// PDF generation for multipage captures
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface PageData {
  title?: string;
  url?: string;
  screenshot?: string; // base64 data URL
  pageNumber: number;
  bodyText?: string;
  html?: string;
  capturedAt: string;
}

export async function generateMultipagePDF(pages: PageData[], title: string): Promise<Buffer> {
  if (!pages || pages.length === 0) {
    throw new Error('No pages provided for PDF generation');
  }

  const tempDir = `/tmp/pdf-${Date.now()}`;
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // Create HTML file for each page
    const htmlFiles: string[] = [];
    
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageHtml = generatePageHTML(page, i + 1, pages.length, title);
      const htmlFile = path.join(tempDir, `page-${i + 1}.html`);
      fs.writeFileSync(htmlFile, pageHtml);
      htmlFiles.push(htmlFile);
    }

    // Generate individual PDFs first
    const pdfFiles: string[] = [];
    for (let i = 0; i < htmlFiles.length; i++) {
      const htmlFile = htmlFiles[i];
      const pdfFile = path.join(tempDir, `page-${i + 1}.pdf`);
      
      try {
        // Use Chromium headless to render HTML to PDF
        execSync(
          `/usr/bin/chromium-browser --headless --no-sandbox --disable-gpu --disable-software-rasterizer --disable-dev-shm-usage --virtual-time-budget=2000 --print-to-pdf="${pdfFile}" --print-to-pdf-no-header "file://${htmlFile}"`,
          { timeout: 30000, stdio: 'pipe' }
        );
        
        if (fs.existsSync(pdfFile)) {
          pdfFiles.push(pdfFile);
        }
      } catch (pdfErr: any) {
        console.error(`PDF generation error for page ${i + 1}:`, pdfErr.message);
        // Continue with other pages
      }
    }

    if (pdfFiles.length === 0) {
      throw new Error('No PDF pages were generated successfully');
    }

    // Merge PDFs using pdftk or gs (ghostscript)
    const mergedPdf = path.join(tempDir, 'merged.pdf');
    
    try {
      // Try pdftk first (if available)
      execSync(
        `pdftk ${pdfFiles.join(' ')} cat output "${mergedPdf}"`,
        { timeout: 30000, stdio: 'pipe' }
      );
    } catch (pdftk_err) {
      try {
        // Fallback to ghostscript
        execSync(
          `gs -dBATCH -dNOPAUSE -q -sDEVICE=pdfwrite -sOutputFile="${mergedPdf}" ${pdfFiles.join(' ')}`,
          { timeout: 30000, stdio: 'pipe' }
        );
      } catch (gs_err) {
        // If both fail, just use the first PDF
        if (pdfFiles.length === 1) {
          fs.copyFileSync(pdfFiles[0], mergedPdf);
        } else {
          throw new Error('PDF merge failed: neither pdftk nor ghostscript available');
        }
      }
    }

    if (!fs.existsSync(mergedPdf)) {
      throw new Error('Merged PDF was not created');
    }

    const pdfBuffer = fs.readFileSync(mergedPdf);
    return pdfBuffer;
  } finally {
    // Cleanup temp files
    try {
      execSync(`rm -rf "${tempDir}"`, { timeout: 10000 });
    } catch (cleanup_err) {
      console.error('Cleanup error:', cleanup_err);
    }
  }
}

function generatePageHTML(page: PageData, pageNum: number, totalPages: number, docTitle: string): string {
  const screenshot = page.screenshot ? 
    `<div class="screenshot-container">
       <img src="${page.screenshot}" style="max-width: 100%; height: auto; border: 1px solid #ccc;" />
     </div>` : '';

  const bodyText = page.bodyText ? 
    `<div class="page-text">
       <h3>Extracted Text</h3>
       <p style="white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 12px;">${escapeHtml(page.bodyText.slice(0, 5000))}</p>
     </div>` : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(docTitle)} - Page ${pageNum}</title>
  <style>
    body { 
      font-family: Arial, sans-serif; 
      margin: 20px; 
      background: white;
      color: black;
    }
    .page-header {
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .page-title {
      font-size: 18px;
      font-weight: bold;
      margin: 0;
    }
    .page-meta {
      font-size: 12px;
      color: #666;
      margin: 5px 0;
    }
    .screenshot-container {
      margin: 20px 0;
      page-break-inside: avoid;
    }
    .page-text {
      margin-top: 20px;
    }
    .page-text h3 {
      font-size: 14px;
      margin: 10px 0 5px 0;
      border-bottom: 1px solid #ccc;
    }
    @media print {
      .page-header {
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <div class="page-header">
    <h1 class="page-title">${escapeHtml(docTitle)}</h1>
    <div class="page-meta">Page ${pageNum} of ${totalPages}</div>
    <div class="page-meta">URL: ${escapeHtml(page.url || 'Unknown')}</div>
    <div class="page-meta">Captured: ${new Date(page.capturedAt).toLocaleString()}</div>
  </div>
  
  ${screenshot}
  ${bodyText}
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}