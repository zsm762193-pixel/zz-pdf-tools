import { create } from 'zustand';

const useStore = create((set) => ({
  // 当前编辑的 PDF 文件信息
  currentFile: null,
  setCurrentFile: (file) => set({ currentFile: file }),

  // PDF 文档信息
  pdfInfo: null,
  setPdfInfo: (info) => set({ pdfInfo: info }),

  // 页面列表（用于排序）
  pages: [],
  setPages: (pages) => set({ pages }),

  // 当前选中的页面
  currentPage: 1,
  setCurrentPage: (page) => set({ currentPage: page }),

  // 文本编辑状态
  editingText: null,
  setEditingText: (text) => set({ editingText: text }),

  // 加载状态
  loading: false,
  setLoading: (loading) => set({ loading }),

  // 错误信息
  error: null,
  setError: (error) => set({ error }),
}));

export default useStore;
