import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { GitBranch, Loader2, MessageCircle, Plus, Trash2, User } from 'lucide-react';
import {
  createCharacter,
  deleteCharacter,
  getRelationshipMap,
  listCharacters,
  updateCharacter,
} from '../api/chapters';
import { generateDialogue } from '../api/assistant';
import { useAppStore } from '../store';
import { cn } from '../lib/utils';
import { useToast } from '../components/Toast';
import type { Character } from '../types';

const roles: Character['role'][] = ['protagonist', 'antagonist', 'supporting', 'minor'];

const roleColors: Record<Character['role'], string> = {
  protagonist: 'bg-accent/20 text-accent',
  antagonist: 'bg-red-500/20 text-red-300',
  supporting: 'bg-blue-500/20 text-blue-300',
  minor: 'bg-slate-500/20 text-slate-300',
};

const emptyForm = {
  name: '',
  role: 'supporting' as Character['role'],
  description: '',
  backstory: '',
  traits: '',
};

type View = 'cards' | 'relationships';

export default function Characters() {
  const { id: projectId } = useParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const setActiveProjectId = useAppStore((s) => s.setActiveProjectId);
  const [view, setView] = useState<View>('cards');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Character | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [talkCharacter, setTalkCharacter] = useState<Character | null>(null);
  const [situation, setSituation] = useState('');
  const [dialogue, setDialogue] = useState('');

  useEffect(() => {
    if (projectId) setActiveProjectId(projectId);
  }, [projectId, setActiveProjectId]);

  const { data: characters = [], isLoading } = useQuery({
    queryKey: ['characters', projectId],
    queryFn: () => listCharacters(projectId!),
    enabled: !!projectId,
  });

  const { data: relationshipMap } = useQuery({
    queryKey: ['relationship-map', projectId],
    queryFn: () => getRelationshipMap(projectId!),
    enabled: !!projectId && view === 'relationships',
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = {
        name: form.name,
        role: form.role,
        description: form.description,
        backstory: form.backstory,
        traits: form.traits.split(',').map((t) => t.trim()).filter(Boolean),
        relationships: editing?.relationships ?? [],
      };
      if (editing) {
        return updateCharacter(editing.id, data);
      }
      return createCharacter(projectId!, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
      queryClient.invalidateQueries({ queryKey: ['relationship-map', projectId] });
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm);
      toast.success(editing ? 'Character updated' : 'Character created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCharacter,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['characters', projectId] });
      queryClient.invalidateQueries({ queryKey: ['relationship-map', projectId] });
      toast.success('Character deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const dialogueMutation = useMutation({
    mutationFn: () => generateDialogue(talkCharacter!.id, situation),
    onSuccess: (text) => {
      setDialogue(text);
      toast.success('Dialogue generated');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEdit = (character: Character) => {
    setEditing(character);
    setForm({
      name: character.name,
      role: character.role,
      description: character.description,
      backstory: character.backstory,
      traits: character.traits.join(', '),
    });
    setModalOpen(true);
  };

  const nameById = (id: string) =>
    characters.find((c) => c.id === id)?.name ?? relationshipMap?.nodes.find((n) => n.id === id)?.name ?? id;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Characters</h1>
          <p className="text-muted text-sm mt-1">{characters.length} characters in this project</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden">
            <button
              type="button"
              onClick={() => setView('cards')}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors',
                view === 'cards' ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-white/5',
              )}
            >
              Cards
            </button>
            <button
              type="button"
              onClick={() => setView('relationships')}
              className={cn(
                'px-3 py-1.5 text-xs transition-colors flex items-center gap-1',
                view === 'relationships' ? 'bg-accent/20 text-accent' : 'text-muted hover:bg-white/5',
              )}
            >
              <GitBranch className="h-3 w-3" /> Map
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setModalOpen(true);
            }}
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> Add Character
          </button>
        </div>
      </div>

      {view === 'relationships' ? (
        <div className="card space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-accent" /> Relationship Map
          </h2>
          {!relationshipMap || relationshipMap.nodes.length === 0 ? (
            <p className="text-muted text-sm text-center py-8">Add characters to see relationships</p>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {relationshipMap.nodes.map((node) => (
                  <div key={node.id} className="rounded-lg bg-white/5 p-3 border border-white/10">
                    <p className="font-medium">{node.name}</p>
                    <span className={cn('badge capitalize mt-1 text-[10px]', roleColors[node.role])}>
                      {node.role}
                    </span>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-white/10">
                <h3 className="text-sm font-medium mb-3">Connections</h3>
                {relationshipMap.edges.length === 0 ? (
                  <p className="text-sm text-muted">No relationships defined yet. Edit characters to add them.</p>
                ) : (
                  <div className="space-y-2">
                    {relationshipMap.edges.map((edge, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-2 text-sm rounded-lg bg-white/5 px-3 py-2"
                      >
                        <span className="font-medium">{nameById(edge.from)}</span>
                        <span className="text-muted">→</span>
                        <span className="badge bg-accent/10 text-accent text-[10px]">{edge.type}</span>
                        <span className="text-muted">→</span>
                        <span className="font-medium">{nameById(edge.to)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : characters.length === 0 ? (
        <div className="card text-center py-16">
          <User className="h-12 w-12 mx-auto text-muted mb-4 opacity-40" />
          <p className="text-muted mb-4">No characters yet. Build your cast.</p>
          <button type="button" onClick={() => setModalOpen(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Create Character
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <div key={character.id} className="card group hover:border-accent/30 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent font-serif text-xl">
                  {character.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate">{character.name}</h3>
                  <span className={cn('badge capitalize mt-1', roleColors[character.role])}>
                    {character.role}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete ${character.name}?`)) {
                      deleteMutation.mutate(character.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 btn-ghost p-1 text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-3 text-sm text-muted line-clamp-3">{character.description || 'No description'}</p>
              {character.traits.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {character.traits.map((trait) => (
                    <span key={trait} className="badge bg-white/5 text-muted text-[10px]">
                      {trait}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => openEdit(character)} className="btn-secondary text-xs flex-1">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTalkCharacter(character);
                    setSituation('');
                    setDialogue('');
                  }}
                  className="btn-secondary text-xs flex-1"
                >
                  <MessageCircle className="h-3 w-3" /> Talk
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {editing ? 'Edit Character' : 'New Character'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="label">Name</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Role</label>
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Character['role'] })} className="input">
                  {roles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input min-h-[80px]" />
              </div>
              <div>
                <label className="label">Backstory</label>
                <textarea value={form.backstory} onChange={(e) => setForm({ ...form, backstory: e.target.value })} className="input min-h-[80px]" />
              </div>
              <div>
                <label className="label">Traits (comma-separated)</label>
                <input value={form.traits} onChange={(e) => setForm({ ...form, traits: e.target.value })} className="input" placeholder="brave, witty, stubborn" />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancel</button>
              <button type="button" disabled={!form.name.trim() || saveMutation.isPending} onClick={() => saveMutation.mutate()} className="btn-primary">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {talkCharacter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card w-full max-w-lg">
            <MessageCircle className="h-10 w-10 mx-auto text-accent mb-4" />
            <h2 className="text-lg font-semibold text-center">Talk to {talkCharacter.name}</h2>
            <p className="text-muted text-sm mt-2 mb-4 text-center">
              Describe a situation and hear how this character responds.
            </p>
            <div className="space-y-4">
              <div>
                <label className="label">Situation</label>
                <textarea
                  value={situation}
                  onChange={(e) => setSituation(e.target.value)}
                  className="input min-h-[80px]"
                  placeholder="You're confronted by an old rival at a crowded market..."
                />
              </div>
              {dialogue && (
                <div className="rounded-lg bg-white/5 p-4">
                  <p className="text-sm font-serif whitespace-pre-wrap">{dialogue}</p>
                </div>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setTalkCharacter(null)} className="btn-secondary">
                Close
              </button>
              <button
                type="button"
                disabled={!situation.trim() || dialogueMutation.isPending}
                onClick={() => dialogueMutation.mutate()}
                className="btn-primary"
              >
                {dialogueMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Dialogue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
