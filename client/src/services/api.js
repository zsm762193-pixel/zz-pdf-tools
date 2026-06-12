import axios from 'axios';
import { API_URL } from '../config';

const api = axios.create({
  baseURL: API_URL || '/api',
  timeout: 120000, // 2 分钟超时（转换可能需要时间）
});

const apiBase = API_URL || '';

/**
 * 上传文件
 */
export async function uploadFile(file, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post('/pdf/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 100) / e.total));
      }
    },
  });
  return data;
}

/**
 * 获取 PDF 信息
 */
export async function getPdfInfo(fileId) {
  const { data } = await api.get(`/pdf/${fileId}/info`);
  return data;
}

/**
 * 获取单页信息
 */
export async function getPageInfo(fileId, pageNum) {
  const { data } = await api.get(`/pdf/${fileId}/page/${pageNum}`);
  return data;
}

/**
 * 页面重新排序
 */
export async function reorderPages(fileId, newOrder) {
  const { data } = await api.post(`/pdf/${fileId}/reorder`, { newOrder });
  return data;
}

/**
 * 删除页面
 */
export async function deletePages(fileId, pageNumbers) {
  const { data } = await api.post(`/pdf/${fileId}/delete-pages`, { pageNumbers });
  return data;
}

/**
 * 旋转页面
 */
export async function rotatePages(fileId, rotations) {
  const { data } = await api.post(`/pdf/${fileId}/rotate`, { rotations });
  return data;
}

/**
 * 编辑文字
 */
export async function editText(fileId, pageNumber, edits) {
  const { data } = await api.post(`/pdf/${fileId}/edit-text`, { pageNumber, edits });
  return data;
}

/**
 * 合并 PDF
 */
export async function mergePdf(fileId, file) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post(`/pdf/${fileId}/merge`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

/**
 * 获取 PDF 渲染 URL
 */
export function getPdfRenderUrl(fileId) {
  return `${apiBase}/api/pdf/${fileId}/render`;
}

/**
 * 获取下载 URL
 */
export function getDownloadUrl(fileId) {
  return `${apiBase}/api/pdf/${fileId}/download`;
}

/**
 * 获取支持的转换格式
 */
export async function getConvertFormats() {
  const { data } = await api.get('/convert/formats');
  return data.formats;
}

/**
 * 格式转换
 */
export async function convertFile(file, convertType, onProgress) {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await api.post(`/convert/${convertType}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob',
    onUploadProgress: (e) => {
      if (onProgress && e.total) {
        onProgress(Math.round((e.loaded * 60) / e.total)); // 上传占 60%
      }
    },
  });
  return data;
}

export default api;
