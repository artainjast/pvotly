/**
 * Post-build: wrap dist/pvotly.global.js (IIFE) in a true UMD shell.
 * Emits dist/pvotly.umd.js with AMD, CommonJS, and global Pvotly support.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const globalPath = join(dist, 'pvotly.global.js');
const umdPath = join(dist, 'pvotly.umd.js');

let src = readFileSync(globalPath, 'utf8');
src = src.replace(/\n?\/\/# sourceMappingURL=.*$/gm, '').trimEnd();

const prefix = 'var Pvotly=';
if (!src.startsWith(prefix)) {
  throw new Error(`Expected ${globalPath} to start with "${prefix}"`);
}

const iife = src.slice(prefix.length).replace(/;$/, '');

const umd = `(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.Pvotly = factory());
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  return ${iife};
});
//# sourceMappingURL=pvotly.global.js.map
`;

writeFileSync(umdPath, umd);
console.log(`Wrote ${umdPath}`);
