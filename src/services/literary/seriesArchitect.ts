/**
 * CASPA Series Architect — cross-title continuity and dependency planning.
 * Standalone data model; no destructive updates to existing Project records.
 */
export type TitleRelation = 'sequel' | 'prequel' | 'companion' | 'spin_off' | 'adaptation' | 'volume' | 'shared_universe';
export type SeriesTitleStatus = 'idea' | 'outlined' | 'drafting' | 'review' | 'approved' | 'published';
export interface SeriesTitle {
 id:string; title:string; projectId?:string; format:'novel'|'nonfiction'|'film'|'stage'|'other';
 order:number; status:SeriesTitleStatus; premise:string; ending?:string; targetWords?:number;
 relation?:{toTitleId:string;type:TitleRelation}; protected?:boolean;
}
export interface SeriesFact {
 id:string; subject:string; predicate:string; value:string; introducedIn:string;
 validFrom?:number; validUntil?:number; canonical:boolean; source?:string; protected?:boolean;
}
export interface SeriesThread {
 id:string; description:string; openedIn:string; resolvedIn?:string;
 state:'open'|'resolved'|'abandoned'; payoff?:string; protected?:boolean;
}
export interface SeriesBible {
 id:string; name:string; kind:'fiction'|'nonfiction'|'mixed';
 titles:SeriesTitle[]; facts:SeriesFact[]; threads:SeriesThread[];
 rules:string[]; sharedResearchIds:string[];
}
export interface SeriesIssue {code:string;severity:'blocker'|'warning';message:string;affectedTitles:string[]}
const copy=<T>(x:T):T=>JSON.parse(JSON.stringify(x));
export function auditSeries(bible:SeriesBible):SeriesIssue[] {
 const issues:SeriesIssue[]=[];
 const titles=new Map(bible.titles.map(t=>[t.id,t]));
 if (titles.size!==bible.titles.length) issues.push({code:'DUPLICATE_TITLE',severity:'blocker',message:'Duplicate title IDs',affectedTitles:[]});
 const factIds=new Set<string>();
 for(const fact of bible.facts){
   if(factIds.has(fact.id)) issues.push({code:'DUPLICATE_FACT',severity:'blocker',message:'Duplicate fact ID',affectedTitles:[fact.introducedIn]});
   factIds.add(fact.id);
   if(!titles.has(fact.introducedIn)) issues.push({code:'ORPHAN_FACT',severity:'blocker',message:'Fact references missing title',affectedTitles:[fact.introducedIn]});
 }
 for(const title of bible.titles){
   if(title.relation && !titles.has(title.relation.toTitleId)) issues.push({code:'ORPHAN_RELATION',severity:'blocker',message:'Related title does not exist',affectedTitles:[title.id]});
   if(title.relation?.toTitleId===title.id) issues.push({code:'SELF_RELATION',severity:'blocker',message:'Title cannot relate to itself',affectedTitles:[title.id]});
 }
 for(const thread of bible.threads){
   if(!titles.has(thread.openedIn) || (thread.resolvedIn && !titles.has(thread.resolvedIn))) issues.push({code:'ORPHAN_THREAD',severity:'blocker',message:'Thread references missing title',affectedTitles:[thread.openedIn,thread.resolvedIn||''].filter(Boolean)});
   if(thread.state==='resolved' && !thread.resolvedIn) issues.push({code:'MISSING_PAYOFF',severity:'warning',message:'Resolved thread has no resolution title',affectedTitles:[thread.openedIn]});
   if(thread.resolvedIn && titles.has(thread.openedIn) && titles.has(thread.resolvedIn) && titles.get(thread.resolvedIn)!.order<titles.get(thread.openedIn)!.order) issues.push({code:'PAYOFF_BEFORE_SETUP',severity:'warning',message:'Thread resolves before its introduction',affectedTitles:[thread.openedIn,thread.resolvedIn]});
 }
 for(let i=0;i<bible.facts.length;i++) for(let j=i+1;j<bible.facts.length;j++){
   const a=bible.facts[i],b=bible.facts[j];
   if(a.canonical&&b.canonical&&a.subject.toLowerCase()===b.subject.toLowerCase()&&a.predicate.toLowerCase()===b.predicate.toLowerCase()&&a.value!==b.value){
     const startA=a.validFrom??Number.NEGATIVE_INFINITY,endA=a.validUntil??Number.POSITIVE_INFINITY;
     const startB=b.validFrom??Number.NEGATIVE_INFINITY,endB=b.validUntil??Number.POSITIVE_INFINITY;
     if(startA<=endB&&startB<=endA) issues.push({code:'CANON_CONFLICT',severity:'warning',message:'Conflicting canonical facts: '+a.subject+' / '+a.predicate,affectedTitles:[a.introducedIn,b.introducedIn]});
   }
 }
 return issues;
}
export function assessSeriesChange(bible:SeriesBible, changedTitleId:string, changedFactIds:string[]=[]):{affectedTitles:string[];issues:SeriesIssue[];reviewThreads:SeriesThread[]} {
 const source=bible.titles.find(t=>t.id===changedTitleId);
 if(!source) throw new Error('Unknown title');
 const affected=new Set([changedTitleId]);
 for(const title of bible.titles) if(title.order>=source.order || title.relation?.toTitleId===changedTitleId) affected.add(title.id);
 for(const fact of bible.facts) if(changedFactIds.includes(fact.id)) {
   const origin=bible.titles.find(t=>t.id===fact.introducedIn);
   if(origin) for(const title of bible.titles) if(title.order>=origin.order) affected.add(title.id);
 }
 const reviewThreads=bible.threads.filter(t=>affected.has(t.openedIn)||Boolean(t.resolvedIn&&affected.has(t.resolvedIn)));
 return {affectedTitles:[...affected],issues:auditSeries(bible).filter(i=>i.affectedTitles.some(id=>affected.has(id))),reviewThreads:copy(reviewThreads)};
}
export function createSeriesBlueprint(bible:SeriesBible):string {
 const sorted=[...bible.titles].sort((a,b)=>a.order-b.order);
 return [
 'CASPA SERIES ARCHITECT: Plan the complete connected work before drafting individual titles.',
 'Preserve canon, protected passages, approved titles, research provenance and authorial intent.',
 'Maintain independent narrative arcs for each title and a larger series-level arc.',
 'No retcons without explicit approval. Distinguish planned reveals from continuity errors.',
 'Fiction: track identities, chronology, character knowledge, deaths, motivations, promises and payoffs.',
 'Nonfiction: track shared definitions, evidence, citations, claims, contradictions and cross-volume references.',
 'Each title uses whole-book progressive construction, not isolated chapter generation.',
 'Return an ordered series-wide miniature, then title-level miniatures, dependency map and editorial risks.',
 'Series: '+JSON.stringify(bible)
 ].join('\\n\\n');
}
