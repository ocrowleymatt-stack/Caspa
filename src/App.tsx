import { useEffect, useMemo, useState } from 'react';
import CaspaRedesign from './components/CaspaRedesign';
import type { Character, Chapter, Project, ViewType } from './types';

const STORAGE_KEY = 'caspa_release_state_v2';

function countWords(text = '') {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function now() {
  return Date.now();
}

const initialProject: Project = {
  id: 'project-house-of-god',
  title: 'The House of God',
  type: 'novel',
  maturity: 'standard',
  genre: 'Literary Gothic',
  premise: 'A haunted institutional novel about memory, power and the debt a house refuses to forget.',
  tone: 'Elegant, dark, controlled',
  ownerId: 'local-author',
  collaborators: [],
  createdAt: now(),
  lastModified: now(),
  targetWordCount: 120000,
  stats: {
    narrativeStreak: 14,
    totalWords: 0,
    aiContributions: 0,
    lastActiveDay: new Date().toISOString().split('T')[0],
  },
};

const initialChapters: Chapter[] = [
  {
    id: 'chapter-13',
    projectId: initialProject.id,
    title: 'The Hollow Audience',
    summary: 'The house gathers witnesses who may not be alive enough to testify.',
    content: 'The hollow audience listened without breathing. Their silence did not feel empty; it felt appointed.',
    order: 13,
    plotNodeIds: [],
    tags: ['atmosphere', 'institution'],
    updatedAt: now(),
    status: 'draft',
  },
  {
    id: 'chapter-14',
    projectId: initialProject.id,
    title: 'A Ledger in the Dark',
    summary: 'A hidden ledger suggests the house has been recording debts for generations.',
    content: 'A ledger lay under the floorboards, wrapped in oilcloth and patient as a buried oath.',
    order: 14,
    plotNodeIds: [],
    tags: ['evidence', 'secret'],
    updatedAt: now(),
    status: 'draft',
  },
  {
    id: 'chapter-15',
    projectId: initialProject.id,
    title: 'A Door Unlatched',
    summary: 'A door opens without permission and changes the rules of the house.',
    content: 'The old door opened inwards. No hand touched it. No hinge complained. It simply remembered being useful.',
    order: 15,
    plotNodeIds: [],
    tags: ['threshold', 'reversal'],
    updatedAt: now(),
    status: 'draft',
  },
  {
    id: 'chapter-16',
    projectId: initialProject.id,
    title: 'The Gathering House',
    summary: 'The house begins to act less like a setting and more like a party to the dispute.',
    content: 'The house remembered everyone who entered. More troublingly, it remembered what they had hoped to hide.',
    order: 16,
    plotNodeIds: [],
    tags: ['agency', 'pressure'],
    updatedAt: now(),
    status: 'draft',
  },
  {
    id: 'chapter-17',
    projectId: initialProject.id,
    title: 'The Levee',
    summary: 'The flood exposes the town’s dependence on a fragile boundary and sets the final movement in motion.',
    content: 'The river had risen three feet by morning and would rise again before nightfall.\n\nThey called it rain, but it was the sky confessing what the city refused to remember. Water came down in sheets, drumming the zinc roofs, turning alleys into veins. The levee held—for now. But levees do not fail loudly. They soften. They weep. They forget.\n\nMaris stood where the old promenade broke into reeds and watched the current tug at the pilings, patient and sure. Behind her, the city continued its pageant. Merchants opened their stalls. Priests rehearsed their devotions. Children chased paper boats toward a horizon they had never seen.\n\nThe House had not sent for her.\n\nWhich meant it already knew.\n\nShe traced the edge of the amulet beneath her coat—cold iron, older than the charter, older than the House. It pulsed once, like a door remembering its hinge.\n\nUpstream, a bell tolled eleven times.',
    order: 17,
    plotNodeIds: [],
    tags: ['flood', 'foreshadowing', 'turn'],
    updatedAt: now(),
    status: 'draft',
    sceneTurnGoal: 'Move from atmospheric pressure to irreversible threat.',
  },
  {
    id: 'chapter-18',
    projectId: initialProject.id,
    title: 'The Mercy of Walls',
    summary: 'The walls protect the town but also trap the people who trusted them.',
    content: 'Some walls keep people out. Others keep memories in.',
    order: 18,
    plotNodeIds: [],
    tags: ['containment', 'aftermath'],
    updatedAt: now(),
    status: 'outline',
  },
];

const initialCharacters: Character[] = [
  {
    id: 'char-maris',
    name: 'Maris Vey',
    role: 'Protagonist',
    backstory: 'Former archivist drawn back to the house by an impossible record.',
    traits: ['controlled', 'observant', 'wounded'],
    goals: ['Expose the house ledger', 'Protect the town from the flood'],
    fears: ['Being believed too late'],
    motivations: ['Memory', 'justice', 'atonement'],
    quirks: ['Touches the amulet before lying'],
    archetype: 'Reluctant witness',
    updatedAt: now(),
  },
  {
    id: 'char-solen',
    name: 'Father Solen',
    role: 'High Confessor',
    backstory: 'Knows more about the house than his office permits him to admit.',
    traits: ['measured', 'evasive', 'devout'],
    goals: ['Contain scandal', 'Preserve the parish'],
    fears: ['The ledger becoming public'],
    motivations: ['Faith', 'status', 'survival'],
    quirks: ['Counts bell tolls under his breath'],
    archetype: 'Compromised mentor',
    updatedAt: now(),
  },
  {
    id: 'char-elias',
    name: 'Elias Vorn',
    role: 'Harbormaster',
    backstory: 'Practical man with one loyalty too many.',
    traits: ['blunt', 'loyal', 'superstitious'],
    goals: ['Keep the levee intact', 'Save his crew'],
    fears: ['Water at night'],
    motivations: ['Duty', 'debt', 'love'],
    quirks: ['Never turns his back on the river'],
    archetype: 'Grounded ally',
    updatedAt: now(),
  },
  {
    id: 'char-house',
    name: 'The House',
    role: 'Shadow Faction',
    backstory: 'An institution, building and memory-system collapsed into one antagonist.',
    traits: ['patient', 'bureaucratic', 'hungry'],
    goals: ['Preserve itself', 'Convert memory into leverage'],
    fears: ['Open daylight'],
    motivations: ['Continuity', 'control'],
    quirks: ['Responds through doors, bells and ledgers'],
    archetype: 'Living institution',
    updatedAt: now(),
  },
];

type ReleaseState = {
  project: Project;
  chapters: Chapter[];
  characters: Character[];
  currentView: ViewType;
};


function normaliseStats(project: Project, totalWords: number): NonNullable<Project['stats']> {
  return {
    narrativeStreak: project.stats?.narrativeStreak ?? 0,
    totalWords,
    aiContributions: project.stats?.aiContributions ?? 0,
    revCount: project.stats?.revCount,
    lastActiveDay: project.stats?.lastActiveDay || new Date().toISOString().split('T')[0],
  };
}

function loadState(): ReleaseState {
  if (typeof localStorage === 'undefined') {
    return { project: initialProject, chapters: initialChapters, characters: initialCharacters, currentView: 'dashboard' };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw new Error('empty');
    const parsed = JSON.parse(raw) as Partial<ReleaseState>;
    return {
      project: parsed.project || initialProject,
      chapters: parsed.chapters?.length ? parsed.chapters : initialChapters,
      characters: parsed.characters?.length ? parsed.characters : initialCharacters,
      currentView: parsed.currentView || 'dashboard',
    };
  } catch {
    return { project: initialProject, chapters: initialChapters, characters: initialCharacters, currentView: 'dashboard' };
  }
}

export default function App() {
  const [state, setState] = useState<ReleaseState>(() => loadState());
  const totalWords = useMemo(() => state.chapters.reduce((sum, chapter) => sum + countWords(chapter.content), 0), [state.chapters]);

  useEffect(() => {
    const nextProject = {
      ...state.project,
      lastModified: now(),
      stats: normaliseStats(state.project, totalWords),
    };
    const payload = { ...state, project: nextProject };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [state, totalWords]);

  const setCurrentView = (currentView: ViewType) => setState((prev) => ({ ...prev, currentView }));

  const saveToCloud = async () => {
    const docs = {
      [`projects/${state.project.id}`]: { ...state.project, stats: normaliseStats(state.project, totalWords) },
      ...Object.fromEntries(state.chapters.map((chapter) => [`projects/${state.project.id}/chapters/${chapter.id}`, chapter])),
      ...Object.fromEntries(state.characters.map((character) => [`projects/${state.project.id}/characters/${character.id}`, character])),
    };
    await fetch('/api/local/db', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docs }),
    });
  };

  const createNewProject = (title = 'Untitled Manuscript') => {
    const id = `project-${Date.now()}`;
    setState({
      project: {
        ...initialProject,
        id,
        title,
        createdAt: now(),
        lastModified: now(),
        stats: { ...initialProject.stats!, totalWords: 0 },
      },
      chapters: [],
      characters: [],
      currentView: 'dashboard',
    });
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ project: initialProject, chapters: initialChapters, characters: initialCharacters, currentView: 'dashboard' });
  };

  return (
    <CaspaRedesign
      user={{ displayName: 'Local Author', email: 'local@caspa.studio' }}
      project={{ ...state.project, stats: normaliseStats(state.project, totalWords) }}
      chapters={state.chapters}
      characters={state.characters}
      currentView={state.currentView}
      setCurrentView={setCurrentView}
      totalWords={totalWords}
      saveToCloud={saveToCloud}
      createNewProject={createNewProject}
      logout={logout}
    />
  );
}
