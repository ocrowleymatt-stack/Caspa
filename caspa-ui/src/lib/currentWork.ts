import type { ProductType, ProductionBrief } from '../api/studio';
import type { Project } from '../types';

export type CurrentWorkLabel =
  | 'Current Work'
  | 'Manuscript'
  | 'Script'
  | 'Show Book'
  | 'Screenplay'
  | 'Current Draft';

const PRODUCT_LABELS: Partial<Record<ProductType, CurrentWorkLabel>> = {
  novel: 'Manuscript',
  memoir: 'Manuscript',
  'nonfiction-book': 'Manuscript',
  'short-story': 'Manuscript',
  'poetry-collection': 'Manuscript',
  'stage-play': 'Script',
  screenplay: 'Screenplay',
  musical: 'Show Book',
  'show-in-a-box': 'Show Book',
};

export function currentWorkLabel(
  project?: Pick<Project, 'genre' | 'workType'> | null,
  brief?: Pick<ProductionBrief, 'productType'> | null,
): CurrentWorkLabel {
  const productType = brief?.productType;
  if (productType && PRODUCT_LABELS[productType]) {
    return PRODUCT_LABELS[productType]!;
  }
  const wt = project?.workType ?? '';
  if (wt.includes('play') || wt.includes('theatre')) return 'Script';
  if (wt.includes('screen') || wt.includes('screenplay')) return 'Screenplay';
  if (wt.includes('musical') || wt.includes('show')) return 'Show Book';
  if (wt.includes('novel') || wt.includes('memoir') || wt.includes('book')) return 'Manuscript';
  return 'Current Draft';
}

export function currentWorkDescription(label: CurrentWorkLabel): string {
  switch (label) {
    case 'Manuscript':
      return 'The live assembled book — chapters and sections you can read, expand, and export.';
    case 'Script':
      return 'The live script — acts, scenes, and dialogue as CASPA understands them.';
    case 'Show Book':
      return 'The live show book — book scenes, songs, and transitions.';
    case 'Screenplay':
      return 'The live screenplay — scenes and visual beats.';
    default:
      return 'The live assembled work — read it here, not in Writing History.';
  }
}
