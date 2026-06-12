const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const mammoth = require('mammoth');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } = require('docx');
const ExcelJS = require('exceljs');
const { marked } = require('marked');
const { getFilePath } = require('./tempFileService');

// 动态导入 pdfjs-dist (ESM)
let pdfjsLib = null;
async function getPdfjsLib() {
  if (pdfjsLib) return pdfjsLib;
  pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjsLib;
}

/**
 * 用 pdf.js 从 PDF 提取文本
 */
async function extractTextFromPdf(filePath) {
  const pdfjs = await getPdfjsLib();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  const pagesText = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    pagesText.push(text);
  }

  return pagesText;
}

/**
 * PDF → DOCX
 */
async function pdfToDocx(fileId) {
  const inputPath = getFilePath(`${fileId}.pdf`);
  if (!fs.existsSync(inputPath)) throw new Error('源文件不存在');

  const pagesText = await extractTextFromPdf(inputPath);

  const doc = new Document({
    sections: [{
      properties: {},
      children: pagesText.map((text, index) => [
        new Paragraph({
          children: [new TextRun({ text: `--- Page ${index + 1} ---`, bold: true, size: 24 })],
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

  const buffer = await Packer.toBuffer(doc);
  const outputPath = getFilePath(`${fileId}_converted.docx`);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * DOCX → PDF
 */
async function docxToPdf(fileId) {
  const inputPath = getFilePath(`${fileId}.docx`);
  if (!fs.existsSync(inputPath)) throw new Error('源文件不存在');

  const result = await mammoth.convertToHtml({ path: inputPath });
  const html = `
    <!DOCTYPE html>
    <html><head><meta charset="utf-8">
    <style>
      body { font-family: 'Microsoft YaHei', sans-serif; padding: 40px; line-height: 1.6; }
      h1, h2, h3 { margin-top: 20px; }
      table { border-collapse: collapse; width: 100%; margin: 10px 0; }
      td, th { border: 1px solid #ddd; padding: 8px; }
    </style>
    </head><body>${result.value}</body></html>
  `;

  // 使用 puppeteer 渲染为 PDF
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const outputPath = getFilePath(`${fileId}_converted.pdf`);
  fs.writeFileSync(outputPath, pdfBuffer);
  return outputPath;
}

/**
 * PDF → XLSX
 */
async function pdfToXlsx(fileId) {
  const inputPath = getFilePath(`${fileId}.pdf`);
  if (!fs.existsSync(inputPath)) throw new Error('源文件不存在');

  const pagesText = await extractTextFromPdf(inputPath);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('PDF Content');

  sheet.columns = [
    { header: 'Page', key: 'page', width: 10 },
    { header: 'Content', key: 'content', width: 80 },
  ];

  pagesText.forEach((text, index) => {
    sheet.addRow({ page: index + 1, content: text });
  });

  const outputPath = getFilePath(`${fileId}_converted.xlsx`);
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

/**
 * XLSX → PDF
 */
async function xlsxToPdf(fileId) {
  const inputPath = getFilePath(`${fileId}.xlsx`);
  if (!fs.existsSync(inputPath)) throw new Error('源文件不存在');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(inputPath);

  let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>';
  html += 'body { font-family: "Microsoft YaHei", sans-serif; padding: 20px; }';
  html += 'table { border-collapse: collapse; width: 100%; margin: 10px 0; }';
  html += 'td, th { border: 1px solid #333; padding: 6px 10px; font-size: 12px; }';
  html += 'th { background-color: #f0f0f0; font-weight: bold; }';
  html += 'h2 { color: #333; margin-top: 20px; }';
  html += '</style></head><body>';

  workbook.eachSheet((sheet) => {
    html += `<h2>${sheet.name}</h2><table>`;
    sheet.eachRow((row) => {
      html += '<tr>';
      row.eachCell((cell) => {
        const tag = row.number === 1 ? 'th' : 'td';
        html += `<${tag}>${cell.value ?? ''}</${tag}>`;
      });
      html += '</tr>';
    });
    html += '</table>';
  });

  html += '</body></html>';

  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', landscape: true, printBackground: true });
  await browser.close();

  const outputPath = getFilePath(`${fileId}_converted.pdf`);
  fs.writeFileSync(outputPath, pdfBuffer);
  return outputPath;
}

/**
 * PDF → HTML
 */
async function pdfToHtml(fileId) {
  const inputPath = getFilePath(`${fileId}.pdf`);
  if (!fs.existsSync(inputPath)) throw new Error('源文件不存在');

  const pagesText = await extractTextFromPdf(inputPath);

  let html = `<!DOCTYPE html>
<html lang="zh-CN">
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

  const outputPath = getFilePath(`${fileId}_converted.html`);
  fs.writeFileSync(outputPath, html, 'utf-8');
  return outputPath;
}

/**
 * HTML → PDF
 */
async function htmlToPdf(fileId) {
  const inputPath = getFilePath(`${fileId}.html`);
  if (!fs.existsSync(inputPath)) {
    // 尝试 .htm 扩展名
    const altPath = getFilePath(`${fileId}.htm`);
    if (!fs.existsSync(altPath)) throw new Error('源文件不存在');
  }

  const htmlContent = fs.readFileSync(
    fs.existsSync(getFilePath(`${fileId}.html`)) ? getFilePath(`${fileId}.html`) : getFilePath(`${fileId}.htm`),
    'utf-8'
  );

  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const outputPath = getFilePath(`${fileId}_converted.pdf`);
  fs.writeFileSync(outputPath, pdfBuffer);
  return outputPath;
}

/**
 * PDF → Markdown
 */
async function pdfToMarkdown(fileId) {
  const inputPath = getFilePath(`${fileId}.pdf`);
  if (!fs.existsSync(inputPath)) throw new Error('源文件不存在');

  const pagesText = await extractTextFromPdf(inputPath);

  let md = '';
  pagesText.forEach((text, index) => {
    md += `\n## 第 ${index + 1} 页\n\n`;
    md += text + '\n\n';
    md += '---\n';
  });

  const outputPath = getFilePath(`${fileId}_converted.md`);
  fs.writeFileSync(outputPath, md, 'utf-8');
  return outputPath;
}

/**
 * Markdown → PDF
 */
async function mdToPdf(fileId) {
  const inputPath = getFilePath(`${fileId}.md`);
  if (!fs.existsSync(inputPath)) throw new Error('源文件不存在');

  const mdContent = fs.readFileSync(inputPath, 'utf-8');
  const htmlContent = marked.parse(mdContent);

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="utf-8">
<style>
  body { font-family: 'Microsoft YaHei', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.8; color: #333; }
  h1 { border-bottom: 2px solid #eee; padding-bottom: 10px; }
  h2 { margin-top: 30px; }
  pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
  code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  td, th { border: 1px solid #ddd; padding: 8px; }
  blockquote { border-left: 4px solid #ddd; padding-left: 16px; color: #666; margin: 16px 0; }
</style></head><body>${htmlContent}</body></html>`;

  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  const outputPath = getFilePath(`${fileId}_converted.pdf`);
  fs.writeFileSync(outputPath, pdfBuffer);
  return outputPath;
}

module.exports = {
  pdfToDocx,
  docxToPdf,
  pdfToXlsx,
  xlsxToPdf,
  pdfToHtml,
  htmlToPdf,
  pdfToMarkdown,
  mdToPdf,
};
