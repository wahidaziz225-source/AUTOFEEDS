// Run after npm run build. Creates temporary records and removes only its own fixtures.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const port = Number(process.env.PHASE4_TEST_PORT || 3064);
const base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'autofeeds-phase4-'));
const dataDir = path.join(temp, 'data');
const modelSource = path.join(process.cwd(), 'storage', 'models', 'u2netp.onnx');
if (fs.existsSync(modelSource)) { fs.mkdirSync(path.join(dataDir, 'storage', 'models'), { recursive: true }); fs.copyFileSync(modelSource, path.join(dataDir, 'storage', 'models', 'u2netp.onnx')); }
const log = fs.openSync(path.join(temp, 'server.log'), 'w');
let server;
let browser;
const imageIds = [], designIds = [];
async function start() {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { stdio: ['ignore', log, log], env: { ...process.env, AUTOFEEDS_DATA_DIR: dataDir } });
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw new Error(fs.readFileSync(path.join(temp, 'server.log'), 'utf8'));
    try { const r = await fetch(base + '/api/images'); if (r.ok) return; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Server did not start');
}
async function stop() {
  if (server && server.exitCode === null) { const exited = once(server, 'exit'); server.kill(); await exited; }
}
async function request(route, body, expected = 200, method = 'POST') {
  const r = await fetch(base + route, body === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(r.status, expected, `${route}: ${await r.clone().text()}`);
  return r.json();
}
async function upload(filename) {
  const form = new FormData(); form.append('file', new Blob([fs.readFileSync(path.join(temp, filename))], { type: 'image/png' }), filename);
  const r = await fetch(base + '/api/images', { method: 'POST', body: form }); assert.equal(r.status, 201);
  const data = await r.json(); imageIds.push(data.id); return data.id;
}
async function png(route) {
  const response = await fetch(base + route); assert.equal(response.status, 200);
  const data = Buffer.from(await response.arrayBuffer());
  assert.equal(data.toString('hex', 0, 8), '89504e470d0a1a0a');
  assert.equal(data.readUInt32BE(16), 400); assert.equal(data.readUInt32BE(20), 500);
  return data;
}
const hash = data => createHash('sha256').update(data).digest('hex');
try {
  const fixture = spawnSync(process.env.AUTOFEEDS_PYTHON || 'python', ['-c', `from PIL import Image, ImageDraw
from pathlib import Path
import sys
p=Path(sys.argv[1])
for name,bg in [('transparent.png',(0,0,0,0)),('opaque.png',(245,245,245,255))]:
 im=Image.new('RGBA',(400,500),bg); d=ImageDraw.Draw(im);d.rounded_rectangle((120,80,280,420),radius=20,fill=(210,38,48,255));d.rectangle((125,200,275,270),fill='yellow');im.save(p/name)
`, temp]);
  assert.equal(fixture.status, 0, fixture.stderr?.toString());
  await start();
  for (const route of ['/dashboard', '/upload', '/image-studio', '/analyzer', '/content-studio', '/promo', '/library', '/history', '/settings']) assert.equal((await fetch(base + route)).status, 200);
  const imageId = await upload('transparent.png'), otherId = await upload('opaque.png');
  const original = await png(`/api/image-file?id=${imageId}`);
  const { variant } = await request('/api/image-processing', { image_id: imageId, options: { background: 'transparent', shadow: true, scale: .7, brightness: 1.05 } }, 201);
  await png(`/api/image-file?id=${imageId}&variant_id=${variant.id}&download=1`);
  assert.equal((await fetch(base + `/api/image-file?id=${otherId}&variant_id=${variant.id}`)).status, 404);
  await request('/api/image-processing', { image_id: imageId, options: { brightness: 99 } }, 400);
  await request('/api/image-processing', { image_id: otherId, options: { background: 'transparent' } }, 400);
  const caps = await request('/api/image-processing?capabilities=1');
  if (caps.capabilities.ready) {
    const ai = await request('/api/image-processing', { image_id: otherId, options: { background: 'solid', background_color: '#eef2ff', remove_background: true, shadow: true } }, 201);
    assert.equal(ai.variant.engine, 'U2NETP / ONNX Runtime CPU');
    await png(`/api/image-file?id=${otherId}&variant_id=${ai.variant.id}`);
    console.log('Real CPU background removal: OK');
  } else console.log('AI unavailable: tested separately by Python missing-model tests');
  const promo = { format: 'feed', style: 'spotlight', theme: 'merah', promo_type: 'harga_spesial', title: 'SMOKE TEST', items: [{ image_id: imageId, variant_id: variant.id, name: 'Produk Uji', price: '24799', old_price: '30999' }] };
  const design = await request('/api/promo', promo, 201); designIds.push(design.id);
  const jpg = await fetch(base + `/api/promo-file?id=${design.id}&download=1`); assert.equal(jpg.status, 200); assert.equal(jpg.headers.get('content-type'), 'image/jpeg');
  await request('/api/promo', { ...promo, items: [{ ...promo.items[0], image_id: otherId }] }, 404);
  assert.equal(hash(await png(`/api/image-file?id=${imageId}`)), hash(original));
  await stop(); await start();
  const restored = await request(`/api/image-processing?image_id=${imageId}`); assert.ok(restored.variants.some(v => v.id === variant.id));
  await png(`/api/image-file?id=${imageId}&variant_id=${variant.id}`);
  console.log('Upload, processing, variant ownership, validation, original integrity, poster generation, restart persistence: OK');
  if (process.env.PHASE4_UI === '1') {
    const { chromium } = require('playwright');
    browser = await chromium.launch({ executablePath: process.env.PHASE4_CHROMIUM || chromium.executablePath(), headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + `/image-studio?image_id=${imageId}`);
    await page.getByRole('heading', { name: 'Product Image Studio' }).waitFor();
    await page.getByText(`Hasil tersimpan · #${variant.id}`, { exact: true }).waitFor();
    await page.getByLabel('Background', { exact: true }).selectOption('solid');
    await page.getByRole('button', { name: 'Buat hasil foto', exact: true }).click();
    await page.getByRole('status').filter({ hasText: 'Hasil foto tersimpan' }).waitFor({ timeout: 30_000 });
    await page.screenshot({ path: '/tmp/autofeeds-phase4-desktop.png', fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: '/tmp/autofeeds-phase4-mobile.png', fullPage: true });
    await page.goto(base + '/promo');
    await page.getByRole('button', { name: 'transparent.png' }).click();
    await page.getByLabel('Foto untuk poster').selectOption(String(variant.id));
    await page.getByLabel(/Harga promo/).fill('24799');
    await page.getByRole('button', { name: 'Buat visual promo', exact: true }).click();
    const result = page.getByRole('img', { name: 'Hasil desain promo' }); await result.waitFor({ timeout: 30_000 });
    const url = new URL(await result.getAttribute('src'), base); designIds.push(Number(url.searchParams.get('id')));
    assert.deepEqual(errors, []);
    console.log('Browser desktop/mobile: no overflow, save variant, select variant and generate poster: OK');
  }
  await browser?.close(); browser = undefined;
  const finalRows = (await request(`/api/image-processing?image_id=${imageId}`)).variants;
  for (const row of finalRows) {
    await request(`/api/image-processing?id=${row.id}`, {}, 200, 'DELETE');
    assert.equal((await fetch(base + `/api/image-file?id=${imageId}&variant_id=${row.id}`)).status, 404);
  }
  assert.equal(hash(await png(`/api/image-file?id=${imageId}`)), hash(original));
  console.log('Variant deletion preserves original: OK');
} finally {
  await browser?.close();
  if (server?.exitCode === null) {
    for (const id of designIds) await fetch(base + `/api/promo?id=${id}`, { method: 'DELETE' }).catch(() => {});
    for (const id of imageIds) await fetch(base + `/api/images?id=${id}`, { method: 'DELETE' }).catch(() => {});
  }
  await stop(); fs.closeSync(log);
  fs.rmSync(temp, { recursive: true, force: true });
}
