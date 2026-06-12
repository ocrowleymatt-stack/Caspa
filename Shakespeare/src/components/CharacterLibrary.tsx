/**
 * Character Library Component
 * Manage characters with full depth: names, backstories, arcs, psychological influence
 */

import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ChevronDown, Users, Loader } from 'lucide-react';
import { Character, characterLibrary } from '../services/characterLibrary';

interface CharacterLibraryProps {
  projectId: string;
}

export const CharacterLibrary: React.FC<CharacterLibraryProps> = ({ projectId }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Character>>({
    role: 'supporting',
    arcProgression: {},
    relationships: [],
    psychologicalInfluence: [],
  });

  useEffect(() => {
    characterLibrary.setProjectId(projectId);
    loadCharacters();
    const unsubscribe = characterLibrary.subscribeToCharacters(projectId, setCharacters);
    return () => unsubscribe();
  }, [projectId]);

  const loadCharacters = async () => {
    setLoading(true);
    try {
      const chars = await characterLibrary.getCharacters(projectId);
      setCharacters(chars);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCharacter = async () => {
    if (!formData.name) {
      alert('Character name required');
      return;
    }

    try {
      if (editingId) {
        await characterLibrary.updateCharacter(editingId, formData);
      } else {
        await characterLibrary.createCharacter({
          ...formData,
          projectId,
          name: formData.name || '',
          role: formData.role || 'supporting',
          backstory: formData.backstory || '',
          physicalTraits: formData.physicalTraits || '',
          psychologicalTraits: formData.psychologicalTraits || '',
          motivations: formData.motivations || '',
          fears: formData.fears || '',
          secrets: formData.secrets || '',
          arcProgression: formData.arcProgression || {},
          firstAppearance: formData.firstAppearance || 0,
          relationships: formData.relationships || [],
          psychologicalInfluence: formData.psychologicalInfluence || [],
        });
      }
      resetForm();
    } catch (error) {
      console.error('Save failed:', error);
      alert('Failed to save character');
    }
  };

  const handleDeleteCharacter = async (id: string) => {
    if (!confirm('Delete this character?')) return;
    try {
      await characterLibrary.deleteCharacter(id);
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete character');
    }
  };

  const handleEditCharacter = (char: Character) => {
    setFormData(char);
    setEditingId(char.id || null);
    setShowForm(true);
  };

  const resetForm = () => {
    setFormData({
      role: 'supporting',
      arcProgression: {},
      relationships: [],
      psychologicalInfluence: [],
    });
    setEditingId(null);
    setShowForm(false);
  };

  const roleColors: Record<string, string> = {
    protagonist: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100',
    antagonist: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-100',
    supporting: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100',
    minor: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100',
    unused: 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-5 h-5 animate-spin mr-2" />
        <span>Loading characters...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6" />
            Character Library
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
            Every character gets a name & backstory, even if unused
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg flex items-center gap-2 transition"
          >
            <Plus className="w-5 h-5" />
            New Character
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-4">
            {editingId ? 'Edit Character' : 'Create Character'}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Character Name *"
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="col-span-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
            />

            <select
              value={formData.role || 'supporting'}
              onChange={e => setFormData({ ...formData, role: e.target.value as any })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
            >
              <option value="protagonist">Protagonist</option>
              <option value="antagonist">Antagonist</option>
              <option value="supporting">Supporting</option>
              <option value="minor">Minor</option>
              <option value="unused">Unused (Seed)</option>
            </select>

            <input
              type="number"
              placeholder="First Appearance (word count)"
              value={formData.firstAppearance || 0}
              onChange={e => setFormData({ ...formData, firstAppearance: parseInt(e.target.value) })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white"
            />
          </div>

          <textarea
            placeholder="Backstory (who are they, what shaped them?)"
            value={formData.backstory || ''}
            onChange={e => setFormData({ ...formData, backstory: e.target.value })}
            className="col-span-2 w-full mt-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white h-24 resize-none"
          />

          <div className="grid grid-cols-2 gap-4 mt-4">
            <textarea
              placeholder="Physical Traits"
              value={formData.physicalTraits || ''}
              onChange={e => setFormData({ ...formData, physicalTraits: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white h-20 resize-none"
            />
            <textarea
              placeholder="Psychological Traits"
              value={formData.psychologicalTraits || ''}
              onChange={e => setFormData({ ...formData, psychologicalTraits: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white h-20 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <textarea
              placeholder="Motivations (what drives them?)"
              value={formData.motivations || ''}
              onChange={e => setFormData({ ...formData, motivations: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white h-20 resize-none"
            />
            <textarea
              placeholder="Fears (what terrifies them?)"
              value={formData.fears || ''}
              onChange={e => setFormData({ ...formData, fears: e.target.value })}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white h-20 resize-none"
            />
          </div>

          <textarea
            placeholder="Secrets (what do they hide?)"
            value={formData.secrets || ''}
            onChange={e => setFormData({ ...formData, secrets: e.target.value })}
            className="col-span-2 w-full mt-4 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-black dark:text-white h-20 resize-none"
          />

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleSaveCharacter}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Save Character
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

      {/* Characters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {characters.map(char => (
          <div
            key={char.id}
            className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
          >
            {/* Header */}
            <div
              onClick={() => setExpandedId(expandedId === char.id ? null : char.id)}
              className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-800 dark:to-gray-700 p-4 cursor-pointer hover:from-gray-150 dark:hover:from-gray-750 transition flex items-start justify-between"
            >
              <div className="flex-1">
                <h3 className="font-bold text-lg">{char.name}</h3>
                <span
                  className={`inline-block mt-2 px-2 py-1 rounded text-xs font-semibold ${roleColors[char.role]}`}
                >
                  {char.role}
                </span>
              </div>
              <ChevronDown
                className={`w-5 h-5 transition transform ${expandedId === char.id ? 'rotate-180' : ''}`}
              />
            </div>

            {/* Expanded Content */}
            {expandedId === char.id && (
              <div className="p-4 space-y-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
                {char.backstory && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      BACKSTORY
                    </p>
                    <p className="text-sm">{char.backstory}</p>
                  </div>
                )}

                {char.physicalTraits && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      PHYSICAL
                    </p>
                    <p className="text-sm">{char.physicalTraits}</p>
                  </div>
                )}

                {char.psychologicalTraits && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      PSYCHOLOGY
                    </p>
                    <p className="text-sm">{char.psychologicalTraits}</p>
                  </div>
                )}

                {char.motivations && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      MOTIVATIONS
                    </p>
                    <p className="text-sm">{char.motivations}</p>
                  </div>
                )}

                {char.fears && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      FEARS
                    </p>
                    <p className="text-sm">{char.fears}</p>
                  </div>
                )}

                {char.secrets && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">
                      SECRETS
                    </p>
                    <p className="text-sm">{char.secrets}</p>
                  </div>
                )}

                {char.arcProgression && Object.keys(char.arcProgression).length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
                      ARC PROGRESSION
                    </p>
                    <div className="space-y-1">
                      {[1, 2, 3, 4, 5].map(pass => {
                        const arc = char.arcProgression[`pass${pass}` as keyof typeof char.arcProgression];
                        if (!arc) return null;
                        return (
                          <div key={pass} className="text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded">
                            <span className="font-semibold">Pass {pass}:</span> {arc}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => handleEditCharacter(char)}
                    className="flex-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-100 hover:bg-blue-200 dark:hover:bg-blue-800 py-2 rounded font-semibold text-sm flex items-center justify-center gap-2 transition"
                  >
                    <Edit2 className="w-4 h-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => char.id && handleDeleteCharacter(char.id)}
                    className="flex-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-800 py-2 rounded font-semibold text-sm flex items-center justify-center gap-2 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {characters.length === 0 && !showForm && (
        <div className="text-center p-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Users className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-300">No characters yet. Create your first character!</p>
        </div>
      )}
    </div>
  );
};
