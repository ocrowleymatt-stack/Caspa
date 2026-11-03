/** ATLAS deterministic reasoning bridge: validation and safe, bounded inference. */
export type Comparison='eq'|'neq'|'lt'|'lte'|'gt'|'gte';
export interface NumericConstraint {id:string;left:string;op:Comparison;right:number}
export interface NumericProblem {variables:Record<string,number>;constraints:NumericConstraint[]}
export interface ConstraintResult {status:'satisfied'|'violated'|'invalid';checks:{id:string;passed:boolean;actual?:number;expected:number;op:Comparison;error?:string}[];errors:string[]}
const compare=(a:number,op:Comparison,b:number):boolean=>({
 eq:()=>a===b,neq:()=>a!==b,lt:()=>a<b,lte:()=>a<=b,gt:()=>a>b,gte:()=>a>=b
})[op]();
export function evaluateNumericConstraints(problem:NumericProblem):ConstraintResult {
 const errors:string[]=[];
 if(!problem||typeof problem!=='object'||!problem.variables||!Array.isArray(problem.constraints))
  return {status:'invalid',checks:[],errors:['Malformed problem']};
 const vars=problem.variables;
 for(const [key,value] of Object.entries(vars))
  if(!key||typeof value!=='number'||!Number.isFinite(value))errors.push('Invalid variable '+key);
 const seen=new Set<string>();
 const checks=problem.constraints.map(c=>{
  const err:string[]=[];
  if(!c||typeof c.id!=='string'||!c.id)err.push('Missing constraint ID');
  else if(seen.has(c.id))err.push('Duplicate constraint ID');
  if(c?.id)seen.add(c.id);
  if(!Object.prototype.hasOwnProperty.call(vars,c?.left))err.push('Unknown variable');
  if(!['eq','neq','lt','lte','gt','gte'].includes(c?.op))err.push('Invalid operator');
  if(typeof c?.right!=='number'||!Number.isFinite(c.right))err.push('Invalid right operand');
  const actual=vars[c?.left];
  if(typeof actual!=='number'||!Number.isFinite(actual))err.push('Invalid left operand');
  if(err.length){errors.push(...err.map(e=>`${c?.id||'?'}: ${e}`));return {id:c?.id||'?',passed:false,expected:c?.right,op:c?.op,error:err.join('; ')}}
  return {id:c.id,passed:compare(actual,c.op,c.right),actual,expected:c.right,op:c.op};
 });
 return {status:errors.length?'invalid':checks.every(c=>c.passed)?'satisfied':'violated',checks,errors};
}
/** The adapter MUST NOT claim this is general SAT/SMT solving: it checks a supplied assignment only. */
export const reasoningCapabilities={numericAssignmentChecking:true,searchForAssignments:false,formalProofs:false,externalSolverRequiredForSMT:true} as const;
