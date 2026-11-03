import {TruthMaintenance, type EvidenceState, type ClaimEvaluation} from './truthMaintenance';
export interface EvidenceStateEvent {eventId:string; evidenceId:string; state:EvidenceState; at:string; actorId:string; reason:string}
export interface EvidenceRevision {event:EvidenceStateEvent; before:ClaimEvaluation[]; after:ClaimEvaluation[]; changed:{claimId:string;from:string;to:string}[]}
/** Append-only audit trail around the dependency engine. Persist events transactionally in the host store. */
export class EvidenceEventLedger {
 private readonly events:EvidenceStateEvent[]=[];
 private readonly seen=new Set<string>();
 constructor(private readonly engine:TruthMaintenance){}
 revise(event:EvidenceStateEvent):EvidenceRevision {
  if(!event.eventId||!event.evidenceId||!event.actorId||!event.reason.trim()||!Number.isFinite(Date.parse(event.at)))
   throw Error('Evidence revision requires event ID, evidence ID, actor, reason and valid timestamp');
  if(!['accepted','disputed','withdrawn'].includes(event.state))throw Error('Invalid evidence state');
  if(this.seen.has(event.eventId))throw Error('Duplicate event');
  const before=this.engine.evaluateAll();
  this.engine.setEvidenceState(event.evidenceId,event.state);
  const after=this.engine.evaluateAll();
  this.events.push(Object.freeze({...event}));
  this.seen.add(event.eventId);
  const previous=new Map(before.map(c=>[c.id,c.state]));
  return {event:{...event},before,after,changed:after.filter(c=>c.state!==previous.get(c.id)).map(c=>({claimId:c.id,from:previous.get(c.id)!,to:c.state}))};
 }
 history(evidenceId?:string):EvidenceStateEvent[]{return this.events.filter(e=>!evidenceId||e.evidenceId===evidenceId).map(e=>({...e}))}
}
