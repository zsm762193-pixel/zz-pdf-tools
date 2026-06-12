const express = require('express');
const cors = require('cors');
const path = require('path');
const pdfRoutes = require('./routes/pdf');
const convertRoutes = require('./routes/convert');
const { initCleanup } = require('./services/tempFileService');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 配置 - 支持前端部署到 GitHub Pages
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: function (origin, callback) {
    // 允许没有 origin 的请求（如 curl、同源请求）
    if (!origin) return callback(null, true);
    // 检查是否在允许列表中
    if (corsOrigins.some(allowed => origin.startsWith(allowed.replace('*', '')))) {
      return callback(null, true);
    }
    // 允许所有 github.io 和 localhost
    if (origin.includes('github.io') || origin.includes('localhost')) {
      return callback(null, true);
    }
    callback(null, true); // 在生产环境宽松处理
  },
  credentials: true,
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 静态文件
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API 路由
app.use('/api/pdf', pdfRoutes);
app.use('/api/convert', convertRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 初始化临时文件清理（每30分钟清理超过1小时的文件）
initCleanup(30, 60);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
