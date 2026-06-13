/**
 * Deep Research Desk - Mobile Optimized
 * Touch-first design: responsive, tap-friendly, gesture support
 * Optimized for phones (320px+) and tablets
 */

import React, { useState, useRef } from 'react';
import { Search, BookOpen, Loader, AlertCircle, CheckCircle, Filter, ChevronDown, X } from 'lucide-react';
import { deepResearchService, ResearchQuery, ResearchFinding } from '../services/deepResearchService';
import { researchLibrary } from '../services/researchLibrary';

interface DeepResearchDeskProps {
  projectId: string;
  onResearchComplete?: (entries: number) => void;
}

type FocusArea = 'comprehensive' | 'academic' | 'historical' | 'psychological' | 'logistical' | 'cultural';
type DepthLevel = 'undergraduate' | 'graduate' | 'expert' | 'specialized';

export const DeepResearchDesk: React.FC<DeepResearchDeskProps> = ({ projectId, onResearchComplete }) => {
  const [topic, setTopic] = useState('');
  const [focus, setFocus] = useState<FocusArea>('comprehensive');
  const [depth, setDepth] = useState<DepthLevel>('graduate');
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<ResearchFinding[]>([]);
  const [selectedFindings, setSelectedFindings] = useState<Set<number>>(new Set());
  const [addingToLibrary, setAddingToLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFocusMenu, setShowFocusMenu] = useState(false);
  const [showDepthMenu, setShowDepthMenu] = useState(false);
  const topicInputRef = useRef<HTMLInputElement>(null);

  const focusOptions: Array<{ value: FocusArea; label: string; icon: string; description: string }> = [
    { value: 'comprehensive', label: 'Comprehensive', icon: '🌍', description: 'All angles' },
    { value: 'academic', label: 'Academic', icon: '📚', description: 'Peer-reviewed' },
    { value: 'historical', label: 'Historical', icon: '📜', description: 'Context & events' },
    { value: 'psychological', label: 'Psychological', icon: '🧠', description: 'Behavior' },
    { value: 'logistical', label: 'Logistical', icon: '⚙️', description: 'How-to & systems' },
    { value: 'cultural', label: 'Cultural', icon: '🎭', description: 'Traditions' },
  ];

  const depthOptions: Array<{ value: DepthLevel; label: string; description: string }> = [
    { value: 'undergraduate', label: 'Undergraduate', description: 'Foundation' },
    { value: 'graduate', label: 'Graduate', description: 'Advanced' },
    { value: 'expert', label: 'Expert', description: 'Specialized' },
    { value: 'specialized', label: 'Deep', description: 'Expertise' },
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setIsSearching(true);
    setError(null);
    setShowFocusMenu(false);
    setShowDepthMenu(false);

    try {
      const query: ResearchQuery = {
        topic: topic.trim(),
        focus,
        depth,
      };

      const findings = await deepResearchService.researchTopic(query);
      setSearchHistory(prev => [findings, ...prev]);
      setSelectedFindings(new Set([0]));
      setTopic('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const toggleFindingSelection = (index: number) => {
    const newSelected = new Set(selectedFindings);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedFindings(newSelected);
  };

  const handleAddToLibrary = async () => {
    if (selectedFindings.size === 0) {
      setError('Please select findings to add');
      return;
    }

    setAddingToLibrary(true);
    try {
      const findingsToAdd = Array.from(selectedFindings)
        .map(idx => searchHistory[idx])
        .filter(Boolean);

      researchLibrary.setProjectId(projectId);

      for (const finding of findingsToAdd) {
        const entry = deepResearchService.convertToLibraryEntry(finding, projectId);
        await researchLibrary.addResearchEntry(entry);
      }

      setSearchHistory([]);
      setSelectedFindings(new Set());
      onResearchComplete?.(findingsToAdd.length);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to library');
    } finally {
      setAddingToLibrary(false);
    }
  };

  const currentFocusOption = focusOptions.find(opt => opt.value === focus);
  const currentDepthOption = depthOptions.find(opt => opt.value === depth);

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 pb-20 md:pb-0">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="px-4 py-3 flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-blue-600 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">Research Desk</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 truncate">Deep topic research</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          {/* Topic Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
              Topic
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                ref={topicInputRef}
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Victorian medicine, neural networks..."
                className="w-full pl-9 pr-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 dark:disabled:bg-slate-600 transition-colors"
                disabled={isSearching}
              />
            </div>
          </div>

          {/* Focus Area - Mobile Dropdown */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
              Focus Area
            </label>
            <button
              type="button"
              onClick={() => setShowFocusMenu(!showFocusMenu)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-between text-slate-900 dark:text-white hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span className="text-lg">{currentFocusOption?.icon}</span>
                <span className="font-medium">{currentFocusOption?.label}</span>
              </span>
              <ChevronDown className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform ${showFocusMenu ? 'rotate-180' : ''}`} />
            </button>

            {showFocusMenu && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg z-40">
                {focusOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setFocus(option.value);
                      setShowFocusMenu(false);
                    }}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 border-b border-slate-200 dark:border-slate-600 last:border-b-0 ${
                      focus === option.value
                        ? 'bg-blue-50 dark:bg-blue-900 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-600'
                    } transition-colors`}
                  >
                    <span className="text-lg flex-shrink-0">{option.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-400">{option.description}</div>
                    </div>
                    {focus === option.value && <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Research Depth - Mobile Dropdown */}
          <div className="relative">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 uppercase tracking-wide">
              Research Depth
            </label>
            <button
              type="button"
              onClick={() => setShowDepthMenu(!showDepthMenu)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-between text-slate-900 dark:text-white hover:border-green-400 dark:hover:border-green-500 transition-colors"
            >
              <span className="font-medium">{currentDepthOption?.label}</span>
              <ChevronDown className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform ${showDepthMenu ? 'rotate-180' : ''}`} />
            </button>

            {showDepthMenu && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg z-40">
                {depthOptions.map(option => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setDepth(option.value);
                      setShowDepthMenu(false);
                    }}
                    className={`w-full px-4 py-3 text-left border-b border-slate-200 dark:border-slate-600 last:border-b-0 ${
                      depth === option.value
                        ? 'bg-green-50 dark:bg-green-900 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-600'
                    } transition-colors`}
                  >
                    <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                    <div className="text-xs text-slate-600 dark:text-slate-400">{option.description}</div>
                    {depth === option.value && <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-1" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-300 text-sm flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Search Button - Full Width, Touch-Friendly */}
          <button
            type="submit"
            disabled={isSearching || !topic.trim()}
            className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 active:scale-95 disabled:active:scale-100"
          >
            {isSearching ? (
              <>
                <Loader className="w-5 h-5 animate-spin" />
                <span>Researching...</span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                <span>Research</span>
              </>
            )}
          </button>
        </form>

        {/* Search Results */}
        {searchHistory.length > 0 && (
          <div className="space-y-4">
            {/* Results Header */}
            <div className="flex items-center justify-between sticky top-20 z-40 bg-slate-50 dark:bg-slate-900 py-2 px-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Findings <span className="text-blue-600 dark:text-blue-400">({searchHistory.length})</span>
              </h3>
              {selectedFindings.size > 0 && (
                <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                  {selectedFindings.size} selected
                </span>
              )}
            </div>

            {/* Results List */}
            <div className="space-y-3">
              {searchHistory.map((finding, index) => (
                <div
                  key={index}
                  onClick={() => toggleFindingSelection(index)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all active:scale-95 ${
                    selectedFindings.has(index)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 active:border-blue-300'
                  }`}
                >
                  <div className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={selectedFindings.has(index)}
                      onChange={() => toggleFindingSelection(index)}
                      className="w-5 h-5 mt-1 flex-shrink-0 cursor-pointer accent-blue-600"
                      onClick={e => e.stopPropagation()}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 dark:text-white text-sm mb-1 line-clamp-2">
                        {finding.topic}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 line-clamp-3">
                        {finding.summary}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {finding.tags.slice(0, 3).map((tag, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded text-xs whitespace-nowrap"
                          >
                            {tag}
                          </span>
                        ))}
                        {finding.tags.length > 3 && (
                          <span className="px-2 py-1 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded text-xs">
                            +{finding.tags.length - 3}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                        <span>{finding.sources.length} sources</span>
                        <span>•</span>
                        <span>{(finding.confidence * 100).toFixed(0)}% confidence</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add to Library Button - Sticky Bottom */}
            <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 safe-bottom">
              <button
                onClick={handleAddToLibrary}
                disabled={selectedFindings.size === 0 || addingToLibrary}
                className="w-full py-4 px-4 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 active:scale-95 disabled:active:scale-100"
              >
                {addingToLibrary ? (
                  <>
                    <Loader className="w-5 h-5 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5" />
                    <span>Add {selectedFindings.size > 0 ? `(${selectedFindings.size})` : 'to Library'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!isSearching && searchHistory.length === 0 && (
          <div className="text-center py-12 px-4">
            <BookOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
              Ready to research?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Enter a topic and pick your research focus to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeepResearchDesk;
