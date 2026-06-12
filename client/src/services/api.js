/**
 * API 层——全部在浏览器本地执行，无需后端服务器
 */
import * as pdfEngine from './pdfEngine';
import * as convertEngine from './convertEngine';

// ============ PDF 操作 ============

export async function uploadFile(file, onProgress) {
  // 模拟进度
  if (onProgress) {
    onProgress(30);
    await sleep(100);
    onProgress(70);
    await sleep(100);
  }
  const result = await pdfEngine.uploadAndStore(file);
  if (onProgress) onProgress(100);
  return result;
}

export async function getPdfInfo(fileId) {
  return pdfEngine.getPdfInfo(fileId);
}

export async function getPageInfo(fileId, pageNum) {
  return { pageNumber: pageNum };
}

export async function reorderPages(fileId, newOrder) {
  return pdfEngine.reorderPages(fileId, newOrder);
}

export async function deletePages(fileId, pageNumbers) {
  return pdfEngine.deletePages(fileId, pageNumbers);
}

export async function rotatePages(fileId, rotations) {
  return pdfEngine.rotatePages(fileId, rotations);
}

export async function editText(fileId, pageNumber, edits) {
  return pdfEngine.editText(fileId, pageNumber, edits);
}

export async function mergePdf(fileId, file) {
  return pdfEngine.mergePdfs(fileId, file);
}

export function getPdfRenderUrl(fileId) {
  return pdfEngine.getRenderBlobUrl(fileId);
}

export function getDownloadUrl(fileId) {
  // 直接下载，不使用 URL
  return null;
}

export function downloadEditedPdf(fileId) {
  pdfEngine.downloadPdf(fileId);
}

// ============ 格式转换 ============

export async function getConvertFormats() {
  return convertEngine.CONVERT_FORMATS;
}

export async function convertFile(file, convertType, onProgress) {
  if (onProgress) {
    onProgress(10);
    await sleep(100);
    onProgress(40);
  }

  let result;
  const method = convertEngine.CONVERT_METHODS[convertType];
  if (!method) throw new Error(`不支持的转换: ${convertType}`);

  // 如果转换需要 fileId（PDF 来源），需要先上传获取 fileId
  if (convertType.startsWith('pdf-to-')) {
    const { fileId } = await pdfEngine.uploadAndStore(file);
    if (onProgress) onProgress(60);
    result = await method(fileId);
  } else {
    // docx-to-pdf, xlsx-to-pdf, html-to-pdf, md-to-pdf
    // 这些直接传入 file，通过浏览器打印完成
    if (onProgress) onProgress(60);
    result = await method(file);
  }

  if (onProgress) onProgress(100);
  return result;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
