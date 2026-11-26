import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../',import.meta.url));
let checks = 0;
async function exists(path) { await stat(path); checks++; }
for (const name of ['index.html','raider/index.html','recycler/index.html']) {
  const path = resolve(root,name); const html = await readFile(path,'utf8');
  if (!html.startsWith('<!doctype html>')) throw new Error(`${name}: missing doctype`);
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  if (new Set(ids).size !== ids.length) throw new Error(`${name}: duplicate ID`);
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const link = match[1];
    if (/^(?:https?:|data:|#)/.test(link)) continue;
    if (link.startsWith('/')) throw new Error(`${name}: absolute local path ${link}`);
    await exists(resolve(dirname(path),link));
  }
  for (const match of html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)) {
    if (!ids.includes(match[1])) throw new Error(`${name}: missing label target ${match[1]}`);
  }
}
for (const entry of await readdir(resolve(root,'assets'))) {
  if (!entry.endsWith('.js')) continue;
  const path = resolve(root,'assets',entry);
  execFileSync(process.execPath,['--check',path]); checks++;
  const js = await readFile(path,'utf8');
  for (const match of js.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) await exists(resolve(dirname(path),match[1]));
}
const manifest = JSON.parse(await readFile(resolve(root,'assets/vendor/manifest.json'),'utf8'));
for (const [name, spec] of Object.entries(manifest)) {
  const bytes = await readFile(resolve(root,'assets/vendor',name));
  if (createHash('sha256').update(bytes).digest('hex') !== spec.sha256) throw new Error(`OCR checksum mismatch: ${name}`);
  if (bytes.byteLength > 30*1024*1024) throw new Error(`Asset is too large: ${name}`);
  checks++;
}
const routes = JSON.parse(await readFile(resolve(root,'manus-routes.json'),'utf8'));
if (routes.routes.map(route => route.path).join(',') !== '/,/raider/,/recycler/') throw new Error('Route manifest is out of sync');
console.log(`${checks} static checks passed.`);
