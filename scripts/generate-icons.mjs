import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = join(ROOT, 'public/assets/galanda');
const OUTPUT = join(ROOT, 'src/components/galanda/icons');
const GENERATED_HEADER = "// Generated from Galanda SVG sources. Do not edit directly.\n";
const GROUPS = ['navigation', 'planning', 'actions', 'decision', 'interface', 'status', 'travel', 'collaboration', 'preferences'];
const ATTRIBUTES = new Set(['xmlns', 'width', 'height', 'viewBox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'clip-rule', 'd', 'x', 'y', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'x2', 'y1', 'y2', 'points']);
const camel = (key) => key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

function attributes(text, file) {
  const result = {};
  const rest = text.replace(/([\w:-]+)="([^"]*)"/g, (_, key, value) => {
    if (!ATTRIBUTES.has(key) || Object.hasOwn(result, camel(key))) throw new Error(`${file}: unsupported/duplicate attribute ${key}`);
    if (/[<>&]/.test(value) || /url\(|javascript:/i.test(value)) throw new Error(`${file}: unsupported value`);
    if (['fill', 'stroke'].includes(key) && !['none', 'currentColor'].includes(value)) throw new Error(`${file}: use currentColor`);
    if (key === 'stroke-width' && value !== '2') throw new Error(`${file}: stroke must be 2`);
    if (['stroke-linecap', 'stroke-linejoin'].includes(key) && value !== 'round') throw new Error(`${file}: use round strokes`);
    result[camel(key)] = value;
    return '';
  });
  if (rest.trim()) throw new Error(`${file}: malformed attributes`);
  return result;
}

// Deliberately supports only the repository's flat, static geometry, not arbitrary SVG.
export function parseSvg(source, file = 'SVG') {
  const match = source.trim().match(/^<svg\s([^>]*)>([\s\S]*)<\/svg>$/);
  if (!match) throw new Error(`${file}: expected one SVG root`);
  const attrs = attributes(match[1], file);
  if (attrs.xmlns !== 'http://www.w3.org/2000/svg' || attrs.viewBox !== '0 0 24 24' || attrs.width !== '24' || attrs.height !== '24') throw new Error(`${file}: expected a 24x24 SVG`);
  const nodes = [];
  const rest = match[2].replace(/<(path|rect|circle|ellipse|line|polyline|polygon)\b([^>]*)\/>/g, (_, tag, text) => {
    nodes.push({ tag, attrs: attributes(text, file) });
    return '';
  });
  if (rest.trim() || !nodes.length) throw new Error(`${file}: only flat self-closing geometry is supported`);
  return { attrs, nodes };
}

export function generateIcons(check = false) {
  const labels = JSON.parse(readFileSync(join(OUTPUT, 'labels.json'), 'utf8'));
  const definitions = {};
  const catalogue = {};
  for (const group of GROUPS) {
    for (const file of readdirSync(join(ASSETS, group)).sort()) {
      if (!file.endsWith('.svg')) continue;
      const match = file.match(/^([a-z][a-z0-9-]*)-(outline|filled)\.svg$/);
      if (!match) throw new Error(`Invalid icon filename: ${file}`);
      const [, name, variant] = match;
      if (catalogue[name] && catalogue[name].category !== group) throw new Error(`Duplicate icon name: ${name}`);
      if (!labels[name]?.trim()) throw new Error(`Missing Korean label: ${name}`);
      definitions[name] ??= {};
      catalogue[name] ??= { label: labels[name], category: group, variants: {} };
      definitions[name][variant] = parseSvg(readFileSync(join(ASSETS, group, file), 'utf8'), file);
      catalogue[name].variants[variant] = `/assets/galanda/${group}/${file}`;
    }
  }
  for (const name of Object.keys(definitions)) if (!definitions[name].outline) throw new Error(`Missing outline: ${name}`);
  for (const name of Object.keys(labels)) if (!definitions[name]) throw new Error(`Orphan label: ${name}`);
  const sorted = (object) => Object.fromEntries(Object.entries(object).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  const rootAttrs = parseSvg('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h18"/></svg>').attrs;
  const nodeHeader = [
    GENERATED_HEADER.trimEnd(),
    'type Node = { readonly tag: string; readonly attrs: Readonly<Record<string, string>> };',
    'const ROOT = ' + JSON.stringify(rootAttrs) + ';',
    'const outline = (nodes: readonly Node[]) => ({ attrs: ROOT, nodes });',
    'const filled = (nodes: readonly Node[]) => ({ attrs: { ...ROOT, fill: "currentColor" }, nodes });',
    '',
    '',
  ].join('\n');
  const serialize = (definition) => {
    if (JSON.stringify(definition.attrs) === JSON.stringify(rootAttrs)) return `outline(${JSON.stringify(definition.nodes)})`;
    if (JSON.stringify(definition.attrs) === JSON.stringify({ ...rootAttrs, fill: 'currentColor' })) return `filled(${JSON.stringify(definition.nodes)})`;
    return JSON.stringify(definition);
  };
  const indent = String.fromCharCode(32, 32);
  const nodeLines = Object.entries(sorted(definitions)).map(([name, variants]) => {
    const entries = Object.entries(variants).map(([variant, definition]) =>
      JSON.stringify(variant) + ': ' + serialize(definition),
    );
    return indent + JSON.stringify(name) + ': {' + entries.join(', ') + '},';
  });
  const catalogueLines = Object.entries(sorted(catalogue)).map(([name, value]) =>
    indent + JSON.stringify(name) + ': ' + JSON.stringify(value) + ',',
  );
  const nodesText = nodeHeader + ['export const ICON_NODES = {', ...nodeLines, '} as const;', ''].join('\n');
  const catalogueText = GENERATED_HEADER + ['export const ICON_CATALOG = {', ...catalogueLines, '} as const;', ''].join('\n');
  for (const [file, text] of [['icon-nodes.ts', nodesText], ['catalog.ts', catalogueText]]) {
    const path = join(OUTPUT, file);
    if (check) {
      const actual = readFileSync(path, 'utf8');
      if (actual !== text) {
        let offset = 0;
        while (offset < actual.length && offset < text.length && actual[offset] === text[offset]) offset += 1;
        const line = text.slice(0, offset).split('\n').length;
        const contextStart = Math.max(0, offset - 40);
        throw new Error(`${file} is stale at line ${line}, offset ${offset}. Run node scripts/generate-icons.mjs\nExpected: ${JSON.stringify(text.slice(contextStart, offset + 100))}\nActual: ${JSON.stringify(actual.slice(contextStart, offset + 100))}`);
      }
    } else {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text);
    }
  }
  console.log(`${check ? 'Verified' : 'Generated'} ${Object.keys(definitions).length} icons / ${Object.values(definitions).reduce((count, variants) => count + Object.keys(variants).length, 0)} SVG variants`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Usage: node scripts/generate-icons.mjs [--check]');
    generateIcons(process.argv.includes('--check'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
