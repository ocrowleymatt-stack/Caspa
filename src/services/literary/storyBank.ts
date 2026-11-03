/** Standalone story-bank records and non-destructive stitch planning. */
export type StoryStatus='draft'|'approved'|'archived';
export interface StoryBankEntry {
 id:string;title:string;content:string;status:StoryStatus;createdAt:string;
 tags:string[];characters:string[];universeId?:string;seriesId?:string;
 sourceConversationId?:string;sourcePrompt?:string;revision:number;
}
export interface StitchProposal {
 storyId:string;targetProjectId:string;placement:string;
 transitionBefore:string;transitionAfter:string;
 continuityRisks:string[];adaptations:string[];
 status:'proposed'|'approved'|'rejected';
}
export function createStoryEntry(input:Omit<StoryBankEntry,'revision'|'status'|'createdAt'> & {createdAt?:string}):StoryBankEntry {
 if(!input.id.trim()||!input.title.trim()||!input.content.trim()) throw new Error('Story needs ID, title and content');
 return {...input,tags:[...input.tags],characters:[...input.characters],status:'draft',createdAt:input.createdAt||new Date().toISOString(),revision:1};
}
export function planStitch(story:StoryBankEntry,targetProjectId:string,placement:string):StitchProposal {
 if(!targetProjectId.trim()||!placement.trim()) throw new Error('Stitch requires a book and placement');
 return {storyId:story.id,targetProjectId,placement,transitionBefore:'To be reviewed',transitionAfter:'To be reviewed',
 continuityRisks:['Check chronology, cast knowledge, existing canon and narrative voice'],adaptations:[],status:'proposed'};
}
export function buildStitchPrompt(story:StoryBankEntry,proposal:StitchProposal,context:string):string {
 return ['CASPA STITCHING ROOM: propose an insertion; never directly modify canonical manuscripts.',
 'Preserve the original short story and approved manuscript passages. Assess timeline, causality, character knowledge, voice, transitions and cross-book effects.',
 'Return proposed bridge text, edits, continuity issues and placement rationale for author approval.',
 'STORY:',JSON.stringify(story),'TARGET:',JSON.stringify(proposal),'SURROUNDING BOOK CONTEXT:',context].join('\n\n');
}
