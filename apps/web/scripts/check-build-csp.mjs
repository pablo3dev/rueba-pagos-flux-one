import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const findings = [];

const cssFiles = readdirSync(join(dist, 'assets'))
  .filter((name) => name.endsWith('.css'))
  .map((name) => join('assets', name));

for (const file of ['index.html', ...cssFiles]) {
  const content = readFileSync(join(dist, file), 'utf8');
  if (/(?:https?:)?\/\/[a-z0-9.-]+/i.test(content))
    findings.push(`${file}: referencia a otro origen`);
  if (/data:/i.test(content)) findings.push(`${file}: URI data:`);
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
if (/<style[\s>]/i.test(html)) findings.push('index.html: <style> en línea');
for (const [, attributes, body] of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!/\ssrc=/.test(attributes) || body.trim() !== '')
    findings.push('index.html: <script> en línea');
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log('build compatible con default-src self');
}
