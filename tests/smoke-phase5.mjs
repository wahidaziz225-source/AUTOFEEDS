// Production integration test. Only fixtures created by this run are removed.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import Database from 'better-sqlite3';
const port = Number(process.env.PHASE5_TEST_PORT || 3065), base = `http://127.0.0.1:${port}`;
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'autofeeds-phase5-'));
const dataDir = path.join(temp, 'data');
const modelSource = path.join(process.cwd(), 'storage', 'models', 'u2netp.onnx');
if (fs.existsSync(modelSource)) { fs.mkdirSync(path.join(dataDir, 'storage', 'models'), { recursive: true }); fs.copyFileSync(modelSource, path.join(dataDir, 'storage', 'models', 'u2netp.onnx')); }
const log = fs.openSync(path.join(temp, 'server.log'), 'w');
const images = [], designs = new Set();
let server, db;
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
async function start() {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', String(port)], { stdio: ['ignore', log, log], env: { ...process.env, AUTOFEEDS_DATA_DIR: dataDir } });
  for (let i = 0; i < 80; i++) {
    if (server.exitCode !== null) throw Error(fs.readFileSync(path.join(temp, 'server.log'), 'utf8'));
    try { if ((await fetch(base + '/api/promo')).ok) return; } catch { /* starting */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw Error('Server did not start');
}
async function stop() { if (server && server.exitCode === null) { const end = once(server, 'exit'); server.kill(); await end; } }
async function call(route, body, expected = 200, method = 'POST') {
  const r = await fetch(base + route, body === undefined ? undefined : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(r.status, expected, `${route}: ${await r.clone().text()}`);
  return r.json();
}
async function generate(body) { const data = await call('/api/promo', body, 201); data.designs.forEach(d => designs.add(d.id)); return data; }
function snapshot(id) { return JSON.parse(db.prepare('SELECT items_json FROM promo_designs WHERE id=?').get(id).items_json); }
try {
  const fixture = path.join(temp, 'product.png');
  const setup = spawnSync('python', ['-c', `from PIL import Image,ImageDraw
import sys
im=Image.new('RGBA',(400,500),(0,0,0,0));d=ImageDraw.Draw(im);d.rectangle((100,70,300,420),fill='#d62638');d.rectangle((105,200,295,270),fill='yellow');im.save(sys.argv[1])`, fixture]);
  assert.equal(setup.status, 0, setup.stderr.toString());
  await start();
  const form = new FormData(); form.append('file', new Blob([fs.readFileSync(fixture)], { type: 'image/png' }), 'phase5.png');
  const upload = await fetch(base + '/api/images', { method: 'POST', body: form }); assert.equal(upload.status, 201);
  const { id: imageId } = await upload.json(); images.push(imageId);
  const { variant } = await call('/api/image-processing', { image_id: imageId, options: { background: 'transparent', shadow: true } }, 201);
  const originalHash = hash(Buffer.from(await (await fetch(base + `/api/image-file?id=${imageId}`)).arrayBuffer()));
  const body = { count: 6, format: 'feed', theme: 'merah', style: 'retail', promo_type: 'harga_spesial', title: 'PROMO UJI FASE 5',
    items: [{ image_id: imageId, variant_id: variant.id, name: 'Nugget Ayam Original 500 gram', price: '24799', old_price: '30999' }] };
  db = new Database(path.join(dataDir, 'database', 'autofeeds.db'));
  db.pragma('foreign_keys=ON');
  const batch = await generate(body);
  assert.equal(batch.designs.length, 6); assert.equal(new Set(batch.designs.map(d => d.style)).size, 6);
  assert.equal((await call(`/api/promo?batch_id=${batch.batch_id}`)).designs.length, 6);
  const files = [];
  for (const d of batch.designs) {
    const r = await fetch(base + `/api/promo-file?id=${d.id}&download=1`); assert.equal(r.status, 200);
    files.push(hash(Buffer.from(await r.arrayBuffer())));
    assert.equal(snapshot(d.id).items[0].price, 'Rp24.799');
    assert.equal(snapshot(d.id).items[0].variant_id, variant.id);
  }
  assert.equal(new Set(files).size, 6, 'fixed-color batch must produce six distinct rendered images');
  const picked = batch.designs[0];
  await call('/api/promo', { id: picked.id, is_saved: true }, 200, 'PATCH');
  assert.ok((await call('/api/promo?saved=1')).designs.some(d => d.id === picked.id));
  const regenerated = await generate({ regenerate_id: picked.id, title: 'SHOULD NOT APPLY', items: [{ price: 1 }] });
  assert.equal(regenerated.designs.length, 1); assert.notEqual(regenerated.designs[0].style, picked.style);
  assert.deepEqual(snapshot(regenerated.id).items, snapshot(picked.id).items);
  assert.equal(regenerated.designs[0].title, body.title);
  const more = await generate({ source_id: picked.id, count: 4 });
  assert.equal(more.designs.length, 4); assert.notEqual(more.batch_id, batch.batch_id);
  assert.deepEqual(snapshot(more.id).items, snapshot(picked.id).items);
  await generate({ ...body, count: 5, format: 'square', promo_type: 'diskon_persen', discount_percent: 20, items: [{ ...body.items[0], price: '30999', old_price: '' }] });
  const bundle = await generate({ ...body, count: 4, format: 'landscape', promo_type: 'bundling', bundle_price: '40000', items: [body.items[0], body.items[0]] });
  assert.equal(snapshot(bundle.id).bundle.price_text, 'Rp40.000');
  const single = await generate({ ...body, count: undefined, format: 'story' }); assert.equal(single.designs.length, 1);
  for (const count of [0, 2, 3, 7, '4', 4.5]) await call('/api/promo', { ...body, count }, 400);
  await call('/api/promo', { regenerate_id: picked.id, source_id: picked.id }, 400);
  await call('/api/promo', { source_id: picked.id, count: 1 }, 400);
  await call('/api/promo', { id: picked.id, is_saved: 'true' }, 400, 'PATCH');
  const sourceFile = db.prepare('SELECT output_filename FROM promo_designs WHERE id=?').get(picked.id).output_filename;
  const legacyName = randomUUID() + '.jpg';
  fs.copyFileSync(path.join(dataDir, 'storage', 'uploads', 'promo', sourceFile), path.join(dataDir, 'storage', 'uploads', 'promo', legacyName));
  const legacy = Number(db.prepare(`INSERT INTO promo_designs(title,layout_format,theme,items_json,output_filename) VALUES('LEGACY TEST','feed','merah','{}',?)`).run(legacyName).lastInsertRowid);
  designs.add(legacy);
  await call('/api/promo', { regenerate_id: legacy }, 409);
  await call('/api/promo', { id: legacy, is_saved: true }, 200, 'PATCH');
  assert.equal((await call('/api/promo?saved=1')).designs.find(d => d.id === legacy).can_regenerate, 0);
  const concurrent = generate({ ...body, count: 6 });
  for (let i = 0; i < 100; i++) {
    if ((await call('/api/promo')).generating) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  await call('/api/promo', body, 409);
  await call(`/api/promo?id=${picked.id}`, {}, 409, 'DELETE');
  await concurrent;
  await stop(); await start();
  assert.ok((await call('/api/promo?saved=1')).designs.some(d => d.id === picked.id));
  assert.equal((await call(`/api/promo?batch_id=${batch.batch_id}`)).designs.length, 6);
  await call(`/api/image-processing?id=${variant.id}`, {}, 200, 'DELETE');
  await call('/api/promo', { regenerate_id: picked.id }, 404);
  assert.equal((await fetch(base + `/api/promo-file?id=${picked.id}`)).status, 200);
  assert.equal(hash(Buffer.from(await (await fetch(base + `/api/image-file?id=${imageId}`)).arrayBuffer())), originalHash);
  console.log('PASS: batches 4/5/6, fixed-theme distinct JPEGs, original/derived photo integrity, exact prices, bundles, four formats, saved filter, immutable regeneration, more variations, legacy compatibility, validation, 409 lock, restart persistence, missing-source error.');
} finally {
  if (server?.exitCode === null) {
    for (const id of designs) await fetch(base + `/api/promo?id=${id}`, { method: 'DELETE' }).catch(() => {});
    for (const id of images) await fetch(base + `/api/images?id=${id}`, { method: 'DELETE' }).catch(() => {});
  }
  db?.close(); await stop(); fs.closeSync(log); fs.rmSync(temp, { recursive: true, force: true });
}
