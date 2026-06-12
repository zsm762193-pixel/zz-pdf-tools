import { useState, useEffect, useRef } from 'react';
import { getConvertFormats, convertFile } from '../../services/api';

function Converter() {
  const [formats, setFormats] = useState([]);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [file, setFile] = useState(null);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    getConvertFormats().then(setFormats).catch(console.error);
  }, []);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f) setFile(f);
  };

  const handleConvert = async () => {
    if (!file || !selectedFormat) return;

    setConverting(true);
    setProgress(0);
    setResult(null);

    try {
      const res = await convertFile(file, selectedFormat.type, (p) => {
        setProgress(p);
      });

      setProgress(100);
      setResult({ name: res.name || 'converted' });

    } catch (err) {
      console.error('Convert error:', err);
      alert('转换失败: ' + (err.message || '未知错误'));
    } finally {
      setConverting(false);
    }
  };

  return (
    <div>
      {/* 格式选择 */}
      <div className="card mb-4">
        <h2 className="font-semibold text-gray-700 mb-4">选择转换类型</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {formats.map((fmt) => (
            <button
              key={fmt.type}
              onClick={() => setSelectedFormat(fmt)}
              disabled={converting}
              className={`
                p-4 rounded-xl border-2 text-center transition-all
                ${selectedFormat?.type === fmt.type
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow'
                }
              `}
            >
              <div className="text-2xl mb-1">
                {fmt.icon.split('→')[0]}→{fmt.icon.split('→')[1]}
              </div>
              <div className="text-xs font-medium text-gray-700">{fmt.label}</div>
              <div className="text-xs text-gray-400">{fmt.accept}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 文件上传区域 */}
      {selectedFormat && (
        <div className="card">
          <h3 className="font-semibold text-gray-700 mb-3">
            上传文件: {selectedFormat.label}
          </h3>

          <div
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}
            `}
            onDrop={handleFileDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={selectedFormat.accept}
              onChange={handleFileChange}
              className="hidden"
            />

            {file ? (
              <div className="space-y-2">
                <div className="text-3xl">📄</div>
                <p className="font-medium text-gray-700">{file.name}</p>
                <p className="text-xs text-gray-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <button
                  onClick={(e) => { e.stopPropagation(); setFile(null); }}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  移除
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-4xl">📁</div>
                <p className="text-gray-500">拖拽文件到此处或点击选择</p>
                <p className="text-xs text-gray-400">
                  接受 {selectedFormat.accept} 格式
                </p>
              </div>
            )}
          </div>

          {/* 转换按钮 */}
          <div className="mt-4 flex items-center gap-4">
            <button
              onClick={handleConvert}
              disabled={!file || converting}
              className="btn-primary flex-1"
            >
              {converting ? `转换中 ${progress}%` : '🔄 开始转换'}
            </button>

          </div>

          {/* 进度条 */}
          {converting && (
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          {/* 结果提示 */}
          {result && !converting && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              ✅ 转换完成！文件已处理: {result.name}
              <button
                onClick={() => { setResult(null); setFile(null); }}
                className="ml-3 underline"
              >
                重新转换
              </button>
            </div>
          )}
        </div>
      )}

      {/* 未选择格式时的提示 */}
      {!selectedFormat && (
        <div className="card text-center py-12">
          <div className="text-5xl mb-4">🔄</div>
          <p className="text-gray-500">请先在上方选择一种转换类型</p>
          <p className="text-xs text-gray-400 mt-2">
            支持 PDF、Word、Excel、HTML、Markdown 之间的格式转换
          </p>
        </div>
      )}
    </div>
  );
}

export default Converter;
