import {describe,it,expect} from 'vitest';
import {evaluateNumericConstraints,reasoningCapabilities} from '../src/services/atlas/formalReasoningBridge';
describe('ATLAS bounded formal reasoning',()=>{
 it('checks a valid assignment',()=>{
  const r=evaluateNumericConstraints({variables:{arrival:12},constraints:[{id:'deadline',left:'arrival',op:'lte',right:13}]});
  expect(r.status).toBe('satisfied');
 });
 it('reports violations rather than claiming impossible',()=>{
  const r=evaluateNumericConstraints({variables:{arrival:14},constraints:[{id:'deadline',left:'arrival',op:'lte',right:13}]});
  expect(r.status).toBe('violated');
  expect(r.checks[0].passed).toBe(false);
 });
 it('rejects unknown variables and nonfinite numbers',()=>{
  expect(evaluateNumericConstraints({variables:{x:Infinity},constraints:[{id:'c',left:'x',op:'eq',right:1}]}).status).toBe('invalid');
  expect(evaluateNumericConstraints({variables:{},constraints:[{id:'c',left:'missing',op:'eq',right:1}]}).status).toBe('invalid');
 });
 it('does not claim to solve unassigned variables',()=>expect(reasoningCapabilities.searchForAssignments).toBe(false));
});
