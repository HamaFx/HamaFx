import fs from 'fs';
import path from 'path';
import { gzipSync } from 'zlib';

const distDir = path.resolve('dist');

if (!fs.existsSync(distDir)) {
  console.error('dist directory not found. Run "npm run build" first.');
  process.exit(1);
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function toKb(bytes) {
  return Number((bytes / 1024).toFixed(2));
}

const files = walk(distDir).filter((f) => !f.endsWith('.map'));
const items = files.map((file) => {
  const content = fs.readFileSync(file);
  const raw = content.length;
  const gzip = gzipSync(content).length;
  return {
    file: path.relative(distDir, file),
    rawBytes: raw,
    gzipBytes: gzip,
    rawKb: toKb(raw),
    gzipKb: toKb(gzip),
  };
});

const totals = items.reduce(
  (acc, item) => {
    acc.rawBytes += item.rawBytes;
    acc.gzipBytes += item.gzipBytes;
    return acc;
  },
  { rawBytes: 0, gzipBytes: 0 }
);

const sorted = [...items].sort((a, b) => b.rawBytes - a.rawBytes);

console.log('Build artifact stats (dist):');
for (const item of sorted) {
  console.log(`- ${item.file}: ${item.rawKb} KB raw, ${item.gzipKb} KB gzip`);
}
console.log(
  `Total: ${toKb(totals.rawBytes)} KB raw, ${toKb(totals.gzipBytes)} KB gzip`
);

const output = {
  generatedAt: new Date().toISOString(),
  totals: {
    rawBytes: totals.rawBytes,
    gzipBytes: totals.gzipBytes,
    rawKb: toKb(totals.rawBytes),
    gzipKb: toKb(totals.gzipBytes),
  },
  files: sorted,
};

fs.writeFileSync(
  path.join(distDir, 'build-stats.json'),
  JSON.stringify(output, null, 2),
  'utf8'
);
