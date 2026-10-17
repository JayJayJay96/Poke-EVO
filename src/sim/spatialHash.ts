/**
 * Uniform grid for broad-phase collision queries.
 * Items are inserted by their centre point only; callers widen the query radius
 * by the largest item radius and do the exact distance check themselves.
 * Bucket arrays are pooled so a rebuild every step does not allocate.
 */
export class SpatialHash {
  private readonly buckets = new Map<number, number[]>();
  private readonly pool: number[][] = [];
  private readonly cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  clear(): void {
    for (const bucket of this.buckets.values()) {
      bucket.length = 0;
      this.pool.push(bucket);
    }
    this.buckets.clear();
  }

  insert(index: number, x: number, y: number): void {
    const key = this.key(this.cell(x), this.cell(y));
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = this.pool.pop() ?? [];
      this.buckets.set(key, bucket);
    }
    bucket.push(index);
  }

  /** Fills `out` with every index whose cell overlaps the query square. */
  query(x: number, y: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const minCx = this.cell(x - radius);
    const maxCx = this.cell(x + radius);
    const minCy = this.cell(y - radius);
    const maxCy = this.cell(y + radius);
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const bucket = this.buckets.get(this.key(cx, cy));
        if (bucket) {
          for (const index of bucket) out.push(index);
        }
      }
    }
    return out;
  }

  private cell(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  // Unique while |cell| < 32768, i.e. ~2 million px from the origin at 64 px cells.
  private key(cx: number, cy: number): number {
    return (cx + 0x8000) * 0x10000 + (cy + 0x8000);
  }
}
