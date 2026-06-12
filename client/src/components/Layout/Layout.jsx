function Layout({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">PDF</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800">ZZ PDF 工具箱</h1>
              <p className="text-xs text-gray-500">在线编辑 · 格式转换</p>
            </div>
          </div>
          <div className="text-xs text-gray-400">
            支持 PDF、Word、Excel、HTML、Markdown
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-gray-400">
        ZZ PDF 工具箱 — 文件仅在服务器保留1小时，请及时下载
      </footer>
    </div>
  );
}

export default Layout;
