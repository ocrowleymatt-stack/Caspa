import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCaspaCommand,reviewCandidate,canCommitManuscript,type DraftCandidate} from '../src/services/literary/conversationGate';
const candidate:DraftCandidate={id:'draft_123',scope:'chapter 7',content:'Proposed prose',status:'proposed',createdAt:'2026-11-03'};
test('ordinary conversation never authorises drafting',()=>{
 for(const text of ['go','brilliant, write it','please draft chapter 7','/drafting chapter 7','An idea: /draft chapter 7']){
   if(text.startsWith('/drafting')) assert.throws(()=>parseCaspaCommand(text),/Unknown/);
   else assert.equal(parseCaspaCommand(text).kind,'chat');
 }
});
test('draft requires explicit command and scope',()=>{
 assert.throws(()=>parseCaspaCommand('/draft'),/scope/);
 assert.deepEqual(parseCaspaCommand('/draft chapter 7'),{kind:'draft',scope:'chapter 7',instruction:'chapter 7'});
});
test('only matching approval may commit',()=>{
 assert.equal(canCommitManuscript(parseCaspaCommand('/approve draft_123'),candidate),true);
 assert.equal(canCommitManuscript(parseCaspaCommand('/draft chapter 7'),candidate),false);
 assert.equal(reviewCandidate(candidate,{kind:'reject',candidateId:'draft_123'}).status,'rejected');
 assert.equal(candidate.status,'proposed');
});
