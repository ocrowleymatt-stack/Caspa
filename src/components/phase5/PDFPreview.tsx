import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react';

interface PDFPreviewProps {
  pdfUrl: string;
  title: string;
  onClose: () => void;
  onDownload: () => void;
}

export const PDFPreview: React.FC<PDFPreviewProps> = ({
  pdfUrl,
  title,
  onClose,
  onDownload,
}) => {
  const [zoom, setZoom] = useState(100);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-2xl w-11/12 h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600">Zoom: {zoom}%</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 10))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 10))}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-semibold"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto bg-gray-100 flex items-center justify-center">
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
            }}
            className="bg-white shadow-lg"
          >
            <iframe
              src={`${pdfUrl}#zoom=${zoom}`}
              className="w-full h-full"
              style={{ width: '8.5in', height: '11in' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
