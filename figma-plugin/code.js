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
const round = (v) => Math.round(v);

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

function collectTextNodes(node, frameBox, out) {
  if (node.visible === false) return;

  if (node.type === 'TEXT') {
    const box = node.absoluteBoundingBox;
    out.push({
      id: node.id,
      name: node.name,
      text: node.characters,
      x: box ? round(box.x - frameBox.x) : 0,
      y: box ? round(box.y - frameBox.y) : 0,
      w: box ? round(box.width) : 0,
      h: box ? round(box.height) : 0,
    });
    return;
  }

  if ('children' in node) {
    for (const child of node.children) collectTextNodes(child, frameBox, out);
  }
}

async function exportChildWithBounds(child, frameBox, bounds) {
  const wrapper = figma.createFrame();
  wrapper.name = `${child.name} export bounds`;
  wrapper.x = frameBox.x + bounds.x;
  wrapper.y = frameBox.y + bounds.y;
  wrapper.resize(bounds.w, bounds.h);
  wrapper.fills = [];
  wrapper.strokes = [];
  wrapper.clipsContent = true;

  const clone = child.clone();
  wrapper.appendChild(clone);

  const childBox = child.absoluteBoundingBox;
  if (childBox) {
    clone.x = childBox.x - wrapper.x;
    clone.y = childBox.y - wrapper.y;
  } else {
    clone.x = 0;
    clone.y = 0;
  }

  try {
    return await wrapper.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 },
    });
  } finally {
    wrapper.remove();
  }
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
      bytes = await exportChildWithBounds(child, frameBox, { x, y, w, h });
    } catch (e) {
      skipped.push(`${child.name} (export failed)`);
      continue;
    }

    const textNodes = [];
    collectTextNodes(child, frameBox, textNodes);
    const text = textNodes.map((textNode) => textNode.text).join('\n');

    const title = {
      id: child.id,
      name: child.name,
      bytes: Array.from(bytes),
      x, y, w, h,
    };
    if (textNodes.length > 0) {
      title.text = text;
      title.textNodes = textNodes;
    }
    titles.push(title);
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
