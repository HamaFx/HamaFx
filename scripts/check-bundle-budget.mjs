import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

const BUDGET_KB = Number(process.env.ENTRY_GZIP_BUDGET_KB ?? '315');
const distDir = path.resolve('dist');
const manifestPath = path.join(distDir, '.vite', 'manifest.json');

if (!fs.existsSync(distDir)) {
  console.error('dist directory not found. Run "npm run build" first.');
  process.exit(1);
}

let entryFilePath = null;

if (fs.existsSync(manifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entry = Object.values(manifest).find((chunk) => chunk && chunk.isEntry && chunk.file);
  if (entry?.file) {
    entryFilePath = path.join(distDir, entry.file);
  }
}

if (!entryFilePath) {
  const jsFiles = fs
    .readdirSync(distDir, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith('.js'))
    .map((f) => path.join(distDir, f.name));

  if (jsFiles.length > 0) {
    entryFilePath = jsFiles[0];
  }
}

if (!entryFilePath || !fs.existsSync(entryFilePath)) {
  console.error('Could not determine entry JS chunk for bundle budget check.');
  process.exit(1);
}

const content = fs.readFileSync(entryFilePath);
const gzipKb = gzipSync(content).length / 1024;
const prettySize = gzipKb.toFixed(2);
const prettyBudget = BUDGET_KB.toFixed(2);

if (gzipKb > BUDGET_KB) {
  console.error(
    `Bundle budget failed: entry chunk ${path.basename(entryFilePath)} is ${prettySize} KB gzip (budget ${prettyBudget} KB).`
  );
  process.exit(1);
}

console.log(
  `Bundle budget passed: entry chunk ${path.basename(entryFilePath)} is ${prettySize} KB gzip (budget ${prettyBudget} KB).`
);
