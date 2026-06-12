import { useState, useCallback, useRef } from 'react';
import { uploadFile } from '../../services/api';

function FileUploader({ accept = '.pdf', label = '上传文件', onFileLoaded, multiple = false }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const getAcceptLabel = () => {
    if (accept === '.pdf') return 'PDF';
    const parts = accept.split(',').map(p => p.trim().replace('.', '').toUpperCase());
    return parts.join('、');
  };

  const handleFile = useCallback(async (file) => {
    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      const result = await uploadFile(file, setProgress);
      onFileLoaded(result);
    } catch (err) {
      setError(err.response?.data?.error || err.message || '上传失败');
    } finally {
      setUploading(false);
    }
  }, [onFileLoaded]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="card max-w-xl mx-auto">
      <div
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragOver
            ? 'border-blue-500 bg-blue-50 scale-[1.02]'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
          }
          ${uploading ? 'pointer-events-none opacity-70' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-4">
            <div className="animate-pulse text-4xl">⏳</div>
            <p className="text-gray-600 font-medium">正在上传...</p>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-400">{progress}%</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-5xl">📁</div>
            <p className="text-lg font-medium text-gray-700">{label}</p>
            <p className="text-sm text-gray-400">
              拖拽 {getAcceptLabel()} 文件到此处，或点击选择
            </p>
            <p className="text-xs text-gray-300">
              最大支持 100MB
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          ❌ {error}
          <button
            className="ml-3 underline"
            onClick={() => setError(null)}
          >
            关闭
          </button>
        </div>
      )}
    </div>
  );
}

export default FileUploader;
