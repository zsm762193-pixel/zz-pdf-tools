import { useEffect, useRef, useCallback, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { getPdfRenderUrl } from '../../services/api';
import useStore from '../../store/useStore';

// 设置 PDF.js worker — 使用本地版本
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

/**
 * PDF 页面渲染组件（单页）
 */
function PdfPage({ fileId, pageNumber, scale = 1.5, onTextLayerReady, version }) {
  const canvasRef = useRef(null);
  const textLayerRef = useRef(null);
  const containerRef = useRef(null);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    const renderPage = async () => {
      try {
        const pdfUrl = getPdfRenderUrl(fileId);
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        const page = await pdf.getPage(pageNumber);

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        setPageSize({ width: viewport.width, height: viewport.height });

        await page.render({
          canvasContext: ctx,
          viewport: viewport,
        }).promise;

        // 获取文字坐标
        if (onTextLayerReady && textLayerRef.current) {
          const textContent = await page.getTextContent();
          const textLayer = textLayerRef.current;
          textLayer.innerHTML = '';

          textContent.items.forEach((item) => {
            if (!item.str || item.str.trim() === '') return;

            const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
            const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);

            const span = document.createElement('span');
            span.textContent = item.str;
            span.style.left = `${tx[4]}px`;
            span.style.top = `${tx[5] - fontSize}px`;
            span.style.fontSize = `${fontSize}px`;
            span.style.height = `${fontSize * 1.2}px`;
            span.dataset.x = tx[4];
            span.dataset.y = tx[5] - fontSize;
            span.dataset.width = item.width * scale;
            span.dataset.height = fontSize * 1.2;
            span.dataset.text = item.str;
            span.dataset.fontSize = fontSize;

            textLayer.appendChild(span);
          });

          onTextLayerReady(textContent);
        }
      } catch (err) {
        console.error('Render page error:', err);
      }
    };

    renderPage();
    return () => { cancelled = true; };
  }, [fileId, pageNumber, scale, version]);

  return (
    <div ref={containerRef} className="relative inline-block shadow-lg">
      <canvas ref={canvasRef} className="block" />
      <div ref={textLayerRef} className="textLayer" />
    </div>
  );
}

/**
 * PDF 查看器（多页滚动）
 */
function PdfViewer({ fileId, currentPage, onPageChange, onTextClick }) {
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const pageRefs = useRef({});
  const pdfVersion = useStore((s) => s.pdfVersion);

  useEffect(() => {
    const loadInfo = async () => {
      try {
        const pdfUrl = getPdfRenderUrl(fileId);
        const pdf = await pdfjsLib.getDocument(pdfUrl).promise;
        setTotalPages(pdf.numPages);
      } catch (err) {
        console.error('Load PDF info error:', err);
      }
    };
    loadInfo();
  }, [fileId]);

  const handleTextLayerReady = useCallback((pageNum) => (textContent) => {
    // 存储文字内容供点击检测使用
    if (pageRefs.current) {
      pageRefs.current[pageNum] = textContent;
    }
  }, []);

  useEffect(() => {
    // 滚动到当前页
    if (currentPage) {
      const el = document.getElementById(`pdf-page-${currentPage}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [currentPage]);

  const zoomIn = () => setScale(s => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale(s => Math.max(s - 0.25, 0.5));

  return (
    <div>
      {/* 缩放控制 */}
      <div className="flex items-center gap-3 mb-4 bg-white rounded-lg p-2 shadow-sm border sticky top-16 z-10">
        <button onClick={zoomOut} className="btn-secondary px-3 py-1 text-sm" title="缩小">🔍−</button>
        <span className="text-sm text-gray-600 font-medium">{Math.round(scale * 100)}%</span>
        <button onClick={zoomIn} className="btn-secondary px-3 py-1 text-sm" title="放大">🔍+</button>
        <span className="text-xs text-gray-400 ml-2">共 {totalPages} 页</span>
      </div>

      {/* 所有页面 */}
      <div className="space-y-4">
        {Array.from({ length: totalPages }, (_, i) => (
          <div
            key={i + 1}
            id={`pdf-page-${i + 1}`}
            className="flex justify-center"
          >
            <div className="relative">
              <PdfPage
                fileId={fileId}
                pageNumber={i + 1}
                scale={scale}
                version={pdfVersion}
                onTextLayerReady={handleTextLayerReady(i + 1)}
              />
              <div className="text-center text-xs text-gray-400 mt-1">
                第 {i + 1} 页
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { PdfPage };
export default PdfViewer;
