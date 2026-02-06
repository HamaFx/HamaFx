// Squarified Treemap Algorithm

export interface TreemapItem {
  id: string;
  label: string;
  value: number;
  color: string;
  change: number;
  meta?: Record<string, unknown>;
}

export interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
  item: TreemapItem;
}

function worst(row: number[], w: number): number {
  if (row.length === 0) return Infinity;
  const s = row.reduce((a, b) => a + b, 0);
  const sSquared = s * s;
  const wSquared = w * w;
  const maxVal = Math.max(...row);
  const minVal = Math.min(...row);
  return Math.max(
    (wSquared * maxVal) / sSquared,
    sSquared / (wSquared * minVal)
  );
}

function layoutRow(
  row: number[],
  rowItems: TreemapItem[],
  rect: { x: number; y: number; w: number; h: number },
  totalArea: number,
  results: TreemapRect[]
): { x: number; y: number; w: number; h: number } {
  const rowSum = row.reduce((a, b) => a + b, 0);
  const rowRatio = rowSum / totalArea;
  const isWide = rect.w >= rect.h;

  if (isWide) {
    const rowWidth = rect.w * rowRatio;
    let y = rect.y;
    for (let i = 0; i < row.length; i++) {
      const h = (row[i] / rowSum) * rect.h;
      results.push({ x: rect.x, y, w: rowWidth, h, item: rowItems[i] });
      y += h;
    }
    return { x: rect.x + rowWidth, y: rect.y, w: rect.w - rowWidth, h: rect.h };
  } else {
    const rowHeight = rect.h * rowRatio;
    let x = rect.x;
    for (let i = 0; i < row.length; i++) {
      const w = (row[i] / rowSum) * rect.w;
      results.push({ x, y: rect.y, w, h: rowHeight, item: rowItems[i] });
      x += w;
    }
    return { x: rect.x, y: rect.y + rowHeight, w: rect.w, h: rect.h - rowHeight };
  }
}

function squarify(
  areas: number[],
  items: TreemapItem[],
  rect: { x: number; y: number; w: number; h: number },
  results: TreemapRect[]
): void {
  if (areas.length === 0) return;

  if (areas.length === 1) {
    results.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, item: items[0] });
    return;
  }

  const totalArea = rect.w * rect.h;
  const side = rect.w >= rect.h ? rect.h : rect.w;

  const row: number[] = [areas[0]];
  const rowItems: TreemapItem[] = [items[0]];
  let idx = 1;

  while (idx < areas.length) {
    const newRow = [...row, areas[idx]];
    if (worst(newRow, side) <= worst(row, side)) {
      row.push(areas[idx]);
      rowItems.push(items[idx]);
      idx++;
    } else {
      break;
    }
  }

  const newRect = layoutRow(row, rowItems, rect, totalArea, results);
  squarify(areas.slice(idx), items.slice(idx), newRect, results);
}

export function generateTreemap(
  items: TreemapItem[],
  width: number,
  height: number
): TreemapRect[] {
  if (items.length === 0 || width <= 0 || height <= 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const totalValue = sorted.reduce((sum, i) => sum + Math.max(i.value, 0.001), 0);
  const totalArea = width * height;
  const areas = sorted.map(i => (Math.max(i.value, 0.001) / totalValue) * totalArea);

  const results: TreemapRect[] = [];
  squarify(areas, sorted, { x: 0, y: 0, w: width, h: height }, results);
  return results;
}

export function getPerformanceColor(change: number): string {
  const c = Math.max(-15, Math.min(15, change));
  if (c >= 8) return '#00c853';
  if (c >= 4) return '#2e7d32';
  if (c >= 2) return '#388e3c';
  if (c >= 0.5) return '#4caf50';
  if (c > -0.5) return '#455a64';
  if (c >= -2) return '#e53935';
  if (c >= -4) return '#c62828';
  if (c >= -8) return '#b71c1c';
  return '#880e4f';
}
