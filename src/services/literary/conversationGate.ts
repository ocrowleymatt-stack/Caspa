/** CASPA conversational command gate: chat never mutates canonical manuscripts. */
export type CaspaMode='spitball'|'plan';
export type CaspaAction=
 |{kind:'chat';mode:CaspaMode;message:string}
 |{kind:'draft';scope:string;instruction:string}
 |{kind:'story';instruction:string}
 |{kind:'stitch';storyId:string;destination:string}
 |{kind:'approve';candidateId:string}
 |{kind:'reject';candidateId:string}
 |{kind:'mode';mode:CaspaMode}
 |{kind:'help'};
export function parseCaspaCommand(message:string,mode:CaspaMode='spitball'):CaspaAction {
 const input=message.trim();
 // Only a command at the start of the message can authorise manuscript operations.
 if(!input.startsWith('/')) return {kind:'chat',mode,message};
 const [first,...rest]=input.split(/\s+/);
 const command=first.toLowerCase();
 const arg=rest.join(' ').trim();
 if(command==='/spitball'||command==='/plan') return {kind:'mode',mode:command==='/plan'?'plan':'spitball'};
 if(command==='/help') return {kind:'help'};
 if(command==='/story'){
   if(!arg) throw new Error('Specify a story brief');
   return {kind:'story',instruction:arg};
 }
 if(command==='/stitch'){
   const match=arg.match(/^([a-zA-Z0-9_-]{3,128})\\s+(?:into\\s+)?(.+)$/i);
   if(!match) throw new Error('Usage: /stitch <story-id> into <book and placement>');
   return {kind:'stitch',storyId:match[1],destination:match[2].trim()};
 }
 if(command==='/draft'){
   if(!arg) throw new Error('Specify a drafting scope, e.g. /draft chapter 7 or /draft whole-book');
   return {kind:'draft',scope:arg,instruction:message.slice(first.length).trim()};
 }
 if(command==='/approve'||command==='/reject'){
   if(!/^[a-zA-Z0-9_-]{3,128}$/.test(arg)) throw new Error('Specify one valid candidate ID');
   return command==='/approve'?{kind:'approve',candidateId:arg}:{kind:'reject',candidateId:arg};
 }
 // Unrecognised slash commands cannot silently fall back to a write action.
 throw new Error('Unknown CASPA command: '+command);
}
export interface DraftCandidate {id:string;scope:string;content:string;status:'proposed'|'approved'|'rejected';createdAt:string}
export function reviewCandidate(candidate:DraftCandidate,action:Extract<CaspaAction,{kind:'approve'|'reject'}>):DraftCandidate {
 if(candidate.id!==action.candidateId) throw new Error('Candidate ID mismatch');
 if(candidate.status!=='proposed') throw new Error('Candidate already reviewed');
 return {...candidate,status:action.kind==='approve'?'approved':'rejected'};
}
/** A separate authenticated storage transaction must perform any canonical commit. */
export function canCommitManuscript(action:CaspaAction,candidate:DraftCandidate):boolean {
 return action.kind==='approve'&&candidate.id===action.candidateId&&candidate.status==='proposed';
}
