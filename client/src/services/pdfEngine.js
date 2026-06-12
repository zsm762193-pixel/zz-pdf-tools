/**
 * 纯浏览器端 PDF 操作引擎
 * 使用 pdf-lib 和 pdfjs-dist，无需后端服务器
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

// ============ 文件存储（内存） ============
const fileStore = new Map(); // fileId -> { pdfDoc, pdfBytes, name, blobUrl }
const blobUrlCache = new Map(); // fileId -> blobUrl

function generateId() {
  return 'pdf_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function updateBlobUrl(fileId, pdfBytes) {
  // 撤销旧 blob URL
  if (blobUrlCache.has(fileId)) {
    URL.revokeObjectURL(blobUrlCache.get(fileId));
  }
  const blobUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
  blobUrlCache.set(fileId, blobUrl);
  return blobUrl;
}

// ============ 核心操作 ============

/** 加载 PDF */
export async function loadPdf(arrayBuffer) {
  return PDFDocument.load(arrayBuffer);
}

/** 保存 PDF 为字节 */
export async function savePdfToBytes(pdfDoc) {
  return pdfDoc.save();
}

/** 从文件加载并存储 */
export async function uploadAndStore(file) {
  const fileId = generateId();
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);

  const pdfBytes = new Uint8Array(arrayBuffer);

  fileStore.set(fileId, {
    pdfDoc,
    pdfBytes,
    name: file.name,
  });

  updateBlobUrl(fileId, pdfBytes);

  return { fileId, originalName: file.name, size: file.size };
}

/** 获取 PDF 信息 */
export async function getPdfInfo(fileId) {
  const stored = fileStore.get(fileId);
  if (!stored) throw new Error('文件不存在');

  const pages = stored.pdfDoc.getPages();
  return {
    pageCount: pages.length,
    pages: pages.map((page, index) => ({
      pageNumber: index + 1,
      width: page.getWidth(),
      height: page.getHeight(),
      rotation: page.getRotation().angle,
    })),
  };
}

/** 页面重新排序 */
export async function reorderPages(fileId, newOrder) {
  const stored = fileStore.get(fileId);
  if (!stored) throw new Error('文件不存在');

  const oldDoc = stored.pdfDoc;
  const newDoc = await PDFDocument.create();

  for (const pageNum of newOrder) {
    const index = pageNum - 1;
    if (index >= 0 && index < oldDoc.getPageCount()) {
      const [copiedPage] = await newDoc.copyPages(oldDoc, [index]);
      newDoc.addPage(copiedPage);
    }
  }

  const newBytes = await newDoc.save();
  stored.pdfDoc = newDoc;
  stored.pdfBytes = newBytes;
  updateBlobUrl(fileId, newBytes);
  return { message: '页面顺序已更新' };
}

/** 删除页面 */
export async function deletePages(fileId, pageNumbers) {
  const stored = fileStore.get(fileId);
  if (!stored) throw new Error('文件不存在');

  const oldDoc = stored.pdfDoc;
  const toDelete = new Set(pageNumbers.map(n => n - 1));
  const newDoc = await PDFDocument.create();

  for (let i = 0; i < oldDoc.getPageCount(); i++) {
    if (!toDelete.has(i)) {
      const [copiedPage] = await newDoc.copyPages(oldDoc, [i]);
      newDoc.addPage(copiedPage);
    }
  }

  const newBytes = await newDoc.save();
  stored.pdfDoc = newDoc;
  stored.pdfBytes = newBytes;
  updateBlobUrl(fileId, newBytes);
  return { message: `已删除 ${pageNumbers.length} 页` };
}

/** 旋转页面 */
export async function rotatePages(fileId, rotations) {
  const stored = fileStore.get(fileId);
  if (!stored) throw new Error('文件不存在');

  const pages = stored.pdfDoc.getPages();
  for (const { pageNumber, angle } of rotations) {
    const page = pages[pageNumber - 1];
    if (page) {
      page.setRotation(page.getRotation().angle + angle);
    }
  }

  const newBytes = await stored.pdfDoc.save();
  stored.pdfBytes = newBytes;
  updateBlobUrl(fileId, newBytes);
  return { message: '页面已旋转' };
}

/** 合并 PDF */
export async function mergePdfs(fileId, mergeFile) {
  const stored = fileStore.get(fileId);
  if (!stored) throw new Error('文件不存在');

  const mergeArrayBuffer = await mergeFile.arrayBuffer();
  const mergeDoc = await PDFDocument.load(mergeArrayBuffer);

  const copiedPages = await stored.pdfDoc.copyPages(mergeDoc, mergeDoc.getPageIndices());
  for (const page of copiedPages) {
    stored.pdfDoc.addPage(page);
  }

  const newBytes = await stored.pdfDoc.save();
  stored.pdfBytes = newBytes;
  updateBlobUrl(fileId, newBytes);
  return { message: 'PDF 合并成功' };
}

/** 编辑文字 */
export async function editText(fileId, pageNumber, edits) {
  const stored = fileStore.get(fileId);
  if (!stored) throw new Error('文件不存在');

  const pages = stored.pdfDoc.getPages();
  const page = pages[pageNumber - 1];
  if (!page) throw new Error('页码超出范围');

  const pageHeight = page.getHeight();
  const font = await stored.pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const edit of edits) {
    const pdfY = pageHeight - edit.y - edit.height;
    // 覆盖原文字
    page.drawRectangle({
      x: edit.x,
      y: pdfY,
      width: edit.width,
      height: edit.height + 2,
      color: rgb(1, 1, 1),
    });
    // 写新文字
    page.drawText(edit.text, {
      x: edit.x,
      y: pdfY + 2,
      size: edit.fontSize || 12,
      font,
      color: rgb(0, 0, 0),
    });
  }

  const newBytes = await stored.pdfDoc.save();
  stored.pdfBytes = newBytes;
  updateBlobUrl(fileId, newBytes);
  return { message: '文字已编辑' };
}

/** 获取渲染用 PDF 数据（返回缓存的 blob URL） */
export function getRenderBlobUrl(fileId) {
  if (blobUrlCache.has(fileId)) return blobUrlCache.get(fileId);
  const stored = fileStore.get(fileId);
  if (!stored) return null;
  return updateBlobUrl(fileId, stored.pdfBytes);
}

/** 下载 PDF */
export function downloadPdf(fileId, filename = 'edited.pdf') {
  const stored = fileStore.get(fileId);
  if (!stored) return;

  const blob = new Blob([stored.pdfBytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** 获取文件字节 */
export function getFileBytes(fileId) {
  const stored = fileStore.get(fileId);
  return stored?.pdfBytes || null;
}

/** 获取文件名 */
export function getFileName(fileId) {
  const stored = fileStore.get(fileId);
  return stored?.name || 'document';
}

/** 获取 PDF 页数 */
export async function getPdfPageCount(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  return doc.numPages;
}

/** 用 pdf.js 提取文本 */
export async function extractTextFromPdf(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pagesText = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pagesText.push(content.items.map(item => item.str).join(' '));
  }
  return pagesText;
}
