import {describe,it,expect} from 'vitest';
import {TruthMaintenance} from '../src/services/atlas/truthMaintenance';
import {EvidenceEventLedger} from '../src/services/atlas/evidenceEventLedger';
const setup=()=>{const engine=new TruthMaintenance();engine.addEvidence({id:'e',sourceRef:'document:1',state:'accepted',recordedAt:'2026-11-03T00:00:00Z'});engine.addClaim({id:'c',statement:'Dependent assertion',requires:['e']});return {engine,ledger:new EvidenceEventLedger(engine)}};
describe('Evidence revision audit',()=>{
 it('records transitions and recomputes dependent claims',()=>{const {engine,ledger}=setup();const r=ledger.revise({eventId:'v1',evidenceId:'e',state:'withdrawn',at:'2026-11-03T01:00:00Z',actorId:'reviewer',reason:'Source withdrawn'});expect(r.changed).toEqual([{claimId:'c',from:'supported',to:'unsupported'}]);expect(engine.evaluate('c').state).toBe('unsupported');expect(ledger.history('e')).toHaveLength(1)});
 it('does not record failed revisions',()=>{const {ledger}=setup();expect(()=>ledger.revise({eventId:'v1',evidenceId:'missing',state:'withdrawn',at:'2026-11-03T01:00:00Z',actorId:'reviewer',reason:'Correction'})).toThrow();expect(ledger.history()).toHaveLength(0)});
 it('rejects duplicate event IDs',()=>{const {ledger}=setup();const e={eventId:'v1',evidenceId:'e',state:'disputed' as const,at:'2026-11-03T01:00:00Z',actorId:'reviewer',reason:'Disputed'};ledger.revise(e);expect(()=>ledger.revise(e)).toThrow('Duplicate event')});
});
