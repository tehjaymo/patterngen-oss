// PatternGen Scene Export — runs in Figma's sandbox.
// Exports top-level children of a selected 1920x1080 frame as 2x PNGs,
// detects unique fill/stroke colors used on the artboard,
// and forwards everything to the UI iframe, which packages the result
// into a scene .json compatible with Pattern Generator's LOAD.

const CANVAS_W = 1920;
const CANVAS_H = 1080;
const GRID = 20;

figma.showUI(__html__, { width: 320, height: 360 });

const snap = (v) => Math.round(v / GRID) * GRID;

function rgbToHex(r, g, b) {
  const h = (v) => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase();
  return '#' + h(r) + h(g) + h(b);
}

function collectUsedColors(node, out) {
  if ('fills' in node && Array.isArray(node.fills)) {
    for (const f of node.fills) {
      if (f && f.type === 'SOLID' && f.visible !== false) {
        out.add(rgbToHex(f.color.r, f.color.g, f.color.b));
      }
    }
  }
  if ('strokes' in node && Array.isArray(node.strokes)) {
    for (const s of node.strokes) {
      if (s && s.type === 'SOLID' && s.visible !== false) {
        out.add(rgbToHex(s.color.r, s.color.g, s.color.b));
      }
    }
  }
  if ('children' in node) {
    for (const child of node.children) collectUsedColors(child, out);
  }
}

function randomSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

async function exportFrame(frame) {
  const frameBox = frame.absoluteBoundingBox;
  if (!frameBox) throw new Error(`Cannot determine bounds of "${frame.name}".`);

  const titles = [];
  const skipped = [];
  const usedColors = new Set();

  collectUsedColors(frame, usedColors);

  for (const child of frame.children) {
    if (child.visible === false) continue;
    const box = child.absoluteBoundingBox;
    if (!box) {
      skipped.push(`${child.name} (no bounds)`);
      continue;
    }

    const x = snap(box.x - frameBox.x);
    const y = snap(box.y - frameBox.y);
    const w = Math.max(GRID, snap(box.width));
    const h = Math.max(GRID, snap(box.height));

    if (x < 0 || y < 0 || x + w > CANVAS_W || y + h > CANVAS_H) {
      skipped.push(`${child.name} (outside 1920x1080)`);
      continue;
    }

    let bytes;
    try {
      bytes = await child.exportAsync({
        format: 'PNG',
        constraint: { type: 'SCALE', value: 2 },
      });
    } catch (e) {
      skipped.push(`${child.name} (export failed)`);
      continue;
    }

    titles.push({
      id: child.id,
      name: child.name,
      bytes: Array.from(bytes),
      x, y, w, h,
    });
  }

  // Filter out pure black/white since those are fixed; keep all unique colors found
  const enabledColors = Array.from(usedColors).filter(
    (c) => c !== '#000000' && c !== '#FFFFFF' && c !== '#ffffff',
  );

  return {
    sceneName: frame.name,
    seed: randomSeed(),
    titles,
    skipped,
    enabledColors,
  };
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'export') {
    const selection = figma.currentPage.selection;

    if (selection.length === 0) {
      figma.ui.postMessage({ type: 'error', message: 'Select a 1920x1080 frame.' });
      return;
    }

    const frames = [];
    for (const node of selection) {
      if (node.type !== 'FRAME') {
        figma.ui.postMessage({ type: 'error', message: `"${node.name}" is not a frame.` });
        return;
      }
      if (node.width !== CANVAS_W || node.height !== CANVAS_H) {
        figma.ui.postMessage({
          type: 'error',
          message: `"${node.name}" is ${Math.round(node.width)}x${Math.round(node.height)}. Must be ${CANVAS_W}x${CANVAS_H}.`,
        });
        return;
      }
      frames.push(node);
    }

    const scenes = [];
    for (let i = 0; i < frames.length; i++) {
      figma.ui.postMessage({
        type: 'progress',
        current: i,
        total: frames.length,
        name: frames[i].name,
      });
      try {
        const scene = await exportFrame(frames[i]);
        scenes.push(scene);
      } catch (e) {
        figma.ui.postMessage({ type: 'error', message: (e && e.message) || String(e) });
        return;
      }
    }

    figma.ui.postMessage({ type: 'exported', scenes });
    return;
  }

  if (msg.type === 'close') {
    figma.closePlugin();
  }
};
