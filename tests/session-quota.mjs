import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {test} from 'node:test'
const code = readFileSync(new URL('../src/client.js', import.meta.url), 'utf8')
const start = code.indexOf('    const normalizeSessionLimit =')
const end = code.indexOf('    function SessionLimitField(', start)
assert.ok(start >= 0 && end > start)
const {normalizeSessionLimit: normalize, limitSessionsForRender: limit} =
  new Function(code.slice(start, end)+'\nreturn {normalizeSessionLimit, limitSessionsForRender}')()
const row = (id, value = {}) => ({id, ...value})
const ids = result => result.rows.map(item => item.id)
const list = Array.from({length: 70}, (_, i) => row('s'+i))
test('protected rows fill the quota, not add to it; ordering and input are unchanged', () => {
  const input = [row('empty',{blank:true}), row('a'), row('p',{pinned:true}),row('b'),row('r',{running:true}),row('hidden')]
  const actual = limit(input, 4, false, undefined, 0, true)
  assert.deepEqual(ids(actual), ['empty','a','p','b','r'])
  assert.equal(actual.hidden,1)
  assert.equal(input.length,6)
})
test('attention beyond position 50 is retained without expanding unrelated history', () => {
  const input = [
    ...list,
    row('run',{running:true}),row('child',{subagents:1}),row('pending',{pending:'approval'}),
    row('unread',{completed:true}),row('selected'),row('also-pinned',{pinned:true,pending:'question'}),
  ]
  for (const quota of [1,5,6]) {
    const actual = limit(input, quota, false, 'selected', 0, true)
    assert.deepEqual(ids(actual), ['run','child','pending','unread','selected','also-pinned'])
    assert.equal(actual.hidden,70)
  }
  assert.deepEqual(ids(limit(input, 7, false, 'selected', 0, true)), ['s0','run','child','pending','unread','selected','also-pinned'])
})
test('0, manual lift, and short/empty groups are handled', () => {
  assert.strictEqual(limit(list,0,false).rows,list)
  assert.strictEqual(limit(list,1,true).rows,list)
  assert.equal(limit(list,500,false).hidden,0)
  assert.deepEqual(limit([],5,false),{rows:[],hidden:0})
})
test('custom persisted numbers use the upstream normalization and default All', () => {
  for (const input of [undefined,null,NaN,Infinity,-1]) assert.equal(normalize(input),0)
  for (const input of [0,1,7,499,500,'0','19']) assert.equal(normalize(input),Number(input))
  assert.equal(normalize(501),500)
})
test('legacy is the missing and disabled preference: add N idle rows, using the original attention window and order', () => {
  const input = [...list, row('pin',{pinned:true}),row('run',{running:true}),row('selected'),row('latePending',{pending:true})]
  const expected = ['pin','run','s0','s1','s2']
  assert.deepEqual(ids(limit(input,3,false,'selected')),expected)
  assert.deepEqual(ids(limit(input,3,false,'selected',false)),expected)
  assert.deepEqual(ids(limit(input,3,false,'selected',0,true)),['pin','run','selected','latePending'])
})
test('both modes respect manual lift or unlimited and retain original row references', () => {
  const input = [...list,row('blank',{blank:true}),row('pin',{pinned:true})]
  for (const mode of [false,true]) {
    assert.equal(limit(input,0,false,undefined,0,mode).rows,input)
    assert.equal(limit(input,5,true,undefined,0,mode).rows,input)
  }
})
