import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../lib/promo-options.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { parseAmount, computeItem, PROMO_STYLES } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const params = { discountPercent: 20, discountAmount: 5000, buyQty: 2, freeQty: 1, bundlePrice: '' };
test('nominal rupiah tidak ditafsirkan dari teks ambigu', () => {
  for (const s of ['25000', '25.000', 'Rp 25.000', '25,000']) assert.equal(parseAmount(s), 25000);
  for (const s of ['25rb', '-25000', '1e6', '0', 'NaN', '1.23', '9007199254740992']) assert.equal(parseAmount(s), null);
});
test('diskon tidak dibulatkan diam-diam ke ratusan rupiah', () => {
  assert.deepEqual(computeItem('diskon_persen', params, '30999', ''), {
    ok: true, priceText: 'Rp24.799', oldText: 'Rp30.999', tag: '-20%',
  });
});
test('harga manual tetap dan harga coret divalidasi', () => {
  assert.equal(computeItem('harga_spesial', params, '24799', '30999').priceText, 'Rp24.799');
  assert.equal(computeItem('harga_spesial', params, '25000', '20000').ok, false);
  assert.equal(computeItem('harga_spesial', params, '25rb', '').ok, false);
  assert.equal(computeItem('potongan_rp', params, '4000', '').ok, false);
});
test('enam konsep memiliki ID unik', () => assert.equal(new Set(PROMO_STYLES.map(s => s.id)).size, 6));
