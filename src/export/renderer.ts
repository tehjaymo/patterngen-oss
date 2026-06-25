import type {
  AnimationState,
  TitleElement,
  PatternElement,
  SquareElement,
  DotElement,
  LetterElement,
  ExportLayer,
  PatternDef,
  MotionStyle,
  ClipSide,
} from '../types';
import { CANVAS_W, CANVAS_H, GRID_SIZE } from '../types';
import { colorizeSvgFg, svgToImage } from '../core/patterns';
import { drawAnimatedPattern } from '../engine/animations';

export async function renderFrame(
  ctx: CanvasRenderingContext2D,
  state: AnimationState,
  titles: TitleElement[],
  patterns: PatternElement[],
  squares: SquareElement[],
  letters: LetterElement[],
  dots: DotElement[],
  patternDefs: Map<string, PatternDef>,
  scale: number,
  layer?: ExportLayer,
  bgColor?: string,
  bgImage?: HTMLImageElement | null,
) {
  ctx.clearRect(0, 0, CANVAS_W * scale, CANVAS_H * scale);
  ctx.save();
  ctx.scale(scale, scale);

  if (!layer) {
    if (bgColor) {
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    if (bgImage) {
      const ir = bgImage.naturalWidth / bgImage.naturalHeight;
      const cr = CANVAS_W / CANVAS_H;
      let dw = CANVAS_W;
      let dh = CANVAS_H;
      if (ir > cr) {
        dh = CANVAS_W / ir;
      } else {
        dw = CANVAS_H * ir;
      }
      const dx = (CANVAS_W - dw) / 2;
      const dy = (CANVAS_H - dh) / 2;
      ctx.drawImage(bgImage, dx, dy, dw, dh);
    }
  }

  if (!layer || layer === 'titles') {
    for (const title of titles) {
      const progress = state.titleProgress.get(title.id) ?? 0;
      drawWithMotion(
        ctx,
        { x: title.x, y: title.y, w: title.w, h: title.h },
        progress,
        title.motionStyle,
        title.clipSide,
        () => ctx.drawImage(title.img, title.x, title.y, title.w, title.h),
      );
    }
  }

  if (!layer || layer === 'patterns') {
    const patternSize = GRID_SIZE * 2;
    for (const pat of patterns) {
      const progress = state.patternProgress.get(pat.id) ?? 0;
      const def = patternDefs.get(pat.patternId);
      if (!def) continue;

      const fgSvg = colorizeSvgFg(def.svgText, pat.colors.fg);
      const fgImg = await svgToImage(fgSvg);

      drawWithMotion(
        ctx,
        { x: pat.x, y: pat.y, w: patternSize, h: patternSize },
        progress,
        pat.motionStyle,
        pat.clipSide,
        () => {
          ctx.save();
          ctx.translate(pat.x, pat.y);
          drawAnimatedPattern(
            ctx, pat.colors.bg, pat.colors.fg, fgImg,
            def.animType, pat.motionStyle === 'wipe' ? progress : 1, patternSize, def.shapes, pat.clipSide,
          );
          ctx.restore();
        },
      );
    }

    for (const sq of squares) {
      const progress = state.squareProgress.get(sq.id) ?? 0;
      drawWithMotion(
        ctx,
        { x: sq.x, y: sq.y, w: sq.size, h: sq.size },
        progress,
        sq.motionStyle,
        sq.clipSide,
        () => {
          ctx.fillStyle = sq.color;
          ctx.fillRect(sq.x, sq.y, sq.size, sq.size);
        },
      );
    }

    for (const letter of letters) {
      const progress = state.letterProgress.get(letter.id) ?? 0;
      const img = await svgToImage(letterSvgText(letter.char, letter.color, letter.size));
      drawWithMotion(
        ctx,
        { x: letter.x, y: letter.y, w: letter.size, h: letter.size },
        progress,
        letter.motionStyle,
        letter.clipSide,
        () => ctx.drawImage(img, letter.x, letter.y, letter.size, letter.size),
      );
    }
  }

  if (!layer || layer === 'dots') {
    for (const dot of dots) {
      const opacity = state.dotOpacities.get(dot.id) ?? 0;
      const progress = state.dotProgress.get(dot.id) ?? 1;
      if (opacity <= 0) continue;
      drawWithMotion(
        ctx,
        { x: dot.x, y: dot.y, w: 8, h: 8 },
        progress,
        dot.motionStyle,
        dot.clipSide,
        () => {
          ctx.save();
          ctx.globalAlpha *= opacity;
          ctx.fillStyle = dot.color;
          ctx.beginPath();
          ctx.arc(dot.x + 4, dot.y + 4, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        },
      );
    }
  }

  ctx.restore();
}

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function letterSvgText(char: string, color: string, size: number): string {
  const fontSize = Math.max(10, Math.round(size * 0.9));
  const escaped = escapeSvgText(char);
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <text x="${size / 2}" y="${size / 2}" fill="${color}" font-size="${fontSize}" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-weight="700" text-anchor="middle" dominant-baseline="central">${escaped}</text>
</svg>`;
}

export function drawGrid(ctx: CanvasRenderingContext2D, scale: number) {
  ctx.save();
  ctx.scale(scale, scale);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= CANVAS_W; x += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();
  }
  for (let y = 0; y <= CANVAS_H; y += GRID_SIZE) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(CANVAS_W, y);
    ctx.stroke();
  }
  ctx.restore();
}

interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

function drawWithMotion(
  ctx: CanvasRenderingContext2D,
  bounds: Bounds,
  progress: number,
  style: MotionStyle,
  clipSide: ClipSide,
  draw: () => void,
) {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return;

  ctx.save();

  if (style === 'wipe') {
    const clip = clipFromSide(bounds, clipSide, p);
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.w, clip.h);
    ctx.clip();
    draw();
    ctx.restore();
    return;
  }

  if (style === 'center-wipe') {
    const clip = clipFromCenter(bounds, p);
    ctx.beginPath();
    ctx.rect(clip.x, clip.y, clip.w, clip.h);
    ctx.clip();
    draw();
    ctx.restore();
    return;
  }

  if (style === 'dissolve') {
    ctx.globalAlpha *= p;
    draw();
    ctx.restore();
    return;
  }

  if (style === 'scale') {
    const s = 0.72 + 0.28 * p;
    const cx = bounds.x + bounds.w / 2;
    const cy = bounds.y + bounds.h / 2;
    ctx.globalAlpha *= p;
    ctx.translate(cx, cy);
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);
    draw();
    ctx.restore();
    return;
  }

  const dx = slideDx(bounds, style, p);
  const dy = slideDy(bounds, style, p);
  ctx.globalAlpha *= Math.min(1, p * 1.2);
  ctx.translate(dx, dy);
  draw();
  ctx.restore();
}

function clipFromSide(bounds: Bounds, side: ClipSide, progress: number): Bounds {
  switch (side) {
    case 'left':
      return { ...bounds, w: bounds.w * progress };
    case 'right':
      return { ...bounds, x: bounds.x + bounds.w * (1 - progress), w: bounds.w * progress };
    case 'top':
      return { ...bounds, h: bounds.h * progress };
    case 'bottom':
      return { ...bounds, y: bounds.y + bounds.h * (1 - progress), h: bounds.h * progress };
  }
}

function clipFromCenter(bounds: Bounds, progress: number): Bounds {
  if (bounds.w >= bounds.h) {
    const w = bounds.w * progress;
    return { x: bounds.x + (bounds.w - w) / 2, y: bounds.y, w, h: bounds.h };
  }
  const h = bounds.h * progress;
  return { x: bounds.x, y: bounds.y + (bounds.h - h) / 2, w: bounds.w, h };
}

function slideDistance(bounds: Bounds): number {
  return Math.max(40, Math.min(180, Math.max(bounds.w, bounds.h) * 0.25));
}

function slideDx(bounds: Bounds, style: MotionStyle, progress: number): number {
  const d = slideDistance(bounds) * (1 - progress);
  if (style === 'slide-left') return d;
  if (style === 'slide-right') return -d;
  return 0;
}

function slideDy(bounds: Bounds, style: MotionStyle, progress: number): number {
  const d = slideDistance(bounds) * (1 - progress);
  if (style === 'slide-up') return d;
  if (style === 'slide-down') return -d;
  return 0;
}
