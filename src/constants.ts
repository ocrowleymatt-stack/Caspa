import { ProjectType, MaturityLevel } from './types';
import { Book, AlertCircle, ShieldAlert } from 'lucide-react';

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
    label: 'Standard', 
    icon: Book, 
    color: 'text-slate-600', 
    bgColor: 'bg-slate-100',
    description: 'Safe for general audiences. Focuses on narrative structure without explicit content.'
  },
  { 
    value: 'mature', 
    label: 'Mature', 
    icon: AlertCircle, 
    color: 'text-amber-600', 
    bgColor: 'bg-amber-100',
    description: 'Contains complex themes, strong language, or non-graphic violence appropriate for adult readers.'
  },
  { 
    value: 'transgressive', 
    label: 'Transgressive', 
    icon: ShieldAlert, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100',
    description: 'Highly experimental or boundary-pushing content. Exploring darker psychological depths.'
  },
];
