import React, { useState, useRef, useEffect } from 'react';
import { DocumentReviewPanel } from '../components/phase5/DocumentReviewPanel';
import { DesignEditor } from '../components/phase5/DesignEditor';
import { PDFPreview } from '../components/phase5/PDFPreview';
import { BookOpen, Settings, Share2, FileText } from 'lucide-react';

interface DesignOptions {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  accentColor: string;
  maxWidth: number;
}

const defaultDesignOptions: DesignOptions = {
  fontFamily: 'Inter',
  fontSize: 16,
  lineHeight: 15,
  accentColor: '#3B82F6',
  maxWidth: 800,
};

export const EditorPage: React.FC = () => {
  const [title, setTitle] = useState('Your Story');
  const [content, setContent] = useState('Start writing here...');
  const [format, setFormat] = useState<'screen' | 'professional'>('screen');
  const [showPreview, setShowPreview] = useState(false);
  const [showDesignEditor, setShowDesignEditor] = useState(false);
  const [designOptions, setDesignOptions] = useState(defaultDesignOptions);
  const [wordCount, setWordCount] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Calculate word count
  useEffect(() => {
    const words = content.trim().split(/\s+/).length;
    setWordCount(words);
    const cost = format === 'professional' ? (words / 1000) * 0.02 : (words / 1000) * 0.01;
    setEstimatedCost(cost);
  }, [content, format]);

  const estimatedReadTime = Math.ceil(wordCount / 200);

  return (
    <div className="flex h-screen bg-white">
      {/* Main Editor */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-blue-600" />
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-bold text-gray-900 bg-transparent border-0 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex bg-gray-200 rounded-lg p-1">
              <button
                onClick={() => setFormat('screen')}
                className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                  format === 'screen'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                📱 Digital
              </button>
              <button
                onClick={() => setFormat('professional')}
                className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
                  format === 'professional'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-700 hover:text-gray-900'
                }`}
              >
                📖 Print-Ready
              </button>
            </div>

            <button
              onClick={() => setShowDesignEditor(!showDesignEditor)}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              title="Customize appearance"
            >
              <Settings className="w-5 h-5 text-gray-700" />
            </button>

            <button
              onClick={() => setShowPreview(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-semibold"
            >
              <FileText className="w-4 h-4" />
              Preview
            </button>
          </div>
        </div>

        {/* Editor & Design Panel */}
        <div className="flex-1 flex overflow-hidden">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="flex-1 p-8 font-serif text-gray-900 resize-none focus:outline-none"
            placeholder="Start writing your story..."
            style={{
              fontFamily: designOptions.fontFamily,
              fontSize: `${designOptions.fontSize}px`,
              lineHeight: `${designOptions.lineHeight / 10}`,
            }}
          />

          {showDesignEditor && (
            <div className="w-80 border-l border-gray-200 p-6 overflow-y-auto bg-white">
              <DesignEditor
                options={designOptions}
                onChange={setDesignOptions}
                onReset={() => setDesignOptions(defaultDesignOptions)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Review Panel */}
      <DocumentReviewPanel
        title={title}
        wordCount={wordCount}
        estimatedReadTime={estimatedReadTime}
        estimatedCost={estimatedCost}
        format={format}
        onPreview={() => setShowPreview(true)}
      />

      {showPreview && (
        <PDFPreview
          pdfUrl="/api/preview"
          title={title}
          onClose={() => setShowPreview(false)}
          onDownload={() => alert('Export feature')}
        />
      )}
    </div>
  );
};
