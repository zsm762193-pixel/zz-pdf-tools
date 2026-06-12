const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const convertService = require('../services/convertService');
const { deleteFile } = require('../services/tempFileService');
const path = require('path');
const fs = require('fs');

// 格式映射
const FORMAT_MAP = {
  'pdf-to-docx': { ext: '.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  'docx-to-pdf': { ext: '.pdf', mime: 'application/pdf' },
  'pdf-to-xlsx': { ext: '.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  'xlsx-to-pdf': { ext: '.pdf', mime: 'application/pdf' },
  'pdf-to-html': { ext: '.html', mime: 'text/html' },
  'html-to-pdf': { ext: '.pdf', mime: 'application/pdf' },
  'pdf-to-markdown': { ext: '.md', mime: 'text/markdown' },
  'md-to-pdf': { ext: '.pdf', mime: 'application/pdf' },
};

// 转换方法映射
const CONVERT_METHODS = {
  'pdf-to-docx': 'pdfToDocx',
  'docx-to-pdf': 'docxToPdf',
  'pdf-to-xlsx': 'pdfToXlsx',
  'xlsx-to-pdf': 'xlsxToPdf',
  'pdf-to-html': 'pdfToHtml',
  'html-to-pdf': 'htmlToPdf',
  'pdf-to-markdown': 'pdfToMarkdown',
  'md-to-pdf': 'mdToPdf',
};

/**
 * POST /api/convert/:type
 * 格式转换的统一入口
 */
router.post('/:type', upload.single('file'), async (req, res) => {
  try {
    const { type } = req.params;

    if (!FORMAT_MAP[type]) {
      return res.status(400).json({
        error: `不支持的转换类型: ${type}`,
        supported: Object.keys(FORMAT_MAP),
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: '请选择要转换的文件' });
    }

    const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
    const methodName = CONVERT_METHODS[type];

    // 调用对应的转换方法
    const outputPath = await convertService[methodName](fileId);
    const formatInfo = FORMAT_MAP[type];

    // 读取输出文件
    const outputBuffer = fs.readFileSync(outputPath);
    const outputFilename = `converted${formatInfo.ext}`;

    // 返回文件
    res.setHeader('Content-Type', formatInfo.mime);
    res.setHeader('Content-Disposition', `attachment; filename="${outputFilename}"`);
    res.setHeader('Content-Length', outputBuffer.length);
    res.send(outputBuffer);

    // 异步清理临时文件
    setTimeout(() => {
      try {
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      } catch (e) { /* ignore */ }
    }, 5000);

  } catch (err) {
    console.error(`Conversion error (${req.params.type}):`, err.message);
    res.status(500).json({ error: `转换失败: ${err.message}` });
  }
});

/**
 * GET /api/convert/formats
 * 获取支持的转换格式列表
 */
router.get('/formats', (req, res) => {
  res.json({
    formats: [
      { type: 'pdf-to-docx', label: 'PDF → Word', icon: '📄→📝', accept: '.pdf' },
      { type: 'docx-to-pdf', label: 'Word → PDF', icon: '📝→📄', accept: '.docx' },
      { type: 'pdf-to-xlsx', label: 'PDF → Excel', icon: '📄→📊', accept: '.pdf' },
      { type: 'xlsx-to-pdf', label: 'Excel → PDF', icon: '📊→📄', accept: '.xlsx' },
      { type: 'pdf-to-html', label: 'PDF → HTML', icon: '📄→🌐', accept: '.pdf' },
      { type: 'html-to-pdf', label: 'HTML → PDF', icon: '🌐→📄', accept: '.html' },
      { type: 'pdf-to-markdown', label: 'PDF → Markdown', icon: '📄→📋', accept: '.pdf' },
      { type: 'md-to-pdf', label: 'Markdown → PDF', icon: '📋→📄', accept: '.md' },
    ],
  });
});

module.exports = router;
