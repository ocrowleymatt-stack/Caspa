/** Shared ATLAS Foundry v1 protocol. No client is trusted to assert user identity. */
export type AtlasMode='examine'|'wildcard'|'synthesis'|'invent'|'challenge';
export type AtlasTask='research'|'reason'|'verify'|'discover'|'remember'|'caspa'|'chamber'|'live-call';
export type ClaimStatus='verified'|'supported'|'disputed'|'unverified'|'refuted';
export interface AtlasClaim {id:string;statement:string;status:ClaimStatus;sourceIds:string[];scope?:{jurisdiction?:string;asOf?:string};reason?:string}
export interface AtlasEvidence {id:string;sourceRef:string;excerpt?:string;timestamp?:string;verifiedAt?:string}
export interface AtlasRequest {
 requestId:string;projectId:string;client:'librechat'|'chatgpt'|'chamber'|'atlas'|'caspa';
 mode:AtlasMode;task:AtlasTask;input:unknown;sourceRefs?:string[];idempotencyKey?:string;
 consent?:{captureAudio?:boolean;sendAction?:boolean};
}
export interface AtlasResponse {
 requestId:string;status:'completed'|'partial'|'blocked'|'failed';
 claims:AtlasClaim[];evidence:AtlasEvidence[];hypotheses:{id:string;statement:string;test?:string}[];
 uncertainties:string[];toolRuns:{tool:string;resultRef?:string}[];artefacts:{id:string;type:string}[];
 nextActions:string[];auditRef:string;
}
export interface LiveCallSegment {id:string;timestamp:string;text:string;speaker?:string;source:'authorised-transcript'|'manual-note'}
export interface LiveCallAdvice {segmentIds:string[];suggestedReply:string;questions:string[];commitments:string[];references:string[];warnings:string[]}
export function validateClaim(claim:AtlasClaim,evidence:AtlasEvidence[]):string[]{
 const errors:string[]=[];
 if(!claim.id||!claim.statement.trim())errors.push('Claim requires an ID and statement');
 if(claim.status==='verified'){
  if(!claim.sourceIds.length)errors.push('Verified claim requires sources');
  for(const id of claim.sourceIds)if(!evidence.some(e=>e.id===id&&!!e.sourceRef&&!!e.verifiedAt))errors.push('Verified claim requires checked source '+id);
 }
 return errors;
}
export function prepareCallAdvice(segments:LiveCallSegment[]):{transcript:string;instructions:string}{
 const transcript=segments.map(s=>`[${s.timestamp}] [${s.source}] [${s.speaker||'speaker unknown'}] ${s.text}`).join('\n');
 return {transcript,instructions:'Provide brief, user-visible suggestions only. Extract exact reference numbers, promises, questions and dates with segment IDs. Distinguish transcript claims from established facts. Never initiate recording, speak into the call, send messages or operate apps. Respect pause/stop. Do not fabricate transcript content.'};
}
