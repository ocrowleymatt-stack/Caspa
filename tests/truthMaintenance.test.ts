import {describe,it,expect} from 'vitest';
import {TruthMaintenance} from '../src/services/atlas/truthMaintenance';
describe('ATLAS truth maintenance',()=>{
 it('withdrawal invalidates dependent conclusions without erasing evidence',()=>{
  const tm=new TruthMaintenance();
  tm.addEvidence({id:'e1',sourceRef:'document:1',state:'accepted',recordedAt:'2026-11-03'});
  tm.addClaim({id:'c1',statement:'first inference',requires:['e1']});
  tm.addClaim({id:'c2',statement:'second inference',requires:['c1']});
  expect(tm.evaluate('c2').state).toBe('supported');
  tm.setEvidenceState('e1','withdrawn');
  expect(tm.evaluate('c2').state).toBe('unsupported');
  tm.setEvidenceState('e1','disputed');
  expect(tm.evaluate('c2').state).toBe('contested');
 });
 it('preserves alternate supporting paths',()=>{
  const tm=new TruthMaintenance();
  tm.addEvidence({id:'a',sourceRef:'a',state:'withdrawn',recordedAt:'2026-11-03'});
  tm.addEvidence({id:'b',sourceRef:'b',state:'accepted',recordedAt:'2026-11-03'});
  tm.addClaim({id:'c',statement:'candidate',requires:['a'],alternatives:[['b']]});
  expect(tm.evaluate('c').state).toBe('supported');
 });
 it('rejects unsupported claims and cycles',()=>{
  const tm=new TruthMaintenance();
  expect(()=>tm.addClaim({id:'a',statement:'x',requires:[]})).toThrow();
  tm.addClaim({id:'a',statement:'x',requires:['b']});
  expect(()=>tm.addClaim({id:'b',statement:'y',requires:['a']})).toThrow();
 });
});
