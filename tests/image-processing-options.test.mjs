import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const { outputText } = ts.transpileModule(fs.readFileSync(new URL('../lib/image-processing-options.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { validateImageOptions, DEFAULT_IMAGE_OPTIONS } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
test('default options preserve original background and neutral lighting', () => assert.deepEqual(validateImageOptions({}), DEFAULT_IMAGE_OPTIONS));
test('bounded numeric options and strict boolean types', () => {
  for (const options of [{ brightness: NaN }, { brightness: '1' }, { contrast: .79 }, { sharpness: 2 }, { scale: 0 }, { position_y: 2 }, { shadow: 'true' }, { remove_background: 1 }, { background_color: '#fff' }, { background: 'image' }]) assert.throws(() => validateImageOptions(options));
});
test('removal and shadows require isolated composition mode', () => {
  assert.throws(() => validateImageOptions({ remove_background: true }));
  assert.throws(() => validateImageOptions({ shadow: true }));
  assert.equal(validateImageOptions({ background: 'solid', remove_background: true, shadow: true }).remove_background, true);
});
