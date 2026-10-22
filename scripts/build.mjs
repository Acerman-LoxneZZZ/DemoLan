import { mkdir, writeFile, cp, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { site } from '../src/config.js';
import { renderDocument } from '../src/page.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = resolve(root, 'dist');
await mkdir(output, { recursive: true });
const html = renderDocument(site);
await writeFile(join(root, 'index.html'), html);
await writeFile(join(output, 'index.html'), html);
await mkdir(join(output, 'src'), { recursive: true });
await cp(join(root, 'src/scroll-details.css'), join(output, 'src/scroll-details.css'));
for (const file of ['config.js', 'main.js', 'inquiry.js', 'concepts.js', 'motion.js', 'scroll-scenes.js', 'sculpture.js', 'ribbon-geometry.js', 'card-motion.js', 'palette-preview.js', 'fonts.css', 'display-font.css', 'styles.css', 'concepts.css', 'experience.css', 'card-motion.css', 'identity.css', 'palette-tokens.css', 'viewport.css', 'palette-preview.css']) {
  await cp(join(root, 'src', file), join(output, 'src', file));
}
await mkdir(join(output, 'assets'), { recursive: true });
for (const file of await readdir(join(root, 'assets'))) {
  if (file === 'shadow-source.png') continue;
  await cp(join(root, 'assets', file), join(output, 'assets', file), { recursive: true });
}
async function size(path) {
  const info = await stat(path);
  if (info.isFile()) return info.size;
  return (await Promise.all((await readdir(path)).map(file => size(join(path, file))))).reduce((a, b) => a + b, 0);
}
console.log(`Готово: dist/ · ${Math.round(await size(output) / 1024)} КБ · статическая страница без внешних зависимостей`);
