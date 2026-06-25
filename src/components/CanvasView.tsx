import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useStore } from '../store';
import { CANVAS_W, CANVAS_H, GRID_SIZE, type SelectedElement, type SelectedSingleElement, type TitleElement, type PatternElement, type SquareElement, type DotElement, type LetterElement } from '../types';
import { snapToGrid } from '../core/grid';
import { evaluate } from '../engine/timeline';
import { renderFrame, drawGrid } from '../export/renderer';

const CANVAS_BG = '#323232';

export const CanvasView: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaleRef = useRef(1);
  const [dragOver, setDragOver] = useState(false);

  const {
    titles, patterns, squares, dots, letters,
    elapsedMs, durationMs, easing, stagger, patternDefsMap, playing,
    addTitle, moveTitle, removeTitle,
    showGrid: gridOn, bgImage, clearBgImage,
    setBgImage, setElapsedMs, setPlaying,
    selectedElement, selectElement, clearSelection, generationMode,
  } = useStore();

  useEffect(() => {
    const resize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const scale = Math.min(cw / CANVAS_W, ch / CANVAS_H);
      scaleRef.current = scale;
      canvas.style.width = `${CANVAS_W * scale}px`;
      canvas.style.height = `${CANVAS_H * scale}px`;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let cancelled = false;
    const state = evaluate(elapsedMs, durationMs, titles, patterns, squares, letters, dots, easing, stagger);
    renderFrame(ctx, state, titles, patterns, squares, letters, dots, patternDefsMap, 1, undefined, CANVAS_BG, bgImage).then(() => {
      if (!cancelled) {
        if (!playing && gridOn) drawGrid(ctx, 1);
        drawSelection(ctx, selectedElement, titles, patterns, squares, letters, dots);
      }
    });
    return () => { cancelled = true; };
  }, [elapsedMs, durationMs, titles, patterns, squares, letters, dots, easing, stagger, patternDefsMap, playing, gridOn, bgImage, selectedElement]);

  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scale = scaleRef.current;
    return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
  }, []);

  const isInsideCanvas = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;
    const rect = canvas.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const files = e.dataTransfer.files;
      if (!files.length) return;
      const { x: dropX, y: dropY } = toCanvasCoords(e.clientX, e.clientY);
      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const w = Math.round(img.naturalWidth / 2);
            const h = Math.round(img.naturalHeight / 2);
            const x = snapToGrid(dropX - w / 2);
            const y = snapToGrid(dropY - h / 2);
            addTitle(img, x, y, w, h);
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      });
    },
    [addTitle, toCanvasCoords],
  );

  const dragState = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  const hitTest = useCallback((mx: number, my: number): SelectedSingleElement | null => {
    for (let i = titles.length - 1; i >= 0; i--) {
      const t = titles[i];
      if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) {
        return { scope: 'element', kind: 'title', id: t.id };
      }
    }
    for (let i = squares.length - 1; i >= 0; i--) {
      const sq = squares[i];
      if (mx >= sq.x && mx <= sq.x + sq.size && my >= sq.y && my <= sq.y + sq.size) {
        return { scope: 'element', kind: 'square', id: sq.id };
      }
    }
    for (let i = letters.length - 1; i >= 0; i--) {
      const letter = letters[i];
      if (mx >= letter.x && mx <= letter.x + letter.size && my >= letter.y && my <= letter.y + letter.size) {
        return { scope: 'element', kind: 'letter', id: letter.id };
      }
    }
    const patternSize = GRID_SIZE * 2;
    for (let i = patterns.length - 1; i >= 0; i--) {
      const pat = patterns[i];
      if (mx >= pat.x && mx <= pat.x + patternSize && my >= pat.y && my <= pat.y + patternSize) {
        return { scope: 'element', kind: 'pattern', id: pat.id };
      }
    }
    for (let i = dots.length - 1; i >= 0; i--) {
      const dot = dots[i];
      if (mx >= dot.x && mx <= dot.x + 8 && my >= dot.y && my <= dot.y + 8) {
        return { scope: 'element', kind: 'dot', id: dot.id };
      }
    }
    return null;
  }, [titles, squares, letters, patterns, dots]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const { x: mx, y: my } = toCanvasCoords(e.clientX, e.clientY);
      const hit = hitTest(mx, my);
      if (hit) selectElement(hit.kind, hit.id);
      else clearSelection();

      for (let i = titles.length - 1; i >= 0; i--) {
        const t = titles[i];
        if (mx >= t.x && mx <= t.x + t.w && my >= t.y && my <= t.y + t.h) {
          dragState.current = { id: t.id, offsetX: mx - t.x, offsetY: my - t.y };
          return;
        }
      }
    },
    [titles, toCanvasCoords, hitTest, selectElement, clearSelection],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState.current) return;
      const { x: mx, y: my } = toCanvasCoords(e.clientX, e.clientY);
      const x = snapToGrid(mx - dragState.current.offsetX);
      const y = snapToGrid(my - dragState.current.offsetY);
      moveTitle(dragState.current.id, x, y);
    },
    [moveTitle, toCanvasCoords],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState.current) return;
      const id = dragState.current.id;
      dragState.current = null;
      if (!isInsideCanvas(e.clientX, e.clientY)) removeTitle(id);
    },
    [removeTitle, isInsideCanvas],
  );

  const handleMouseLeave = useCallback(() => {
    if (!dragState.current) return;
    const id = dragState.current.id;
    dragState.current = null;
    removeTitle(id);
  }, [removeTitle]);

  const handleBgUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => setBgImage(img, reader.result as string);
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [setBgImage]);

  const cycleDuration = 5 * durationMs;
  const scrubValue = cycleDuration > 0 ? Math.min(elapsedMs / cycleDuration, 1) : 0;
  const titleEnd = durationMs / cycleDuration;
  const patternEnd = (2 * durationMs) / cycleDuration;

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setElapsedMs(val * cycleDuration);
    if (playing) setPlaying(false);
  }, [cycleDuration, setElapsedMs, playing, setPlaying]);

  return (
    <div style={styles.wrapper}>
      <div
        ref={containerRef}
        style={{ ...styles.container, ...(dragOver ? styles.containerDragOver : {}) }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <canvas
          data-testid="pattern-canvas"
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={styles.canvas}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        />
        {titles.length === 0 && !playing && (
          <div style={styles.hint}>Drop title images here</div>
        )}
        <div style={styles.bgBtnGroup}>
          <button onClick={handleBgUpload} style={styles.bgBtn} title="Upload background reference">BG</button>
          {bgImage && <button onClick={clearBgImage} style={styles.bgBtn} title="Remove background">×</button>}
        </div>
      </div>

      <div style={styles.timelineArea}>
        <div style={styles.trackWrap}>
          <div style={styles.trackBg}>
            <div style={{ ...styles.trackSegment, left: 0, width: `${titleEnd * 100}%`, background: 'var(--track-light)' }} />
            <div style={{ ...styles.trackSegment, left: `${titleEnd * 100}%`, width: `${(patternEnd - titleEnd) * 100}%`, background: 'var(--track-mid)' }} />
            <div style={{ ...styles.trackSegment, left: `${patternEnd * 100}%`, width: `${(1 - patternEnd) * 100}%`, background: 'var(--track-dark)' }} />
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={scrubValue}
            onChange={handleScrub}
            style={styles.scrubber}
            className="timeline-scrubber"
          />
        </div>
        <div style={styles.labelsRow}>
          <span style={{ ...styles.layerLabel, position: 'absolute', left: `${titleEnd * 50}%`, transform: 'translateX(-50%)' }}>TITLES</span>
          <span style={{ ...styles.layerLabel, position: 'absolute', left: `${(titleEnd + patternEnd) / 2 * 100}%`, transform: 'translateX(-50%)' }}>{generationMode === 'letters' ? 'LETTERS' : 'PATTERNS'}</span>
          <span style={{ ...styles.layerLabel, position: 'absolute', left: `${(patternEnd + 1) / 2 * 100}%`, transform: 'translateX(-50%)' }}>DOTS</span>
        </div>
      </div>
    </div>
  );
};

function drawSelection(
  ctx: CanvasRenderingContext2D,
  selected: SelectedElement | null,
  titles: TitleElement[],
  patterns: PatternElement[],
  squares: SquareElement[],
  letters: LetterElement[],
  dots: DotElement[],
) {
  if (!selected) return;

  const bounds = getSelectionBounds(selected, titles, patterns, squares, letters, dots);
  if (bounds.length === 0) return;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  for (const b of bounds) {
    ctx.strokeRect(b.x - 4, b.y - 4, b.w + 8, b.h + 8);
  }
  ctx.restore();
}

function getSelectionBounds(
  selected: SelectedElement,
  titles: TitleElement[],
  patterns: PatternElement[],
  squares: SquareElement[],
  letters: LetterElement[],
  dots: DotElement[],
): Array<{ x: number; y: number; w: number; h: number }> {
  if (selected.scope === 'layer') {
    switch (selected.kind) {
      case 'title':
        return titles.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }));
      case 'pattern':
        return patterns.map((p) => ({ x: p.x, y: p.y, w: GRID_SIZE * 2, h: GRID_SIZE * 2 }));
      case 'square':
        return squares.map((sq) => ({ x: sq.x, y: sq.y, w: sq.size, h: sq.size }));
      case 'letter':
        return letters.map((letter) => ({ x: letter.x, y: letter.y, w: letter.size, h: letter.size }));
      case 'dot':
        return dots.map((dot) => ({ x: dot.x, y: dot.y, w: 8, h: 8 }));
    }
  }

  if (selected.kind === 'title') {
    const t = titles.find((title) => title.id === selected.id);
    return t ? [{ x: t.x, y: t.y, w: t.w, h: t.h }] : [];
  }
  if (selected.kind === 'pattern') {
    const p = patterns.find((pat) => pat.id === selected.id);
    return p ? [{ x: p.x, y: p.y, w: GRID_SIZE * 2, h: GRID_SIZE * 2 }] : [];
  }
  if (selected.kind === 'square') {
    const sq = squares.find((square) => square.id === selected.id);
    return sq ? [{ x: sq.x, y: sq.y, w: sq.size, h: sq.size }] : [];
  }
  if (selected.kind === 'letter') {
    const letter = letters.find((item) => item.id === selected.id);
    return letter ? [{ x: letter.x, y: letter.y, w: letter.size, h: letter.size }] : [];
  }
  const dot = dots.find((d) => d.id === selected.id);
  return dot ? [{ x: dot.x, y: dot.y, w: 8, h: 8 }] : [];
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    gap: 40,
    minWidth: 0,
  },
  container: {
    flex: 1,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    overflow: 'hidden',
    background: 'var(--canvas-frame)',
    position: 'relative',
    borderRadius: 12,
  },
  containerDragOver: {
    outline: '1px solid var(--muted)',
    outlineOffset: -1,
  },
  canvas: {
    display: 'block',
    borderRadius: 12,
  },
  hint: {
    position: 'absolute',
    color: 'var(--hint)',
    fontSize: 14,
    pointerEvents: 'none',
    bottom: 16,
  },
  bgBtnGroup: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    display: 'flex',
    gap: 4,
    zIndex: 10,
  },
  bgBtn: {
    background: 'rgba(0,0,0,0.4)',
    border: '1px solid var(--muted-3)',
    borderRadius: 3,
    color: 'var(--muted)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    padding: '3px 8px',
    fontFamily: 'inherit',
  },
  timelineArea: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  trackWrap: {
    position: 'relative',
    height: 8,
  },
  trackBg: {
    position: 'absolute',
    inset: 0,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackSegment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  scrubber: {
    position: 'absolute',
    top: -4,
    left: 0,
    width: '100%',
    height: 16,
    margin: 0,
    cursor: 'pointer',
    background: 'transparent',
    WebkitAppearance: 'none' as never,
    appearance: 'none' as never,
  },
  labelsRow: {
    position: 'relative',
    height: 16,
  },
  layerLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--muted-2)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap',
  },
};
