# PatternGen Scene Export (Figma plugin)

Exports Figma artboards as scene `.json` files that can be loaded into
PatternGen via its **LOAD** button. The exported file contains a
deterministic **seed**, so playback is ready the moment it's loaded.

## Install (local / development)

1. In Figma, open **Plugins → Development → Import plugin from manifest…**
2. Select `figma-plugin/manifest.json`.
3. The plugin appears under **Plugins → Development → PatternGen Scene Export**.

## How to prepare an artboard

- Create a frame that is exactly **1920 × 1080**.
- Set a **20 px grid** (Layout Grid → Grid, 20 px).
- Place each title as a top-level child of the frame. Width and height
  should be multiples of 20.
- Name the frame — this becomes the `sceneName` in the exported JSON
  and the prefix for PNG sequence exports.
- Use any colors you like — the plugin detects which colors appear in
  fills and strokes and includes them in the exported scene file.

## How to export

1. Select one or more 1920×1080 frames.
2. Run **PatternGen Scene Export**.
3. Click **Export Selected Frames**.
4. One `<frameName>_patterngen.json` file is saved per frame.

In PatternGen:

1. Click **LOAD** and pick the `*_patterngen.json` file.
2. Patterns / squares / dots are generated **deterministically from the
   seed**, so the scene is immediately ready to **PLAY**.

## What gets exported

- **Titles**: every visible top-level child of the frame is rendered to a
  **2× PNG** (retina) and embedded as a `data:` URL. Positions and sizes
  are snapped to the 20 px grid. The plugin exports each title inside a
  transparent bounds wrapper so intentional padding around text is preserved.
- **Text metadata**: if a title layer is a text box, or contains nested text
  boxes, the exported title also includes a plain `text` string and a
  `textNodes` array with each text node's id, name, text, and frame-relative
  bounds. PatternGen still uses the rendered PNG for visual fidelity.
- **Color set**: the plugin scans the frame's fills and strokes and
  includes all unique colors found (excluding pure black/white, which
  are always available in PatternGen).
- **Seed**: a random 31-bit integer. PatternGen's placement engine
  is seeded by this value, so the same JSON always produces the same
  layout.
- **Scene defaults** (tweakable in the app after loading): duration
  `6000 ms`, density `10`, proximity `2`, stagger `3`, theme `dark`.

## Notes

- Layers outside the 1920×1080 canvas are skipped and listed in the
  plugin's status panel.
- Filenames are sanitized — spaces become underscores, special chars
  become `_`.
