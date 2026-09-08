/**
 * Squarified treemap layout (Bruls, Huizing & van Wijk, 1999) — used by the
 * Global Risk heatmap to size each engine's tile by area proportionally to
 * its score, not just color. Pure geometry, no rendering: callers map the
 * returned {x,y,w,h} rectangles (in the same units as the input width/height)
 * onto CSS percentages so the layout is computed once, server-side.
 *
 * "Squarified" specifically means each row of the treemap is built greedily
 * to keep tile aspect ratios as close to square as possible (rather than the
 * naive "slice in value order" treemap, which produces unreadable slivers
 * for widely-varying values) — the standard algorithm, not a custom variant.
 */

export type TreemapNode = { key: string; value: number };
export type TreemapLayout = TreemapNode & { x: number; y: number; w: number; h: number };

function worstRatio(rowAreas: number[], length: number): number {
  const sum = rowAreas.reduce((a, b) => a + b, 0);
  const max = Math.max(...rowAreas);
  const min = Math.min(...rowAreas);
  return Math.max((length * length * max) / (sum * sum), (sum * sum) / (length * length * min));
}

export function squarifyTreemap(nodes: TreemapNode[], width: number, height: number): TreemapLayout[] {
  const items = nodes.filter((n) => n.value > 0);
  const total = items.reduce((s, n) => s + n.value, 0);
  if (total <= 0 || items.length === 0 || width <= 0 || height <= 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const scale = (width * height) / total;
  let remaining = sorted.map((node) => ({ node, area: node.value * scale }));

  const result: TreemapLayout[] = [];
  let rx = 0;
  let ry = 0;
  let rw = width;
  let rh = height;

  while (remaining.length > 0) {
    const length = Math.min(rw, rh);
    const row: typeof remaining = [];
    const rowAreas: number[] = [];
    let idx = 0;
    while (idx < remaining.length) {
      const nextAreas = [...rowAreas, remaining[idx].area];
      if (row.length === 0 || worstRatio(rowAreas, length) >= worstRatio(nextAreas, length)) {
        row.push(remaining[idx]);
        rowAreas.push(remaining[idx].area);
        idx++;
      } else {
        break;
      }
    }

    const rowSum = rowAreas.reduce((a, b) => a + b, 0);
    if (rw >= rh) {
      // Remaining rect is wider than tall — its shorter side is the height,
      // so this row becomes a column spanning the full remaining height.
      const colWidth = rh > 0 ? rowSum / rh : 0;
      let cy = ry;
      for (const entry of row) {
        const cellHeight = colWidth > 0 ? entry.area / colWidth : 0;
        result.push({ ...entry.node, x: rx, y: cy, w: colWidth, h: cellHeight });
        cy += cellHeight;
      }
      rx += colWidth;
      rw -= colWidth;
    } else {
      // Remaining rect is taller than wide — shorter side is the width, so
      // this row spans the full remaining width instead.
      const rowHeight = rw > 0 ? rowSum / rw : 0;
      let cx = rx;
      for (const entry of row) {
        const cellWidth = rowHeight > 0 ? entry.area / rowHeight : 0;
        result.push({ ...entry.node, x: cx, y: ry, w: cellWidth, h: rowHeight });
        cx += cellWidth;
      }
      ry += rowHeight;
      rh -= rowHeight;
    }
    remaining = remaining.slice(row.length);
  }

  return result;
}
