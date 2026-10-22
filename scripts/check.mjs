import { spawnSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
const files = [...(await readdir('src')).filter(file => file.endsWith('.js')).map(file => `src/${file}`), ...(await readdir('scripts')).filter(file => file.endsWith('.mjs')).map(file => `scripts/${file}`)];
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
for (const file of ['tests/inquiry.test.mjs', 'tests/accordion.test.mjs', 'tests/scroll-scenes.test.mjs', 'tests/ribbon-geometry.test.mjs', 'tests/sculpture-motion.test.mjs', 'tests/card-motion.test.mjs', 'tests/palette-preview.test.mjs']) {
  const tests = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (tests.status !== 0) process.exit(tests.status || 1);
}
