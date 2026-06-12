const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/**
 * 获取文件的绝对路径
 */
function getFilePath(filename) {
  return path.join(UPLOADS_DIR, filename);
}

/**
 * 删除单个临时文件
 */
function deleteFile(filename) {
  const filePath = getFilePath(filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

/**
 * 清理过期文件
 * @param {number} maxAgeMinutes - 文件最大保留时间（分钟）
 */
function cleanupOldFiles(maxAgeMinutes = 60) {
  const now = Date.now();
  const maxAge = maxAgeMinutes * 60 * 1000;

  try {
    const files = fs.readdirSync(UPLOADS_DIR);
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > maxAge) {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up old file: ${file}`);
      }
    }
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}

/**
 * 初始化定时清理任务
 */
function initCleanup(intervalMinutes = 30, maxAgeMinutes = 60) {
  console.log(`Temp file cleanup: every ${intervalMinutes}min, max age ${maxAgeMinutes}min`);
  // 启动时立即清理一次
  cleanupOldFiles(maxAgeMinutes);
  // 定时清理
  setInterval(() => cleanupOldFiles(maxAgeMinutes), intervalMinutes * 60 * 1000);
}

module.exports = { getFilePath, deleteFile, cleanupOldFiles, initCleanup };
