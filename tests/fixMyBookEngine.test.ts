import test from 'node:test';
import assert from 'node:assert/strict';
import {createRescueVault,applyRepair,auditManuscript,planProgressiveConstruction,hashBook,buildRepairBrief,type Manuscript} from '../src/services/literary/fixMyBookEngine';

const book: Manuscript = {title:'Example',kind:'nonfiction',sections:[{id:'s1',title:'Argument',passages:[{id:'p1',text:'Keep this.',approved:true},{id:'p2',text:'Original claim.',evidenceIds:['e1']}]}],evidence:[{id:'e1',citation:'Sample source',status:'unverified'}]};
test('original and approved passages survive repairs',()=>{
 const vault=createRescueVault(book); const originalHash=hashBook(book);
 const result=applyRepair(vault,[{sectionId:'s1',passageId:'p1',replacement:'Destroy',rationale:'test'},{sectionId:'s1',passageId:'p2',replacement:'Revised claim.',rationale:'clarity'}]);
 assert.equal(result.rejected[0].code,'PROTECTED');
 assert.equal(result.revised.sections[0].passages[0].text,'Keep this.');
 assert.equal(result.revised.sections[0].passages[1].text,'Revised claim.');
 assert.equal(hashBook(book),originalHash);
 assert.equal(result.changes.length,1);
 assert.equal(result.changes[0].before,'Original claim.');
});
test('rejects invented citation identifiers',()=>{
 const result=applyRepair(createRescueVault(book),[{sectionId:'s1',passageId:'p2',replacement:'New.',rationale:'test',evidenceIds:['invented']}]);
 assert.equal(result.rejected[0].code,'UNKNOWN_CITATION');
 assert.equal(result.changes.length,0);
});
test('unverified evidence stays unverified',()=>{
 const result=applyRepair(createRescueVault(book),[]);
 assert.ok(result.audit.some(i=>i.code==='UNVERIFIED_SOURCE'));
});
test('whole-book stages and brief are available',()=>{
 assert.equal(planProgressiveConstruction(80000).at(-1)?.targetWords,80000);
 assert.match(buildRepairBrief(createRescueVault(book),80000),/whole-book editorial repair/);
});