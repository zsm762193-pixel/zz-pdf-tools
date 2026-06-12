import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getPdfRenderUrl, reorderPages, deletePages, rotatePages } from '../../services/api';

/**
 * 可拖拽排序的缩略图卡片
 */
function SortableThumbnail({ page, isSelected, onSelect, onRotate, onDelete }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.pageNumber });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 rounded-lg cursor-pointer border-2 transition-all
        ${isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow'
        }
        ${isDragging ? 'shadow-xl scale-105' : ''}
      `}
      onClick={() => onSelect(page.pageNumber)}
    >
      {/* 拖拽手柄 */}
      <div {...attributes} {...listeners} className="cursor-grab text-gray-400 hover:text-gray-600 px-1">
        ⠿
      </div>

      {/* 缩略图 */}
      <div className="flex-shrink-0 w-16 h-20 bg-gray-100 rounded overflow-hidden border">
        <ThumbnailImage page={page} />
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-700">第 {page.pageNumber} 页</p>
        {page.rotation > 0 && (
          <p className="text-xs text-orange-500">已旋转 {page.rotation}°</p>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
        <button
          onClick={() => onRotate(page.pageNumber, -90)}
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
          title="逆时针旋转 90°"
        >
          ↩
        </button>
        <button
          onClick={() => onRotate(page.pageNumber, 90)}
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
          title="顺时针旋转 90°"
        >
          ↪
        </button>
        <button
          onClick={() => onDelete(page.pageNumber)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          title="删除此页"
        >
          🗑
        </button>
      </div>
    </div>
  );
}

/**
 * 缩略图组件
 */
function ThumbnailImage({ page }) {
  const [imgUrl, setImgUrl] = useState(null);

  useEffect(() => {
    // 用 canvas 生成缩略图
    let cancelled = false;
    const load = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        const pdf = await pdfjsLib.getDocument(getPdfRenderUrl(page.fileId)).promise;
        const pdfPage = await pdf.getPage(page.pageNumber);
        const viewport = pdfPage.getViewport({ scale: 0.3 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await pdfPage.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
        }).promise;
        if (!cancelled) setImgUrl(canvas.toDataURL());
      } catch (e) {
        // 缩略图加载失败不显示
      }
    };
    if (page.fileId) load();
    return () => { cancelled = true; };
  }, [page.fileId, page.pageNumber]);

  if (!imgUrl) {
    return <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">加载中</div>;
  }

  return <img src={imgUrl} alt={`Page ${page.pageNumber}`} className="w-full h-full object-cover" />;
}

/**
 * 页面管理器
 */
function PageManager({ fileId, pages, currentPage, onSelectPage, onPagesUpdated }) {
  const [sortedPages, setSortedPages] = useState([]);
  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  useEffect(() => {
    setSortedPages(pages.map((p, i) => ({ ...p, id: p.pageNumber, fileId })));
  }, [pages, fileId]);

  // 拖拽结束处理
  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSortedPages((items) => {
      const oldIndex = items.findIndex(item => item.id === active.id);
      const newIndex = items.findIndex(item => item.id === over.id);
      const newItems = [...items];
      const [moved] = newItems.splice(oldIndex, 1);
      newItems.splice(newIndex, 0, moved);
      return newItems;
    });

    // 立即保存新顺序
    setSaving(true);
    try {
      const newOrder = sortedPages.map(p => p.pageNumber);
      // 计算实际的新顺序
      const oldIndex = sortedPages.findIndex(item => item.id === active.id);
      const newIndex = sortedPages.findIndex(item => item.id === over.id);
      const reordered = [...newOrder];
      const [moved] = reordered.splice(oldIndex, 1);
      reordered.splice(newIndex, 0, moved);

      await reorderPages(fileId, reordered);
      if (onPagesUpdated) onPagesUpdated();
    } catch (err) {
      console.error('Reorder error:', err);
    } finally {
      setSaving(false);
    }
  };

  // 旋转页面
  const handleRotate = async (pageNumber, angle) => {
    setSaving(true);
    try {
      await rotatePages(fileId, [{ pageNumber, angle }]);
      if (onPagesUpdated) onPagesUpdated();
    } catch (err) {
      console.error('Rotate error:', err);
    } finally {
      setSaving(false);
    }
  };

  // 删除页面
  const handleDelete = async (pageNumber) => {
    if (!confirm(`确定要删除第 ${pageNumber} 页吗？`)) return;
    if (sortedPages.length <= 1) {
      alert('至少保留一页');
      return;
    }

    setSaving(true);
    try {
      await deletePages(fileId, [pageNumber]);
      if (onPagesUpdated) onPagesUpdated();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-700">📑 页面管理</h3>
        <span className="text-xs text-gray-400">{sortedPages.length} 页 | 拖拽排序</span>
      </div>

      {saving && (
        <div className="mb-3 text-xs text-blue-500 animate-pulse">⏳ 保存中...</div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sortedPages.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {sortedPages.map((page) => (
              <SortableThumbnail
                key={page.id}
                page={page}
                isSelected={page.pageNumber === currentPage}
                onSelect={onSelectPage}
                onRotate={handleRotate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default PageManager;
