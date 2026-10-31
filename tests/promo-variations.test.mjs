import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const data = source => `data:text/javascript;base64,${Buffer.from(compile(source)).toString('base64')}`;
const options = data(fs.readFileSync(new URL('../lib/promo-options.ts', import.meta.url), 'utf8'));
const source = fs.readFileSync(new URL('../lib/promo-variations.ts', import.meta.url), 'utf8').replace('"./promo-options"', JSON.stringify(options));
const { variationCount, variationStyles, nextVariationStyle, createPromoBatch } = await import(data(source));
test('only legacy single or batches of 4–6 are accepted', () => {
  assert.equal(variationCount(undefined), 1);
  for (const n of [1, 4, 5, 6]) assert.equal(variationCount(n), n);
  for (const n of [0, 2, 3, 7, 4.5, NaN, '4', null, true]) assert.throws(() => variationCount(n));
});
test('every batch has distinct concepts and preserves the preferred first concept', () => {
  for (const first of ['premium', 'flash', 'frozen', 'editorial', 'retail', 'spotlight']) {
    for (const count of [1, 4, 5, 6]) {
      const styles = variationStyles(first, count, 3);
      assert.equal(styles[0], first); assert.equal(new Set(styles).size, count);
    }
    assert.notEqual(nextVariationStyle(first), first);
  }
});
test('renderer failure removes completed outputs and never persists a partial batch', async () => {
  const removed = []; let persisted = false;
  await assert.rejects(createPromoBatch(4, async i => { if (i === 2) throw Error('Pillow failed'); return `file-${i}`; }, () => { persisted = true; }, file => removed.push(file)), /Pillow failed/);
  assert.deepEqual(removed, ['file-0', 'file-1']); assert.equal(persisted, false);
});
test('database failure removes every completed output', async () => {
  const removed = [];
  await assert.rejects(createPromoBatch(4, async i => `file-${i}`, () => { throw Error('SQLite failed'); }, file => removed.push(file)), /SQLite failed/);
  assert.deepEqual(removed, ['file-0', 'file-1', 'file-2', 'file-3']);
});
test('successful generation is sequential and keeps its output', async () => {
  let active = false; const ordered = [];
  const result = await createPromoBatch(6, async i => { assert.equal(active, false); active = true; await Promise.resolve(); ordered.push(i); active = false; return `file-${i}`; }, files => files, () => { throw Error('unexpected cleanup'); });
  assert.deepEqual(ordered, [0, 1, 2, 3, 4, 5]); assert.equal(result.length, 6);
});
