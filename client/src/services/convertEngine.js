/**
 * 纯浏览器端格式转换引擎
 * 无需后端服务器，所有转换在浏览器中完成
 */
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { marked } from 'marked';
import { extractTextFromPdf, getFileBytes, getFileName } from './pdfEngine';

/**
 * 触发文件下载
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { filename };
}

/**
 * PDF → DOCX
 */
export async function pdfToDocx(fileId) {
  const pdfBytes = getFileBytes(fileId);
  if (!pdfBytes) throw new Error('文件不存在');

  const pagesText = await extractTextFromPdf(pdfBytes);
  const doc = new Document({
    sections: [{
      children: pagesText.map((text, index) => [
        new Paragraph({
          text: `--- Page ${index + 1} ---`,
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 200, after: 100 },
        }),
        ...text.split('\n').filter(Boolean).map(line =>
          new Paragraph({
            children: [new TextRun({ text: line, size: 22 })],
            spacing: { after: 60 },
          })
        ),
      ]).flat(),
    }],
  });

  const buffer = await Packer.toBlob(doc);
  const name = getFileName(fileId).replace(/\.[^.]+$/, '') + '.docx';
  downloadBlob(buffer, name);
  return { fileId, name };
}

/**
 * DOCX → PDF（通过 HTML 中间格式 + 浏览器打印）
 */
export async function docxToPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  body { font-family: 'Microsoft YaHei', sans-serif; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
  h1, h2, h3 { margin-top: 20px; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  td, th { border: 1px solid #ddd; padding: 8px; }
</style></head><body>${result.value}</body></html>`;

  // 在新窗口打开并触发打印
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 500);
  return { name: file.name.replace(/\.[^.]+$/, '') + '.pdf' };
}

/**
 * PDF → XLSX
 */
export async function pdfToXlsx(fileId) {
  const pdfBytes = getFileBytes(fileId);
  if (!pdfBytes) throw new Error('文件不存在');

  const pagesText = await extractTextFromPdf(pdfBytes);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('PDF Content');

  sheet.columns = [
    { header: 'Page', key: 'page', width: 10 },
    { header: 'Content', key: 'content', width: 80 },
  ];

  pagesText.forEach((text, index) => {
    sheet.addRow({ page: index + 1, content: text });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const name = getFileName(fileId).replace(/\.[^.]+$/, '') + '.xlsx';
  downloadBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), name);
  return { fileId, name };
}

/**
 * XLSX → PDF（转 HTML 表格后打印）
 */
export async function xlsxToPdf(file) {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family: 'Microsoft YaHei', sans-serif; padding: 20px; }
    table { border-collapse: collapse; width: 100%; margin: 10px 0; }
    td, th { border: 1px solid #333; padding: 6px 10px; font-size: 12px; }
    th { background: #f0f0f0; font-weight: bold; }
    h2 { margin-top: 20px; }
    @media print { button { display: none; } }
  </style></head><body>
  <button onclick="window.print()" style="padding:10px 20px;margin:10px;font-size:16px;cursor:pointer;background:#2563eb;color:white;border:none;border-radius:6px;">
    💾 保存为 PDF
  </button>`;

  workbook.eachSheet((sheet) => {
    html += `<h2>${sheet.name}</h2><table>`;
    sheet.eachRow((row, rowNum) => {
      html += '<tr>';
      row.eachCell((cell) => {
        const tag = rowNum === 1 ? 'th' : 'td';
        html += `<${tag}>${cell.value ?? ''}</${tag}>`;
      });
      html += '</tr>';
    });
    html += '</table>';
  });
  html += '</body></html>';

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  return { name: file.name.replace(/\.[^.]+$/, '') + '.pdf' };
}

/**
 * PDF → HTML
 */
export async function pdfToHtml(fileId) {
  const pdfBytes = getFileBytes(fileId);
  if (!pdfBytes) throw new Error('文件不存在');

  const pagesText = await extractTextFromPdf(pdfBytes);
  let html = `<!DOCTYPE html><html lang="zh-CN">
<head><meta charset="utf-8"><title>PDF Export</title>
<style>
  body { font-family: 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.8; }
  .page { border-bottom: 2px dashed #ccc; padding: 20px 0; margin-bottom: 20px; }
  .page-num { color: #999; font-size: 12px; margin-bottom: 10px; }
</style></head><body>`;

  pagesText.forEach((text, index) => {
    html += `<div class="page"><div class="page-num">第 ${index + 1} 页</div>`;
    html += text.split('\n').filter(Boolean).map(line => `<p>${line}</p>`).join('\n');
    html += '</div>';
  });
  html += '</body></html>';

  const name = getFileName(fileId).replace(/\.[^.]+$/, '') + '.html';
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), name);
  return { fileId, name };
}

/**
 * HTML → PDF（浏览器打印）
 */
export async function htmlToPdf(file) {
  const text = await file.text();
  const win = window.open('', '_blank');
  win.document.write(text);
  win.document.close();
  setTimeout(() => win.print(), 500);
  return { name: file.name.replace(/\.[^.]+$/, '') + '.pdf' };
}

/**
 * PDF → Markdown
 */
export async function pdfToMarkdown(fileId) {
  const pdfBytes = getFileBytes(fileId);
  if (!pdfBytes) throw new Error('文件不存在');

  const pagesText = await extractTextFromPdf(pdfBytes);
  let md = '';
  pagesText.forEach((text, index) => {
    md += `\n## 第 ${index + 1} 页\n\n${text}\n\n---\n`;
  });

  const name = getFileName(fileId).replace(/\.[^.]+$/, '') + '.md';
  downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), name);
  return { fileId, name };
}

/**
 * Markdown → PDF（转 HTML 后打印）
 */
export async function mdToPdf(file) {
  const text = await file.text();
  const htmlContent = marked.parse(text);
  const html = `<!DOCTYPE html><html lang="zh-CN">
<head><meta charset="utf-8">
<style>
  body { font-family: 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.8; }
  h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
  h2 { margin-top: 30px; }
  pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
  code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ddd; padding: 8px; }
  blockquote { border-left: 4px solid #ddd; padding-left: 16px; color: #666; }
  @media print { button { display: none; } }
</style></head><body>
<button onclick="window.print()" style="position:fixed;top:20px;right:20px;padding:12px 24px;font-size:16px;cursor:pointer;background:#2563eb;color:white;border:none;border-radius:8px;z-index:9999;">
  💾 保存为 PDF
</button>
${htmlContent}</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  return { name: file.name.replace(/\.[^.]+$/, '') + '.pdf' };
}

// 转换类型映射
export const CONVERT_FORMATS = [
  { type: 'pdf-to-docx', label: 'PDF → Word', icon: '📄→📝', accept: '.pdf' },
  { type: 'docx-to-pdf', label: 'Word → PDF', icon: '📝→📄', accept: '.docx' },
  { type: 'pdf-to-xlsx', label: 'PDF → Excel', icon: '📄→📊', accept: '.pdf' },
  { type: 'xlsx-to-pdf', label: 'Excel → PDF', icon: '📊→📄', accept: '.xlsx' },
  { type: 'pdf-to-html', label: 'PDF → HTML', icon: '📄→🌐', accept: '.pdf' },
  { type: 'html-to-pdf', label: 'HTML → PDF', icon: '🌐→📄', accept: '.html,.htm' },
  { type: 'pdf-to-markdown', label: 'PDF → Markdown', icon: '📄→📋', accept: '.pdf' },
  { type: 'md-to-pdf', label: 'Markdown → PDF', icon: '📋→📄', accept: '.md' },
];

export const CONVERT_METHODS = {
  'pdf-to-docx': pdfToDocx,
  'docx-to-pdf': docxToPdf,
  'pdf-to-xlsx': pdfToXlsx,
  'xlsx-to-pdf': xlsxToPdf,
  'pdf-to-html': pdfToHtml,
  'html-to-pdf': htmlToPdf,
  'pdf-to-markdown': pdfToMarkdown,
  'md-to-pdf': mdToPdf,
};
