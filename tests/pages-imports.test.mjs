import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(project, 'docs', 'assets');
function listJavaScript(dir) {
  return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
    const target = join(dir, entry.name);
    return entry.isDirectory() ? listJavaScript(target) : entry.name.endsWith('.js') ? [target] : [];
  });
}

test('GitHub PagesのJSファイルが参照する相対モジュールはすべて存在する', () => {
  let checked = 0;
  for (const file of listJavaScript(assets)) {
    const code = readFileSync(file, 'utf8');
    const staticImports = [...code.matchAll(/\b(?:from\s*|import\s*)['"](\.{1,2}\/[^'"\n]+)['"]/g)];
    const dynamicImports = [...code.matchAll(/\bimport\s*\(\s*['"](\.{1,2}\/[^'"\n]+)['"]\s*\)/g)];
    for (const match of [...staticImports, ...dynamicImports]) {
      const imported = resolve(dirname(file), match[1]);
      checked++;
      assert.ok(existsSync(imported), `${file}: missing ${match[1]}`);
    }
  }
  assert.ok(checked >= 10, `Unexpectedly few imports inspected: ${checked}`);
});
