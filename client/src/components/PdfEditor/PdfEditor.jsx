import { useState, useEffect, useRef, useCallback } from 'react';
import useStore from '../../store/useStore';
import PdfViewer from '../PdfViewer/PdfViewer';
import PageManager from '../PageManager/PageManager';
import TextEditor from '../TextEditor/TextEditor';
import { getPdfInfo, downloadEditedPdf, mergePdf } from '../../services/api';

function PdfEditor({ onBack }) {
  const { currentFile, pdfInfo, setPdfInfo, pages, setPages, currentPage, setCurrentPage } = useStore();
  const [showPages, setShowPages] = useState(true);
  const [merging, setMerging] = useState(false);
  const mergeInputRef = useRef(null);
  const mainRef = useRef(null);

  // 加载 PDF 信息
  const loadPdfInfo = useCallback(async () => {
    if (!currentFile?.fileId) return;
    try {
      const info = await getPdfInfo(currentFile.fileId);
      setPdfInfo(info);
      setPages(info.pages.map((p, i) => ({
        ...p,
        id: p.pageNumber,
        fileId: currentFile.fileId,
      })));
    } catch (err) {
      console.error('Load PDF info error:', err);
    }
  }, [currentFile?.fileId, setPdfInfo, setPages]);

  useEffect(() => {
    loadPdfInfo();
  }, [loadPdfInfo]);

  // 处理页面选择
  const handleSelectPage = (pageNum) => {
    setCurrentPage(pageNum);
  };

  // 处理文字编辑完成
  const handleTextEdited = () => {
    // 刷新 PDF 信息
    loadPdfInfo();
  };

  // 合并 PDF
  const handleMerge = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setMerging(true);
    try {
      await mergePdf(currentFile.fileId, file);
      alert('PDF 合并成功！页面列表已更新。');
      await loadPdfInfo();
    } catch (err) {
      alert(`合并失败: ${err.response?.data?.error || err.message}`);
    } finally {
      setMerging(false);
      if (mergeInputRef.current) mergeInputRef.current.value = '';
    }
  };

  if (!currentFile) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400">请先上传 PDF 文件</p>
        <button onClick={onBack} className="btn-primary mt-4">返回上传</button>
      </div>
    );
  }

  return (
    <div className="flex gap-4" ref={mainRef}>
      {/* 左侧：页面管理侧边栏 */}
      <div className={`flex-shrink-0 transition-all ${showPages ? 'w-72' : 'w-0'}`}>
        {showPages && pages && (
          <div className="sticky top-20">
            <div className="mb-3 flex justify-between items-center">
              <button
                onClick={() => setShowPages(false)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕ 隐藏
              </button>
            </div>
            <PageManager
              fileId={currentFile.fileId}
              pages={pages}
              currentPage={currentPage}
              onSelectPage={handleSelectPage}
              onPagesUpdated={loadPdfInfo}
            />
          </div>
        )}
        {!showPages && (
          <button
            onClick={() => setShowPages(true)}
            className="btn-secondary text-xs sticky top-20"
          >
            ☰ 页面
          </button>
        )}
      </div>

      {/* 右侧：PDF 预览区 */}
      <div className="flex-1 min-w-0">
        {/* 工具栏 */}
        <div className="card mb-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="btn-secondary text-sm">
              ← 返回
            </button>
            <span className="text-sm text-gray-600">
              📄 {currentFile.originalName}
            </span>
            {pdfInfo && (
              <span className="text-xs text-gray-400">
                {pdfInfo.pageCount} 页
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* 合并 PDF */}
            <label className={`btn-secondary text-xs cursor-pointer ${merging ? 'opacity-50' : ''}`}>
              {merging ? '合并中...' : '📎 合并 PDF'}
              <input
                ref={mergeInputRef}
                type="file"
                accept=".pdf"
                onChange={handleMerge}
                className="hidden"
                disabled={merging}
              />
            </label>

            {/* 下载 */}
            <button
              onClick={() => downloadEditedPdf(currentFile.fileId)}
              className="btn-success text-xs"
            >
              💾 下载 PDF
            </button>
          </div>
        </div>

        {/* PDF 预览 + 文字编辑 */}
        <div className="relative">
          <PdfViewer
            fileId={currentFile.fileId}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
          <TextEditor
            fileId={currentFile.fileId}
            containerRef={mainRef}
            onTextEdited={handleTextEdited}
          />
        </div>
      </div>
    </div>
  );
}

export default PdfEditor;
