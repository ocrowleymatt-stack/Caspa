import test from 'node:test';
import assert from 'node:assert/strict';
import {createGhostBlendSession,buildGhostBlenderPrompt,auditGhostBlend} from '../src/services/literary/ghostBlender';

test('blends unfinished ideas with a book into five distinct format proposals',()=>{
 const inputs=[
  {id:'book',kind:'manuscript' as const,title:'The Harbour',content:'A mariner returns to an abandoned harbour. He finds a ledger that names the missing ships.',approved:true},
  {id:'note',kind:'notes' as const,title:'The Clock',content:'A clock stops every night at the same time. Nobody can agree what happened then.'},
  {id:'photo',kind:'image_description' as const,title:'Old photograph',content:'',visualDescription:'An empty Victorian theatre with one illuminated seat.'}
 ];
 const session=createGhostBlendSession({ingredients:inputs});
 assert.equal(session.candidates.length,5);
 assert.deepEqual(session.candidates.map(c=>c.format),['novel','trilogy','sequel','film','stage']);
 assert.deepEqual(session.protectedIngredientIds,['book']);
 assert.equal(session.originalIngredients[0].content,inputs[0].content);
 assert.deepEqual(auditGhostBlend(session),[]);
 assert.match(buildGhostBlenderPrompt(session),/Never overwrite source material/);
});
test('rejects invalid ingredient identity and catches tampering',()=>{
 assert.throws(()=>createGhostBlendSession({ingredients:[{id:'a',kind:'notes',title:'One',content:'text'},{id:'a',kind:'notes',title:'Two',content:'text'}]}),/unique/);
 const session=createGhostBlendSession({ingredients:[{id:'a',kind:'notes',title:'One',content:'A complete thought that can become a story.'}]});
 session.originalIngredients[0].content='changed';
 assert.ok(auditGhostBlend(session).some(x=>x.includes('BLOCKER')));
});
