/**
 * CASPA Ghost Blender — non-destructive concept recombination laboratory.
 * Uses explicit ingredients; never treats an image filename as analysed visual content.
 * Candidates are proposals, not completed books or verified adaptations.
 */
import { createHash, randomUUID } from 'node:crypto';

export type IngredientKind = 'manuscript' | 'unfinished_idea' | 'notes' | 'image_description' | 'research';
export type OutputFormat = 'novel' | 'trilogy' | 'sequel' | 'film' | 'stage';
export interface Ingredient {
  id: string; kind: IngredientKind; title: string; content: string;
  protected?: boolean; approved?: boolean; sourceId?: string;
  /** Only user-supplied or genuinely extracted visual description; never guess from filenames. */
  visualDescription?: string;
}
export interface GhostBlendRequest {
  ingredients: Ingredient[];
  formats?: OutputFormat[];
  tone?: string;
  constraints?: string[];
  permissionToTransform?: boolean;
}
export interface BlendCandidate {
  id: string; format: OutputFormat; title: string; logline: string;
  ingredientIds: string[]; premise: string; narrativeSpine: string[];
  salvage: string[]; novelty: string; risks: string[]; nextStep: string;
}
export interface GhostBlendSession {
  id: string; createdAt: string; sourceHash: string;
  originalIngredients: Ingredient[]; protectedIngredientIds: string[];
  candidates: BlendCandidate[]; audit: string[];
}
const clone = <T>(v:T):T => JSON.parse(JSON.stringify(v));
const hash = (v:unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const allowed: OutputFormat[] = ['novel','trilogy','sequel','film','stage'];
const fragments = (text:string) => text.split(/(?<=[.!?])\\s+|\\n+/).map(s=>s.trim()).filter(s=>s.length>18).slice(0,12);
const short = (text:string, max=170) => text.length>max ? text.slice(0,max).trimEnd()+'…' : text;
function validate(request:GhostBlendRequest):void {
 if (!request || !Array.isArray(request.ingredients) || !request.ingredients.length) throw new Error('Supply at least one ingredient');
 const ids=new Set<string>();
 for (const i of request.ingredients) {
   if (!i.id || ids.has(i.id)) throw new Error('Ingredient IDs must be unique');
   if (!i.title?.trim() || (!i.content?.trim() && !i.visualDescription?.trim())) throw new Error('Each ingredient needs a title and text or visual description');
   ids.add(i.id);
 }
 if (request.formats?.some(f=>!allowed.includes(f))) throw new Error('Unknown output format');
}
export function createGhostBlendSession(request:GhostBlendRequest):GhostBlendSession {
 validate(request);
 const ingredients=clone(request.ingredients);
 const formats=[...new Set(request.formats?.length ? request.formats : allowed)];
 const protectedIngredientIds=ingredients.filter(i=>i.protected || i.approved).map(i=>i.id);
 const ideas=ingredients.map(i=>({id:i.id,title:i.title,kind:i.kind,beats:fragments(i.visualDescription || i.content)}));
 const audit:string[]=[];
 if (ingredients.some(i=>i.kind==='image_description' && !i.visualDescription)) audit.push('Image ingredient supplied without an explicit visual description: no image interpretation has been performed.');
 if (ingredients.some(i=>i.kind==='research')) audit.push('Research ingredients are creative inputs only: factual assertions and citations must be independently verified before publication.');
 if (ingredients.length<2) audit.push('Only one ingredient supplied: results are format transformations, not cross-source recombinations.');
 const candidates=formats.map((format,index)=>{
   const rotated=ideas.map((_,j)=>ideas[(j+index)%ideas.length]);
   const primary=rotated[0];
   const secondary=rotated[1] || primary;
   const beats=rotated.flatMap(i=>i.beats.slice(0,2));
   const title=primary.title + (format==='trilogy'?' — Three Movements':format==='sequel'?' — Aftermath':format==='film'?' — Screen Treatment':format==='stage'?' — On Stage':' — Reimagined');
   const spines:Record<OutputFormat,string[]>={
     novel:['Establish the central disturbance','Introduce a conflicting desire','Force an irreversible decision','Escalate the cost','Deliver a transformed ending'],
     trilogy:['Book I: establish the rupture and its immediate cost','Book II: reverse the apparent truth and widen the consequences','Book III: resolve the original promise with earned transformation'],
     sequel:['Identify the original ending and its unresolved consequences','Create a fresh conflict rather than repeat the first plot','Revisit changed relationships','Escalate into a distinct climax','Conclude the new arc'],
     film:['Visual opening image','Inciting incident and clear protagonist objective','First major reversal','Midpoint and rising stakes','Climax and visual resolution'],
     stage:['Establish a playable setting and dramatic conflict','Develop dialogue-driven confrontation','Introduce an onstage reversal','Raise stakes through performance rather than exposition','Deliver a theatrical resolution']
   };
   const sourceBeat=beats[index%Math.max(1,beats.length)] || primary.title;
   return {
     id:randomUUID(),format,title,
     logline:short('What if '+primary.title+' were transformed by '+secondary.title+'? '+sourceBeat),
     ingredientIds:[...new Set([primary.id,secondary.id,...rotated.slice(2).map(i=>i.id)])],
     premise:short(sourceBeat+' The material from '+secondary.title+' becomes the opposing force or revealing context.',320),
     narrativeSpine:spines[format],
     salvage:rotated.flatMap(i=>i.beats.slice(0,2).map(b=>i.title+': '+short(b,150))).slice(0,12),
     novelty:ingredients.length>1?'Cross-source recombination of premises, motifs and dramatic functions':'Alternative dramatic form for the original material',
     risks:[format==='sequel'?'Check that the source has a genuine ending and sequel-worthy consequences':'Validate structural originality against source',format==='stage'?'Check stage feasibility and cast/set economics':format==='film'?'Develop visual action and scene economy':'Check pacing and audience promise','Protect approved passages and original source records'],
     nextStep:'Editorial selection → full-work miniature → progressive construction → independent review → DOH audit'
   };
 });
 return {id:randomUUID(),createdAt:new Date().toISOString(),sourceHash:hash(ingredients),originalIngredients:ingredients,protectedIngredientIds,candidates,audit};
}
/** Use this with CASPA's AI router to produce imaginative candidate JSON, never as an instruction to overwrite originals. */
export function buildGhostBlenderPrompt(session:GhostBlendSession, constraints:string[]=[]):string {
 return [
  'CASPA GHOST BLENDER — creative recombination laboratory.',
  'Return a JSON array of genuinely distinct concept candidates, with format, title, logline, ingredientIds, premise, narrativeSpine, salvage, novelty, risks and nextStep.',
  'Generate bold alternative premises, not cosmetic rewrites. Test genre changes, reversals, new dramatic functions and surprising connections.',
  'Candidate formats: novel, trilogy, sequel, film, stage. Film/stage are proposals, not completed scripts.',
  'Never overwrite source material. Approved material is protected. Distinguish verbatim salvage from new text.',
  'Do not invent facts, citations or image contents. Image description is only what the user supplied or a verified image-processing result.',
  'Research-derived claims must remain unverified until checked against original sources.',
  'Do not imply the user owns third-party adaptation rights. Flag rights and permissions where relevant.',
  'For each candidate specify a complete beginning-middle-ending miniature before requesting long-form expansion.',
  'Constraints: '+JSON.stringify(constraints),
  'Protected IDs: '+JSON.stringify(session.protectedIngredientIds),
  'Original ingredients: '+JSON.stringify(session.originalIngredients),
  'Deterministic baseline concepts: '+JSON.stringify(session.candidates)
 ].join('\\n\\n');
}
export function auditGhostBlend(session:GhostBlendSession):string[] {
 const issues=[...session.audit];
 if (hash(session.originalIngredients)!==session.sourceHash) issues.push('BLOCKER: Original ingredients have changed since session creation');
 const known=new Set(session.originalIngredients.map(i=>i.id));
 for(const c of session.candidates) {
   if (!c.ingredientIds.length || c.ingredientIds.some(id=>!known.has(id))) issues.push('BLOCKER: Candidate '+c.id+' has invalid provenance');
   if (c.narrativeSpine.length<3) issues.push('Candidate '+c.id+' lacks a complete narrative spine');
 }
 return issues;
}
