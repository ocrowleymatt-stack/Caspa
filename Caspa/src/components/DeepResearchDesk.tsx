/**
 * Deep Research Desk Component
 * Comprehensive research interface: academic, historical, psychological, logistical, cultural
 * Auto-populates Research Library with findings
 */

import React, { useState } from 'react';
import { Search, BookOpen, Loader, AlertCircle, CheckCircle, Filter } from 'lucide-react';
import { deepResearchService, ResearchQuery, ResearchFinding } from '../services/deepResearchService';
import { researchLibrary } from '../services/researchLibrary';

interface DeepResearchDeskProps {
  projectId: string;
  onResearchComplete?: (entries: number) => void;
}

export const DeepResearchDesk: React.FC<DeepResearchDeskProps> = ({ projectId, onResearchComplete }) => {
  const [topic, setTopic] = useState('');
  const [focus, setFocus] = useState<'comprehensive' | 'academic' | 'historical' | 'psychological' | 'logistical' | 'cultural'>('comprehensive');
  const [depth, setDepth] = useState<'undergraduate' | 'graduate' | 'expert' | 'specialized'>('graduate');
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<ResearchFinding[]>([]);
  const [selectedFindings, setSelectedFindings] = useState<Set<number>>(new Set());
  const [addingToLibrary, setAddingToLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const focusOptions = [
    { value: 'comprehensive', label: '🌍 Comprehensive', description: 'All research angles' },
    { value: 'academic', label: '📚 Academic', description: 'Peer-reviewed research' },
    { value: 'historical', label: '📜 Historical', description: 'Historical context & events' },
    { value: 'psychological', label: '🧠 Psychological', description: 'Behavior & motivations' },
    { value: 'logistical', label: '⚙️ Logistical', description: 'Practical how-to & systems' },
    { value: 'cultural', label: '🎭 Cultural', description: 'Traditions & local knowledge' },
  ] as const;

  const depthOptions = [
    { value: 'undergraduate', label: 'Undergraduate', description: 'Foundation level' },
    { value: 'graduate', label: 'Graduate', description: 'Advanced study' },
    { value: 'expert', label: 'Expert', description: 'Specialized knowledge' },
    { value: 'specialized', label: 'Specialized', description: 'Deep expertise' },
  ] as const;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setIsSearching(true);
    setError(null);

    try {
      const query: ResearchQuery = {
        topic: topic.trim(),
        focus,
        depth,
      };

      const findings = await deepResearchService.researchTopic(query);
      setSearchHistory(prev => [findings, ...prev]);
      setSelectedFindings(new Set([0])); // Auto-select latest
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to library');
    } finally {
      setAddingToLibrary(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-6 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 rounded-xl shadow-lg">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-2">
          <BookOpen className="w-8 h-8 text-blue-600" />
          Deep Research Desk
        </h2>
        <p className="text-slate-600 dark:text-slate-300">
          Comprehensive topic research: academic, historical, psychological, logistical, and cultural sources
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8 bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
        {/* Topic Input */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Research Topic
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., 'Victorian London medicine', 'Cognitive biases in decision-making'..."
              className="w-full pl-10 pr-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSearching}
            />
          </div>
        </div>

        {/* Focus Area Selection */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Research Focus
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {focusOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFocus(option.value)}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  focus === option.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-blue-300'
                }`}
              >
                <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Research Depth */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
            Research Depth
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {depthOptions.map(option => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDepth(option.value)}
                className={`p-3 rounded-lg border-2 transition-all text-center ${
                  depth === option.value
                    ? 'border-green-500 bg-green-50 dark:bg-green-900'
                    : 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 hover:border-green-300'
                }`}
              >
                <div className="font-medium text-slate-900 dark:text-white text-sm">{option.label}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400">{option.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Search Button */}
        <button
          type="submit"
          disabled={isSearching}
          className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          {isSearching ? (
            <>
              <Loader className="w-5 h-5 animate-spin" />
              Researching...
            </>
          ) : (
            <>
              <Search className="w-5 h-5" />
              Research Topic
            </>
          )}
        </button>
      </form>

      {/* Search Results */}
      {searchHistory.length > 0 && (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              Research Findings ({searchHistory.length})
            </h3>
            <button
              onClick={handleAddToLibrary}
              disabled={selectedFindings.size === 0 || addingToLibrary}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {addingToLibrary ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Add Selected ({selectedFindings.size})
                </>
              )}
            </button>
          </div>

          <div className="space-y-4">
            {searchHistory.map((finding, index) => (
              <div
                key={index}
                className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                  selectedFindings.has(index)
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900'
                    : 'border-slate-200 dark:border-slate-600 hover:border-blue-300'
                }`}
                onClick={() => toggleFindingSelection(index)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedFindings.has(index)}
                    onChange={() => toggleFindingSelection(index)}
                    className="mt-1 w-5 h-5 cursor-pointer"
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {finding.topic}
                    </h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                      {finding.summary}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {finding.tags.slice(0, 5).map((tag, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                      {finding.tags.length > 5 && (
                        <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-xs">
                          +{finding.tags.length - 5}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {finding.sources.length} sources • Confidence: {(finding.confidence * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isSearching && searchHistory.length === 0 && (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg">
          <BookOpen className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400">
            Enter a topic and choose your research focus to begin
          </p>
        </div>
      )}
    </div>
  );
};

export default DeepResearchDesk;
