/**
 * Input Hub Component
 * Multi-format upload interface for story materials
 */

import React, { useState, useRef } from 'react';
import { Upload, FileText, Image, Music, X, Loader } from 'lucide-react';
import { inputHub, InputSource, StorySpine } from '../services/inputHub';

interface InputHubProps {
  projectId: string;
  onStorySpineExtracted: (spine: StorySpine) => void;
  aiService: any;
}

export const InputHub: React.FC<InputHubProps> = ({ projectId, onStorySpineExtracted, aiService }) => {
  const [sources, setSources] = useState<InputSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (!files) return;

    setLoading(true);
    try {
      const newSources = await inputHub.processFiles(Array.from(files));
      setSources(prev => [...prev, ...newSources]);
    } catch (error) {
      console.error('File processing failed:', error);
      alert('Failed to process some files');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveSource = (id: string) => {
    setSources(prev => prev.filter(s => s.id !== id));
  };

  const handleExtractStorySpine = async () => {
    if (sources.length === 0) {
      alert('Please add at least one source');
      return;
    }

    setExtracting(true);
    try {
      const spine = await inputHub.extractStorySpine(sources, aiService);
      onStorySpineExtracted(spine);
    } catch (error) {
      console.error('Story spine extraction failed:', error);
      alert('Failed to extract story spine');
    } finally {
      setExtracting(false);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
      case 'text':
        return <FileText className="w-4 h-4" />;
      case 'image':
        return <Image className="w-4 h-4" />;
      case 'audio':
        return <Music className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">📥 Story Input Hub</h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Dump everything: notes, scraps, PDFs, images, audio. We'll extract the story spine.
        </p>
      </div>

      {/* Upload Area */}
      <div
        className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg p-8 text-center cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900 transition"
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-blue-500" />
        <p className="font-semibold mb-2">Drag files here or click to upload</p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Supports: PDF, images, audio, text files
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.txt,.md,.png,.jpg,.jpeg,.gif,.mp3,.wav,.ogg,.m4a"
        />
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="flex items-center justify-center p-4">
          <Loader className="w-5 h-5 animate-spin mr-2" />
          <span>Processing files...</span>
        </div>
      )}

      {/* Sources List */}
      {sources.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3">
            📚 Uploaded Sources ({sources.length})
          </h3>
          <div className="space-y-2">
            {sources.map(source => (
              <div
                key={source.id}
                className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
              >
                <div className="text-gray-500 mt-1">{getFileIcon(source.type)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{source.originalFileName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {source.type.toUpperCase()} • {source.content.length} chars
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveSource(source.id)}
                  className="text-red-500 hover:text-red-700 p-1"
                  title="Remove source"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extract Button */}
      {sources.length > 0 && (
        <button
          onClick={handleExtractStorySpine}
          disabled={extracting}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
        >
          {extracting ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Extracting Story Spine...
            </>
          ) : (
            <>
              <span>✨</span>
              Extract Story Spine
            </>
          )}
        </button>
      )}

      {/* Help Text */}
      <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded p-4">
        <p className="text-sm">
          <strong>💡 Tip:</strong> Upload all your materials (book plans, character notes, research, voice memos, photos, etc.).
          The AI will analyze everything and extract the core story spine.
        </p>
      </div>
    </div>
  );
};
