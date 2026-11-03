import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSeries,assessSeriesChange,createSeriesBlueprint,type SeriesBible} from '../src/services/literary/seriesArchitect';
const bible:SeriesBible={id:'series',name:'Example trilogy',kind:'fiction',titles:[
{id:'one',title:'One',format:'novel',order:1,status:'approved',premise:'Beginning',protected:true},
{id:'two',title:'Two',format:'novel',order:2,status:'drafting',premise:'Middle',relation:{toTitleId:'one',type:'sequel'}},
{id:'three',title:'Three',format:'stage',order:3,status:'idea',premise:'End',relation:{toTitleId:'two',type:'adaptation'}}
],facts:[{id:'f1',subject:'A',predicate:'alive',value:'yes',introducedIn:'one',canonical:true},{id:'f2',subject:'A',predicate:'alive',value:'no',introducedIn:'two',canonical:true}],threads:[{id:'t1',description:'Missing letter',openedIn:'one',resolvedIn:'three',state:'resolved',payoff:'Reveal'}],rules:[],sharedResearchIds:[]};
test('detects series-wide canon conflicts',()=>{assert.ok(auditSeries(bible).some(i=>i.code==='CANON_CONFLICT'));});
test('change to first book triggers downstream review without mutation',()=>{
 const before=JSON.stringify(bible);const impact=assessSeriesChange(bible,'one',['f1']);
 assert.deepEqual(impact.affectedTitles,['one','two','three']);
 assert.equal(impact.reviewThreads.length,1);
 assert.equal(JSON.stringify(bible),before);
});
test('series blueprint spans every title',()=>{const p=createSeriesBlueprint(bible);assert.match(p,/Example trilogy/);assert.match(p,/whole-book progressive construction/);});
