import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import {
  CANVAS_W,
  CANVAS_H,
  EXPORT_SCALE,
  FPS,
  type TitleElement,
  type PatternElement,
  type SquareElement,
  type DotElement,
  type LetterElement,
  type ExportLayer,
  type PatternDef,
} from '../types';
import { evaluate, evaluateDotsLoop, DOT_LOOP_MS } from '../engine/timeline';
import type { EasingName } from '../engine/easing';
import { renderFrame } from './renderer';

interface ExportOptions {
  sceneName: string;
  durationMs: number;
  easing: EasingName;
  stagger: number;
  titles: TitleElement[];
  patterns: PatternElement[];
  squares: SquareElement[];
  dots: DotElement[];
  letters: LetterElement[];
  patternDefs: Map<string, PatternDef>;
  onProgress: (done: number, total: number) => void;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      'image/png',
    );
  });
}

function layerDurationMs(layer: ExportLayer, durationMs: number): number {
  switch (layer) {
    case 'titles': return durationMs;
    case 'patterns': return durationMs;
    case 'dots': return DOT_LOOP_MS;
  }
}

function layerFrameToElapsed(layer: ExportLayer, frameRatio: number, durationMs: number): number {
  switch (layer) {
    case 'titles': return frameRatio * durationMs;
    case 'patterns': return durationMs + frameRatio * durationMs;
    case 'dots': return frameRatio * DOT_LOOP_MS;
  }
}

export async function exportLayer(
  layer: ExportLayer,
  options: ExportOptions,
): Promise<JSZip> {
  const { sceneName, durationMs, easing, stagger, titles, patterns, squares, dots, letters, patternDefs, onProgress } = options;
  const prefix = sceneName ? `${sceneName}_` : '';

  const layerDur = layerDurationMs(layer, durationMs);
  const totalFrames = Math.max(1, Math.ceil((layerDur / 1000) * FPS));
  const w = CANVAS_W * EXPORT_SCALE;
  const h = CANVAS_H * EXPORT_SCALE;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const zip = new JSZip();

  for (let frame = 0; frame < totalFrames; frame++) {
    const ratio = totalFrames > 1 ? frame / (totalFrames - 1) : 1;

    if (layer === 'dots') {
      const loopMs = ratio * DOT_LOOP_MS;
      const dotOpacities = evaluateDotsLoop(loopMs, dots);
      const state = {
        t: 0,
        titleClips: new Map(),
        titleProgress: new Map(),
        patternProgress: new Map(),
        squareClips: new Map(),
        squareProgress: new Map(),
        letterProgress: new Map(),
        dotOpacities,
      };
      await renderFrame(ctx, state, titles, patterns, squares, letters, dots, patternDefs, EXPORT_SCALE, layer);
    } else {
      const elapsedMs = layerFrameToElapsed(layer, ratio, durationMs);
      const state = evaluate(elapsedMs, durationMs, titles, patterns, squares, letters, dots, easing, stagger);
      await renderFrame(ctx, state, titles, patterns, squares, letters, dots, patternDefs, EXPORT_SCALE, layer);
    }

    const blob = await canvasToBlob(canvas);
    const padded = String(frame).padStart(5, '0');
    zip.file(`${prefix}${layer}_${padded}.png`, blob);

    onProgress(frame + 1, totalFrames);

    if (frame % 4 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  return zip;
}

export async function exportAll(options: ExportOptions) {
  const layers: ExportLayer[] = ['titles', 'patterns', 'dots'];
  const prefix = options.sceneName ? `${options.sceneName}_` : '';

  const layerFrameCounts = layers.map((l) => {
    const dur = layerDurationMs(l, options.durationMs);
    return Math.max(1, Math.ceil((dur / 1000) * FPS));
  });
  const totalWork = layerFrameCounts.reduce((a, b) => a + b, 0);
  let done = 0;

  const masterZip = new JSZip();

  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const prevFrames = layerFrameCounts.slice(0, i).reduce((a, b) => a + b, 0);

    const layerZip = await exportLayer(layer, {
      ...options,
      onProgress: (frameDone) => {
        done = prevFrames + frameDone;
        options.onProgress(done, totalWork);
      },
    });

    const folder = masterZip.folder(layer)!;
    layerZip.forEach((path, file) => {
      folder.file(path, file.async('blob'));
    });
  }

  const blob = await masterZip.generateAsync({ type: 'blob' });
  saveAs(blob, `${prefix}pattern_gen.zip`);
}
