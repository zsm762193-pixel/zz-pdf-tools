import { useState } from 'react';
import Layout from './components/Layout/Layout';
import FileUploader from './components/FileUploader/FileUploader';
import PdfEditor from './components/PdfEditor/PdfEditor';
import Converter from './components/Converter/Converter';
import useStore from './store/useStore';

const TABS = [
  { id: 'editor', label: '📄 PDF 编辑器' },
  { id: 'converter', label: '🔄 格式转换' },
];

function App() {
  const [activeTab, setActiveTab] = useState('editor');
  const { currentFile, setCurrentFile } = useStore();

  const handleFileLoaded = (fileData) => {
    setCurrentFile(fileData);
  };

  const handleBackToUpload = () => {
    setCurrentFile(null);
  };

  return (
    <Layout>
      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'editor' && (
        <div>
          {!currentFile ? (
            <FileUploader
              accept=".pdf"
              label="上传 PDF 文件进行编辑"
              onFileLoaded={handleFileLoaded}
            />
          ) : (
            <PdfEditor onBack={handleBackToUpload} />
          )}
        </div>
      )}

      {activeTab === 'converter' && (
        <Converter />
      )}
    </Layout>
  );
}

export default App;
