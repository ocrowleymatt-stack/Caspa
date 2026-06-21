import React, { useState } from 'react';
import { FileText, Clock, DollarSign, Eye } from 'lucide-react';

interface ReviewPanelProps {
  title: string;
  wordCount: number;
  estimatedReadTime: number;
  estimatedCost: number;
  format: 'screen' | 'professional';
  onPreview: () => void;
}

export const DocumentReviewPanel: React.FC<ReviewPanelProps> = ({
  title,
  wordCount,
  estimatedReadTime,
  estimatedCost,
  format,
  onPreview,
}) => {
  return (
    <div className="border-l border-gray-200 p-8 bg-gray-50 h-full overflow-y-auto">
      <div className="max-w-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">{title}</h2>
        
        {/* Quick Stats */}
        <div className="space-y-6 mb-8">
          <div className="flex items-start gap-4">
            <FileText className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-600">Length</p>
              <p className="text-lg font-semibold text-gray-900">{wordCount.toLocaleString()} words</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <Clock className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-600">Reading time</p>
              <p className="text-lg font-semibold text-gray-900">{estimatedReadTime} min</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <DollarSign className="w-5 h-5 text-blue-600 mt-1 flex-shrink-0" />
            <div>
              <p className="text-sm text-gray-600">Format cost</p>
              <p className="text-lg font-semibold text-gray-900">${estimatedCost.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-1">{format === 'professional' ? 'Print-ready' : 'Digital'}</p>
            </div>
          </div>
        </div>

        {/* Preview Button */}
        <button
          onClick={onPreview}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <Eye className="w-5 h-5" />
          Preview Your Document
        </button>

        {/* Smart Tips */}
        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <p className="text-xs font-semibold text-blue-900 mb-3">Smart Tips</p>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• {format === 'professional' ? 'Professional format includes print margins & color space optimization' : 'Screen format is optimized for web & ebooks'}</li>
            <li>• Preview updates in real-time as you edit</li>
            <li>• Cost includes illustrations if enabled</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
