const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { getFilePath } = require('./tempFileService');

/**
 * 加载 PDF 文档
 */
async function loadPdf(fileId) {
  const filePath = getFilePath(`${fileId}.pdf`);
  if (!fs.existsSync(filePath)) {
    // 尝试找原始上传文件
    const files = fs.readdirSync(path.dirname(filePath));
    const match = files.find(f => f.startsWith(fileId));
    if (!match) throw new Error('文件不存在');
    const bytes = fs.readFileSync(path.join(path.dirname(filePath), match));
    return PDFDocument.load(bytes);
  }
  const bytes = fs.readFileSync(filePath);
  return PDFDocument.load(bytes);
}

/**
 * 保存 PDF 文档
 */
async function savePdf(pdfDoc, fileId) {
  const pdfBytes = await pdfDoc.save();
  const filePath = getFilePath(`${fileId}.pdf`);
  fs.writeFileSync(filePath, pdfBytes);
  return filePath;
}

/**
 * 获取 PDF 基本信息
 */
async function getPdfInfo(fileId) {
  const pdfDoc = await loadPdf(fileId);
  const pages = pdfDoc.getPages();
  const info = {
    pageCount: pages.length,
    pages: pages.map((page, index) => ({
      pageNumber: index + 1,
      width: page.getWidth(),
      height: page.getHeight(),
      rotation: page.getRotation().angle,
    })),
  };
  return info;
}

/**
 * 页面重新排序
 */
async function reorderPages(fileId, newOrder) {
  const pdfDoc = await loadPdf(fileId);
  const pages = pdfDoc.getPages();

  // newOrder 是新顺序的页码数组 (1-based)
  // 先移除所有页面，再按新顺序插入
  const pageCount = pages.length;

  // 创建新文档
  const newDoc = await PDFDocument.create();

  for (const pageNum of newOrder) {
    const index = pageNum - 1;
    if (index < 0 || index >= pageCount) continue;
    const [copiedPage] = await newDoc.copyPages(pdfDoc, [index]);
    newDoc.addPage(copiedPage);
  }

  return savePdf(newDoc, fileId);
}

/**
 * 删除指定页面
 */
async function deletePages(fileId, pageNumbers) {
  const pdfDoc = await loadPdf(fileId);
  const pages = pdfDoc.getPages();
  const toDelete = new Set(pageNumbers.map(n => n - 1));

  const newDoc = await PDFDocument.create();
  for (let i = 0; i < pages.length; i++) {
    if (!toDelete.has(i)) {
      const [copiedPage] = await newDoc.copyPages(pdfDoc, [i]);
      newDoc.addPage(copiedPage);
    }
  }

  return savePdf(newDoc, fileId);
}

/**
 * 旋转页面
 */
async function rotatePages(fileId, rotations) {
  // rotations: [{ pageNumber, angle }]  angle: 90, 180, 270
  const pdfDoc = await loadPdf(fileId);
  const pages = pdfDoc.getPages();

  for (const { pageNumber, angle } of rotations) {
    const index = pageNumber - 1;
    if (index >= 0 && index < pages.length) {
      const page = pages[index];
      page.setRotation({ angle: page.getRotation().angle + angle });
    }
  }

  return savePdf(pdfDoc, fileId);
}

/**
 * 合并两个 PDF
 */
async function mergePdfs(fileId1, fileId2) {
  const pdfDoc1 = await loadPdf(fileId1);
  const filePath2 = getFilePath(`${fileId2}.pdf`);
  let pdfDoc2;

  if (fs.existsSync(filePath2)) {
    pdfDoc2 = await PDFDocument.load(fs.readFileSync(filePath2));
  } else {
    // 尝试其他扩展名
    const files = fs.readdirSync(path.dirname(filePath2));
    const match = files.find(f => f.startsWith(fileId2));
    if (!match) throw new Error('要合并的文件不存在');
    pdfDoc2 = await PDFDocument.load(
      fs.readFileSync(path.join(path.dirname(filePath2), match))
    );
  }

  const pages2 = await pdfDoc1.copyPages(pdfDoc2, pdfDoc2.getPageIndices());
  for (const page of pages2) {
    pdfDoc1.addPage(page);
  }

  return savePdf(pdfDoc1, fileId1);
}

/**
 * 编辑文字：在指定位置覆盖文字
 */
async function editText(fileId, pageNumber, edits) {
  // edits: [{ x, y, width, height, text, fontSize, originalText }]
  const pdfDoc = await loadPdf(fileId);
  const pages = pdfDoc.getPages();

  if (pageNumber < 1 || pageNumber > pages.length) {
    throw new Error('页码超出范围');
  }

  const page = pages[pageNumber - 1];
  const pageHeight = page.getHeight();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  for (const edit of edits) {
    // PDF 坐标原点在左下角，需要转换 Y 坐标
    const pdfY = pageHeight - edit.y - edit.height;

    // 先用白色矩形覆盖原有文字
    page.drawRectangle({
      x: edit.x,
      y: pdfY,
      width: edit.width,
      height: edit.height + 2,
      color: rgb(1, 1, 1),
    });

    // 绘制新文字
    const fontSize = edit.fontSize || 12;
    page.drawText(edit.text, {
      x: edit.x,
      y: pdfY + 2,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
  }

  return savePdf(pdfDoc, fileId);
}

/**
 * 提取文字坐标信息（配合 pdfjs-dist 使用，这里仅做结构返回）
 */
async function getTextPositions(fileId, pageNumber) {
  // 文字坐标提取在前端通过 pdfjs-dist 完成
  // 后端只返回页面基本信息
  const pdfDoc = await loadPdf(fileId);
  const pages = pdfDoc.getPages();

  if (pageNumber < 1 || pageNumber > pages.length) {
    throw new Error('页码超出范围');
  }

  const page = pages[pageNumber - 1];
  return {
    pageNumber,
    width: page.getWidth(),
    height: page.getHeight(),
    rotation: page.getRotation().angle,
  };
}

module.exports = {
  loadPdf,
  savePdf,
  getPdfInfo,
  reorderPages,
  deletePages,
  rotatePages,
  mergePdfs,
  editText,
  getTextPositions,
};
