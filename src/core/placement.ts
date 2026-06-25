import {
  GRID_SIZE,
  GRID_COLS,
  GRID_ROWS,
  type TitleElement,
  type PatternDef,
  type PatternElement,
  type SquareElement,
  type DotElement,
  type LetterElement,
  type GenerationMode,
  DEFAULT_ELEMENT_MOTION,
} from '../types';
import { GridOccupancy, shuffle } from './grid';
import { generatePalette, generateSquareColor, generateDotColor, generateLetterColor } from './colors';

let placeId = 0;
const nextId = () => `p_${++placeId}`;

const CLIP_SIDES = [
  'top', 'bottom', 'left', 'right',
] as const;

function buildProximityMap(titles: TitleElement[]): number[][] {
  const dist: number[][] = Array.from({ length: GRID_ROWS }, () =>
    new Array(GRID_COLS).fill(Infinity),
  );
  const queue: Array<[number, number]> = [];

  for (const t of titles) {
    const c0 = Math.floor(t.x / GRID_SIZE);
    const r0 = Math.floor(t.y / GRID_SIZE);
    const c1 = Math.ceil((t.x + t.w) / GRID_SIZE);
    const r1 = Math.ceil((t.y + t.h) / GRID_SIZE);
    for (let r = Math.max(0, r0); r < Math.min(GRID_ROWS, r1); r++) {
      for (let c = Math.max(0, c0); c < Math.min(GRID_COLS, c1); c++) {
        dist[r][c] = 0;
        queue.push([c, r]);
      }
    }
  }

  let head = 0;
  while (head < queue.length) {
    const [cx, cy] = queue[head++];
    const d = dist[cy][cx];
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_COLS || ny >= GRID_ROWS) continue;
      if (dist[ny][nx] <= d + 1) continue;
      dist[ny][nx] = d + 1;
      queue.push([nx, ny]);
    }
  }
  return dist;
}

function candidatesInRadius(
  grid: GridOccupancy,
  spanCols: number,
  spanRows: number,
  distMap: number[][],
  maxDist: number,
  align = 1,
): Array<[number, number]> {
  const blocks = grid.findFreeBlocks(spanCols, spanRows, align);
  return blocks.filter(([c, r]) => {
    for (let dr = 0; dr < spanRows; dr++)
      for (let dc = 0; dc < spanCols; dc++)
        if ((distMap[r + dr]?.[c + dc] ?? Infinity) > maxDist) return false;
    return true;
  });
}

function placeBlocks(
  grid: GridOccupancy,
  candidates: Array<[number, number]>,
  spanCols: number,
  spanRows: number,
  target: number,
  rand: () => number,
): Array<[number, number]> {
  const shuffled = shuffle(candidates, rand);
  const placed: Array<[number, number]> = [];
  for (const [c, r] of shuffled) {
    if (placed.length >= target) break;
    if (!grid.isBlockFree(c, r, spanCols, spanRows)) continue;
    grid.markBlock(c, r, spanCols, spanRows);
    placed.push([c, r]);
  }
  return placed;
}

function placeCells(
  grid: GridOccupancy,
  candidates: Array<[number, number]>,
  target: number,
  rand: () => number,
): Array<[number, number]> {
  const shuffled = shuffle(candidates, rand);
  const placed: Array<[number, number]> = [];
  for (const [c, r] of shuffled) {
    if (placed.length >= target) break;
    if (!grid.isCellFree(c, r)) continue;
    grid.markBlock(c, r, 1, 1);
    placed.push([c, r]);
  }
  return placed;
}

/**
 * Round-robin through shuffled definitions to maximise variety.
 */
function pickVaried(defs: PatternDef[], count: number, rand: () => number): PatternDef[] {
  const shuffled = shuffle([...defs], rand);
  const result: PatternDef[] = [];
  for (let i = 0; i < count; i++) {
    result.push(shuffled[i % shuffled.length]);
  }
  return result;
}

function titleLetterPool(titles: TitleElement[]): string[] {
  const text = titles
    .map((title) => (
      title.text?.trim() ||
      title.textNodes?.map((node) => node.text).join(' ').trim() ||
      ''
    ))
    .join(' ');

  return Array.from(text.toUpperCase()).filter((char) => /\S/.test(char));
}

export function generatePlacement(
  titles: TitleElement[],
  enabledDefs: PatternDef[],
  enabledColors: string[],
  density: number,
  proximity: number,
  rand: () => number = Math.random,
  generationMode: GenerationMode = 'marks',
): { patterns: PatternElement[]; squares: SquareElement[]; dots: DotElement[]; letters: LetterElement[] } {
  const grid = new GridOccupancy();
  placeId = 0;

  if (titles.length === 0) return { patterns: [], squares: [], dots: [], letters: [] };

  for (const t of titles) {
    grid.markRect(t.x, t.y, t.w, t.h);
  }

  const distMap = buildProximityMap(titles);

  const df = density / 10;
  const maxRadius = 2 + Math.floor(proximity * 2.5);
  const dotRadius = maxRadius + 3;

  const patterns: PatternElement[] = [];
  const squares: SquareElement[] = [];
  const dots: DotElement[] = [];
  const letters: LetterElement[] = [];

  const colorPairs = generatePalette(enabledColors);

  const d2 = df * df;
  const targetPat  = Math.max(2, Math.round(3 + 40 * d2));
  const target80   = Math.round(d2);
  const target40   = Math.max(0, Math.round(1 + 2 * d2));
  const target20   = Math.max(0, Math.round(1 + 3 * d2));
  const targetDots = Math.max(2, Math.round(5 + 50 * d2));
  const targetLetters = Math.max(2, Math.round(6 + 56 * d2));

  const pickClipSide = () => CLIP_SIDES[Math.floor(rand() * 4)];

  if (enabledDefs.length > 0 && colorPairs.length > 0) {
    const cands = candidatesInRadius(grid, 2, 2, distMap, maxRadius, 2);
    const slots = placeBlocks(grid, cands, 2, 2, targetPat, rand);
    const defs = pickVaried(enabledDefs, slots.length, rand);
    for (let i = 0; i < slots.length; i++) {
      const [c, r] = slots[i];
      const colors = colorPairs[Math.floor(rand() * colorPairs.length)];
      patterns.push({
        id: nextId(), patternId: defs[i].id,
        x: c * GRID_SIZE, y: r * GRID_SIZE,
        colors, animDelay: rand(),
        clipSide: pickClipSide(),
        motionStyle: DEFAULT_ELEMENT_MOTION,
      });
    }
  }

  if (generationMode === 'marks' && enabledColors.length > 0 && target80 > 0) {
    const cands = candidatesInRadius(grid, 4, 4, distMap, maxRadius, 4);
    for (const [c, r] of placeBlocks(grid, cands, 4, 4, target80, rand)) {
      squares.push({
        id: nextId(), x: c * GRID_SIZE, y: r * GRID_SIZE, size: 80,
        color: generateSquareColor(enabledColors, rand),
        clipSide: pickClipSide(),
        motionStyle: DEFAULT_ELEMENT_MOTION,
        animDelay: rand(),
      });
    }
  }

  if (generationMode === 'marks' && enabledColors.length > 0 && target40 > 0) {
    const cands = candidatesInRadius(grid, 2, 2, distMap, maxRadius, 2);
    for (const [c, r] of placeBlocks(grid, cands, 2, 2, target40, rand)) {
      squares.push({
        id: nextId(), x: c * GRID_SIZE, y: r * GRID_SIZE, size: 40,
        color: generateSquareColor(enabledColors, rand),
        clipSide: pickClipSide(),
        motionStyle: DEFAULT_ELEMENT_MOTION,
        animDelay: rand(),
      });
    }
  }

  if (generationMode === 'marks' && enabledColors.length > 0 && target20 > 0) {
    const cands = grid.findFreeCells().filter(([c, r]) => distMap[r][c] <= maxRadius);
    for (const [c, r] of placeCells(grid, cands, target20, rand)) {
      squares.push({
        id: nextId(), x: c * GRID_SIZE, y: r * GRID_SIZE, size: 20,
        color: generateSquareColor(enabledColors, rand),
        clipSide: pickClipSide(),
        motionStyle: DEFAULT_ELEMENT_MOTION,
        animDelay: rand(),
      });
    }
  }

  {
    const cands = grid.findFreeCells().filter(([c, r]) => distMap[r][c] <= dotRadius);
    for (const [c, r] of placeCells(grid, cands, targetDots, rand)) {
      dots.push({
        id: nextId(),
        x: c * GRID_SIZE + 6, y: r * GRID_SIZE + 6,
        color: generateDotColor(enabledColors, rand),
        clipSide: pickClipSide(),
        motionStyle: DEFAULT_ELEMENT_MOTION,
        animDelay: rand(),
        blinkPhase: rand(),
        blinkSpeed: 0.15 + rand() * 0.25,
      });
    }
  }

  if (generationMode === 'letters') {
    const letterPool = titleLetterPool(titles);
    const cands = grid.findFreeCells().filter(([c, r]) => distMap[r][c] <= dotRadius);
    for (const [c, r] of placeCells(grid, cands, targetLetters, rand)) {
      if (letterPool.length === 0) break;
      const char = letterPool[Math.floor(rand() * letterPool.length)];
      letters.push({
        id: nextId(),
        char,
        x: c * GRID_SIZE,
        y: r * GRID_SIZE,
        size: GRID_SIZE,
        color: generateLetterColor(enabledColors, rand),
        clipSide: pickClipSide(),
        motionStyle: DEFAULT_ELEMENT_MOTION,
        animDelay: rand(),
      });
    }
  }

  return { patterns, squares, dots, letters };
}
