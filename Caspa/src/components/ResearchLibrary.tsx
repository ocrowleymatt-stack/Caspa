/**
 * Research Library Component
 * Manage factual research: geography, history, timelines, worldbuilding
 */

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, BookOpen, Loader } from 'lucide-react';
import { ResearchEntry, researchLibrary } from '../services/researchLibrary';

interface ResearchLibraryProps {
  projectId: string;
}

export const ResearchLibrary: React.FC<ResearchLibraryProps> = ({ projectId }) => {
  const [entries, setEntries] = useState<ResearchEntry[]>([]);
  const [filteredEntries, setFilteredEntries] = useState<ResearchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [formData, setFormData] = useState<Partial<ResearchEntry>>({
    category: 'worldbuilding',
    sources: [],
    tags: [],
    linkedCharacters: [],
    verificationStatus: 'unverified',
  });

  const categories = ['geography', 'history', 'timeline', 'worldbuilding', 'science', 'culture', 'other'] as const;

  useEffect(() => {
    researchLibrary.setProjectId(projectId);
    loadEntries();
    const unsubscribe = researchLibrary.subscribeToResearch(projectId, setEntries);
    return () => unsubscribe();
  }, [projectId]);

  useEffect(() => {
    let filtered = entries;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(e => e.category === selectedCategory);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        e =>
          e.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
          e.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    setFilteredEntries(filtered);
  }, [entries, searchTerm, selectedCategory]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const res = await researchLibrary.getResearchByProject(projectId);
      setEntries(res);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEntry = async () => {
    if (!formData.topic) {
      alert('Topic required');
      return;
    }

    try {
      if (editingId) {
        await researchLibrary.updateResearchEntry(editingId, formData);
      } else {
        await researchLibrary.addResearchEntry({
          ...formData,
          projectId,
          topic: formData.topic || '',
          category: formData.category || 'worldbuilding',
          content: formData.content || '',
          sources: formData.sources || [],
          tags: formData.tags || [],
          linkedCharacters: formData.linkedCharacters || [],
          linkedManuscriptSections: [],
          verificationStatus: formData.verificationStatus || 'unverified',
          notes: formData.notes || '',
        });
      }
      resetForm();
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save research entry');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!confirm('Delete this research entry?')) return;
    try {
      await researchLibrary.deleteResearchEntry(id);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete entry');
    }
  };

  const handleEditEntry = (entry: ResearchEntry) => {
    setFormData(entry);
    setEditingId(entry.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      category: 'worldbuilding',
      sources: [],
      tags: [],
      linkedCharacters: [],
      verificationStatus: 'unverified',
    });
    setEditingId(null);
    setShowForm(false);
  };

  const categoryColors: Record<string, string> = {
    geography: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100',
    history: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-100',
    timeline: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100',
    worldbuilding: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100',
    science: 'bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-100',
    culture: 'bg-pink-100 dark:bg-pink-900 text-pink-800 dark:text-pink-100',
    other: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100',
  };

  const statusColors: Record<string, string> = {
    verified: 'text-green-600 dark:text-green-400',
    unverified: 'text-yellow-600 dark:text-yellow-400',
    contradicted: 'text-red-600 dark:text-red-400',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-5 h-5 animate-spin mr-2" />
        <span>Loading research...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Research Library
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
            Geography, history, timelines, worldbuilding facts
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition"
          >
            <Plus className="w-5 h-5" />
            New Research
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">
            {editingId ? 'Edit Research' : 'Add Research Entry'}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Topic *"
              value={formData.topic || ''}
              onChange={e => setFormData({ ...formData, topic: e.target.value })}
              className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
            />

            <select
              value={formData.category || 'worldbuilding'}
              onChange={e => setFormData({ ...formData, category: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={formData.verificationStatus || 'unverified'}
              onChange={e =>
                setFormData({ ...formData, verificationStatus: e.target.value as any })
              }
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
            >
              <option value="unverified">Unverified</option>
              <option value="verified">Verified</option>
              <option value="contradicted">Contradicted</option>
            </select>
          </div>

          <textarea
            placeholder="Research Content"
            value={formData.content || ''}
            onChange={e => setFormData({ ...formData, content: e.target.value })}
            className="col-span-2 w-full mt-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white h-24 resize-none"
          />

          <input
            type="text"
            placeholder="Tags (comma-separated)"
            value={(formData.tags || []).join(', ')}
            onChange={e =>
              setFormData({
                ...formData,
                tags: e.target.value.split(',').map(t => t.trim()),
              })
            }
            className="col-span-2 w-full mt-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
          />

          <textarea
            placeholder="Sources (URLs, books, etc.)"
            value={
              formData.sources
                ?.map(s => `${s.title}${s.url ? ' - ' + s.url : ''}`)
                .join('\n') || ''
            }
            onChange={e =>
              setFormData({
                ...formData,
                sources: e.target.value.split('\n').map(line => {
                  const [title, url] = line.split(' - ');
                  return { title: title.trim(), url: url?.trim() };
                }),
              })
            }
            className="col-span-2 w-full mt-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white h-20 resize-none"
          />

          <textarea
            placeholder="Notes"
            value={formData.notes || ''}
            onChange={e => setFormData({ ...formData, notes: e.target.value })}
            className="col-span-2 w-full mt-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white h-16 resize-none"
          />

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSaveEntry}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Save Research
            </button>
            <button
              onClick={resetForm}
              className="bg-gray-400 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search research..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-black dark:text-white"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        {filteredEntries.map(entry => (
          <div
            key={entry.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900 hover:shadow-md transition"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h3 className="font-bold text-lg">{entry.topic}</h3>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                      categoryColors[entry.category]
                    }`}
                  >
                    {entry.category.charAt(0).toUpperCase() + entry.category.slice(1)}
                  </span>
                  <span
                    className={`text-xs font-semibold ${statusColors[entry.verificationStatus]}`}
                  >
                    {entry.verificationStatus === 'verified'
                      ? '✓ Verified'
                      : entry.verificationStatus === 'contradicted'
                      ? '✗ Contradicted'
                      : '? Unverified'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditEntry(entry)}
                  className="text-blue-600 hover:text-blue-700 p-2"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => entry.id && handleDeleteEntry(entry.id)}
                  className="text-red-600 hover:text-red-700 p-2"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            {entry.content && (
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{entry.content}</p>
            )}

            {entry.tags && entry.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-2">
                {entry.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-block px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {entry.sources && entry.sources.length > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                <strong>Sources:</strong>{' '}
                {entry.sources.map(s => (s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{s.title}</a> : s.title)).reduce((a, b) => [a, ', ', b] as any)}
              </div>
            )}
          </div>
        ))}
      </div>

      {filteredEntries.length === 0 && !showForm && (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <BookOpen className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-300">
            {entries.length === 0
              ? 'No research yet. Start building your knowledge base!'
              : 'No results found.'}
          </p>
        </div>
      )}
    </div>
  );
};
