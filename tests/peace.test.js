import test from 'node:test';
import assert from 'node:assert/strict';
import {PeaceGate} from '../public/host-peace-gate.js';
import {liveSessionConfig} from '../lib/host-config.js';
test('peace sign must persist, fires once, and resets for next guest',()=>{const g=new PeaceGate();assert.equal(g.observe(true,0),false);assert.equal(g.observe(false,300),false);assert.equal(g.observe(true,600),false);assert.equal(g.observe(true,900),false);assert.equal(g.observe(true,1200),false);assert.equal(g.observe(true,1500),true);assert.equal(g.observe(true,1800),false);g.reset();assert.equal(g.observe(true,2000),false);assert.equal(g.observe(true,5001),false);});
test('voice readiness accepts natural affirmative responses only in readiness context',()=>{const c=liveSessionConfig();assert.match(c.instructions,/yes, yep, okay/);assert.match(c.instructions,/unrelated question is not readiness/);assert.match(c.delegation.responses.instructions,/do not insist on the word ready/);});
