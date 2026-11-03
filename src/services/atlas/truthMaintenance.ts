/** Dependency-based truth maintenance. Evidence is immutable; conclusions are derived views. */
export type EvidenceState='accepted'|'disputed'|'withdrawn';
export type ConclusionState='supported'|'contested'|'unsupported';
export interface EvidenceRecord {id:string;sourceRef:string;state:EvidenceState;recordedAt:string}
export interface DerivedClaim {id:string;statement:string;requires:string[];alternatives?:string[][]}
export interface ClaimEvaluation {id:string;state:ConclusionState;missing:string[];disputed:string[];supporting:string[]}
export class TruthMaintenance {
 private evidence=new Map<string,EvidenceRecord>();
 private claims=new Map<string,DerivedClaim>();
 addEvidence(e:EvidenceRecord):void{
  if(!e.id||!e.sourceRef||!e.recordedAt)throw Error('Evidence requires id, sourceRef and recordedAt');
  if(this.evidence.has(e.id))throw Error('Evidence IDs are immutable; append a new version');
  this.evidence.set(e.id,{...e});
 }
 setEvidenceState(id:string,state:EvidenceState):void{
  const e=this.evidence.get(id);if(!e)throw Error('Unknown evidence');
  this.evidence.set(id,{...e,state});
 }
 addClaim(c:DerivedClaim):void{
  if(!c.id||!c.statement.trim())throw Error('Claim requires id and statement');
  if(this.claims.has(c.id))throw Error('Duplicate claim');
  if(!c.requires.length&&!(c.alternatives?.length))throw Error('Claim needs explicit dependencies');
  this.claims.set(c.id,{...c,requires:[...c.requires],alternatives:c.alternatives?.map(a=>[...a])});
  try{this.evaluate(c.id)}catch(e){this.claims.delete(c.id);throw e}
 }
 evaluate(id:string):ClaimEvaluation {
  const visit=(claimId:string,stack:Set<string>):ClaimEvaluation=>{
   if(stack.has(claimId))throw Error('Cyclic claim dependency');
   const c=this.claims.get(claimId);if(!c)throw Error('Unknown claim: '+claimId);
   const next=new Set(stack);next.add(claimId);
   const groups=[c.requires,...(c.alternatives||[])].filter(g=>g.length);
   const options=groups.map(group=>{
    const missing:string[]=[],disputed:string[]=[],supporting:string[]=[];
    for(const dep of group){
     const e=this.evidence.get(dep);
     if(e){if(e.state==='accepted')supporting.push(dep);else if(e.state==='disputed')disputed.push(dep);else missing.push(dep);}
     else if(this.claims.has(dep)){
      const r=visit(dep,next);
      if(r.state==='supported')supporting.push(dep);
      else if(r.state==='contested')disputed.push(dep);
      else missing.push(dep);
     }else missing.push(dep);
    }
    return {missing,disputed,supporting,state:(missing.length?'unsupported':disputed.length?'contested':'supported') as ConclusionState};
   });
   const rank={supported:0,contested:1,unsupported:2};
   options.sort((a,b)=>rank[a.state]-rank[b.state]||b.supporting.length-a.supporting.length);
   return {id:claimId,...options[0]};
  };
  return visit(id,new Set());
 }
 evaluateAll():ClaimEvaluation[]{return [...this.claims.keys()].map(id=>this.evaluate(id))}
}
