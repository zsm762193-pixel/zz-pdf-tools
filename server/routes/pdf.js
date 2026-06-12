const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const pdfService = require('../services/pdfService');
const { getFilePath, deleteFile } = require('../services/tempFileService');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

/**
 * POST /api/pdf/upload
 * 上传 PDF 文件
 */
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择文件' });
    }

    const fileId = path.basename(req.file.filename, path.extname(req.file.filename));

    res.json({
      fileId,
      originalName: req.file.originalname,
      size: req.file.size,
      message: '上传成功',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pdf/:id/info
 * 获取 PDF 信息
 */
router.get('/:id/info', async (req, res) => {
  try {
    const info = await pdfService.getPdfInfo(req.params.id);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pdf/:id/page/:pageNum
 * 获取单页信息（用于文字编辑时的页面数据）
 */
router.get('/:id/page/:pageNum', async (req, res) => {
  try {
    const pageData = await pdfService.getTextPositions(
      req.params.id,
      parseInt(req.params.pageNum)
    );
    res.json(pageData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pdf/:id/reorder
 * 页面重新排序
 * Body: { newOrder: [3, 1, 2] }  // 新顺序的页码数组
 */
router.post('/:id/reorder', async (req, res) => {
  try {
    const { newOrder } = req.body;
    if (!Array.isArray(newOrder) || newOrder.length === 0) {
      return res.status(400).json({ error: '请提供有效的页面顺序' });
    }

    await pdfService.reorderPages(req.params.id, newOrder);
    res.json({ message: '页面顺序已更新' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pdf/:id/delete-pages
 * 删除页面
 * Body: { pageNumbers: [2, 5] }
 */
router.post('/:id/delete-pages', async (req, res) => {
  try {
    const { pageNumbers } = req.body;
    if (!Array.isArray(pageNumbers) || pageNumbers.length === 0) {
      return res.status(400).json({ error: '请提供要删除的页码' });
    }

    await pdfService.deletePages(req.params.id, pageNumbers);
    res.json({ message: `已删除 ${pageNumbers.length} 页` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pdf/:id/rotate
 * 旋转页面
 * Body: { rotations: [{ pageNumber: 1, angle: 90 }] }
 */
router.post('/:id/rotate', async (req, res) => {
  try {
    const { rotations } = req.body;
    if (!Array.isArray(rotations) || rotations.length === 0) {
      return res.status(400).json({ error: '请提供旋转参数' });
    }

    await pdfService.rotatePages(req.params.id, rotations);
    res.json({ message: '页面已旋转' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pdf/:id/edit-text
 * 编辑文字
 * Body: { pageNumber, edits: [{ x, y, width, height, text, fontSize }] }
 */
router.post('/:id/edit-text', async (req, res) => {
  try {
    const { pageNumber, edits } = req.body;
    if (!pageNumber || !Array.isArray(edits) || edits.length === 0) {
      return res.status(400).json({ error: '请提供编辑参数' });
    }

    await pdfService.editText(req.params.id, pageNumber, edits);
    res.json({ message: '文字已编辑' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/pdf/:id/merge
 * 合并另一个 PDF
 * Body: 使用 FormData，字段名为 'file'
 */
router.post('/:id/merge', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要合并的 PDF 文件' });
    }

    const fileId2 = path.basename(req.file.filename, path.extname(req.file.filename));
    await pdfService.mergePdfs(req.params.id, fileId2);
    res.json({ message: 'PDF 合并成功' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pdf/:id/download
 * 下载处理后的 PDF
 */
router.get('/:id/download', (req, res) => {
  try {
    const filePath = getFilePath(`${req.params.id}.pdf`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在或已过期' });
    }

    res.download(filePath, `edited.pdf`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/pdf/:id/render
 * 获取 PDF 文件用于前端渲染
 */
router.get('/:id/render', (req, res) => {
  try {
    const filePath = getFilePath(`${req.params.id}.pdf`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在或已过期' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
