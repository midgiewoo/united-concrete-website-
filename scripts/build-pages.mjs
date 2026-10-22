import { rm, mkdir, copyFile, readdir, readFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
const pages = (await readdir(root)).filter(f => f.endsWith('.html'));
if (pages.length < 7 || !pages.includes('index.html') || !pages.includes('contact.html')) {
  throw new Error('Expected reviewed site pages missing');
}
for (const name of pages) await copyFile(path.join(root, name), path.join(dist, name));
for (const name of ['css', 'js']) await cp(path.join(root, name), path.join(dist, name), { recursive: true });
for (const name of ['_redirects', 'sitemap.xml', 'robots.txt']) {
  await copyFile(path.join(root, name), path.join(dist, name));
}
// Ship only assets actually referenced in HTML/CSS/JS, not original client photo archives.
const scanned = [];
for (const name of pages) scanned.push(await readFile(path.join(root, name), 'utf8'));
for (const folder of ['css', 'js']) {
  for (const name of await readdir(path.join(root, folder))) {
    if (/\.(css|js)$/.test(name)) scanned.push(await readFile(path.join(root, folder, name), 'utf8'));
  }
}
const assets = new Set();
for (const text of scanned) {
  for (const m of text.matchAll(/images\/[A-Za-z0-9._/-]+/g)) assets.add(m[0]);
}
for (const relative of [...assets].sort()) {
  if (relative.includes('..') || relative.includes('\\')) throw new Error('unsafe_asset_path');
  const source = path.join(root, relative);
  const target = path.join(dist, relative);
  await mkdir(path.dirname(target), { recursive: true });
  try { await copyFile(source, target); }
  catch { throw new Error('Missing referenced asset: ' + relative); }
}
console.log('Pages dist built:', pages.length, 'pages;', assets.size, 'referenced images. No original archive copied.');
