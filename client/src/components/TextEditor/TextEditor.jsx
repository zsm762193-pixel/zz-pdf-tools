import { useState, useEffect, useCallback, useRef } from 'react';
import useStore from '../../store/useStore';
import { editText } from '../../services/api';

/**
 * 文字编辑器
 * 监听 PDF 文字层的点击事件，弹出编辑框
 */
function TextEditor({ fileId, containerRef, onTextEdited }) {
  const [selectedText, setSelectedText] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [popupPos, setPopupPos] = useState({ x: 0, y: 0 });
  const inputRef = useRef(null);
  const { setError } = useStore();

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    const handleClick = (e) => {
      const target = e.target;
      // 检查是否点击了文字层的 span
      if (target.tagName === 'SPAN' && target.closest('.textLayer')) {
        const rect = target.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        setSelectedText({
          text: target.dataset.text || target.textContent,
          x: parseFloat(target.dataset.x || 0),
          y: parseFloat(target.dataset.y || 0),
          width: parseFloat(target.dataset.width || rect.width),
          height: parseFloat(target.dataset.height || rect.height),
          fontSize: parseFloat(target.dataset.fontSize || 12),
          element: target,
        });
        setEditValue(target.dataset.text || target.textContent);

        // 计算弹窗位置
        setPopupPos({
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.bottom - containerRect.top + 8,
        });

        // 高亮选中文字
        document.querySelectorAll('.textLayer .selected').forEach(el => el.classList.remove('selected'));
        target.classList.add('selected');
      } else if (!target.closest('.text-editor-popup')) {
        // 点击其他区域取消选中
        setSelectedText(null);
        document.querySelectorAll('.textLayer .selected').forEach(el => el.classList.remove('selected'));
      }
    };

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [containerRef]);

  // 自动聚焦输入框
  useEffect(() => {
    if (selectedText && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selectedText]);

  const handleSave = useCallback(async () => {
    if (!selectedText || !editValue.trim()) return;
    if (editValue === selectedText.text) {
      setSelectedText(null);
      return;
    }

    setSaving(true);
    try {
      // 获取当前页码
      const pageEl = selectedText.element.closest('[id^="pdf-page-"]');
      const pageNumber = pageEl ? parseInt(pageEl.id.replace('pdf-page-', '')) : 1;

      await editText(fileId, pageNumber, [{
        x: selectedText.x,
        y: selectedText.y,
        width: Math.max(selectedText.width, editValue.length * selectedText.fontSize * 0.6),
        height: selectedText.height,
        text: editValue,
        fontSize: selectedText.fontSize,
        originalText: selectedText.text,
      }]);

      // 更新文字层的显示
      if (selectedText.element) {
        selectedText.element.textContent = editValue;
        selectedText.element.dataset.text = editValue;
        selectedText.element.style.width = `${Math.max(selectedText.width, editValue.length * selectedText.fontSize * 0.6)}px`;
      }

      if (onTextEdited) onTextEdited();
    } catch (err) {
      setError(err.response?.data?.error || '文字编辑失败');
    } finally {
      setSaving(false);
      setSelectedText(null);
      document.querySelectorAll('.textLayer .selected').forEach(el => el.classList.remove('selected'));
    }
  }, [selectedText, editValue, fileId, onTextEdited, setError]);

  const handleCancel = () => {
    setSelectedText(null);
    document.querySelectorAll('.textLayer .selected').forEach(el => el.classList.remove('selected'));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!selectedText) return null;

  return (
    <div
      className="text-editor-popup absolute z-50 bg-white rounded-xl shadow-2xl border border-gray-200 p-4 min-w-[280px]"
      style={{
        left: `${popupPos.x}px`,
        top: `${popupPos.y}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="text-xs text-gray-400 mb-2">
        编辑文字 (原: "{selectedText.text.substring(0, 30)}{selectedText.text.length > 30 ? '...' : ''}")
      </div>
      <textarea
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full border border-gray-300 rounded-lg p-2 text-sm resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        rows={2}
        placeholder="输入新文字..."
      />
      <div className="flex justify-end gap-2 mt-3">
        <button
          onClick={handleCancel}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !editValue.trim()}
          className="btn-primary text-xs px-3 py-1.5"
        >
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  );
}

export default TextEditor;
