import { IconStandard, IconMature, IconTransgressive } from './components/MaturityIcons';

export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'novel', label: 'Novel' },
  { value: 'screenplay', label: 'Screenplay' },
  { value: 'legal', label: 'Legal Brief' },
  { value: 'academic', label: 'Academic Paper' },
  { value: 'stageplay', label: 'Stage Play' },
  { value: 'radioplay', label: 'Radio Drama' },
  { value: 'coursebook', label: 'Course Book' },
  { value: 'subject_bible', label: 'Subject Bible' },
  { value: 'cookbook', label: 'Cookbook' },
  { value: 'illustrated', label: 'Illustrated Book' },
];

export const GENRES = [
  'Literary Fiction', 'Psychological Thriller', 'Noir', 'Speculative Fiction', 
  'Grimdark Fantasy', 'Space Opera', 'Cyberpunk', 'Magical Realism', 
  'Historical Fiction', 'Creative Non-Fiction', 'True Crime', 'Educational',
  'Manual/Guide', 'Reference', 'Memoir', 'Philosophical', 'Satire', 'Cookbook',
  'Subject Bible', 'Curriculum', 'Graphic Narrative', 'Steampunk', 'Body Horror',
  'Cozy Mystery', 'Hard Sci-Fi', 'Solarpunk', 'Epic Poetry', 'Case Study',
  'Religious Text', 'Folklore', 'Mythology', 'Field Guide'
];

export const TONES = [
  'Cinematic',
  'Noir',
  'Gritty',
  'Whimsical',
  'Formal',
  'Academic',
  'Poetic',
  'Minimalist',
  'Humorous',
  'Suspenseful'
];

export const MATURITY_LEVELS: { value: MaturityLevel; label: string; icon: any; color: string; bgColor: string; description: string }[] = [
  { 
    value: 'standard', 
    label: 'Vanilla',
    icon: IconStandard,
    color: 'text-slate-400', 
    bgColor: 'bg-slate-100',
    description: 'Clean content. No explicit material. Safe for general audiences.'
  },
  { 
    value: 'mature', 
    label: 'Porny',
    icon: IconMature,
    color: 'text-amber-500', 
    bgColor: 'bg-amber-100',
    description: 'Adult themes, strong language, and suggestive content. Clothes are optional.'
  },
  { 
    value: 'transgressive', 
    label: 'Hardcore',
    icon: IconTransgressive,
    color: 'text-red-500', 
    bgColor: 'bg-red-100',
    description: 'Explicit content. Nothing is off the table. The AI will not look away.'
  },
];
