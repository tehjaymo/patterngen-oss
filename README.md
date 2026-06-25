# PatternGen

A procedural pattern generator for motion graphics. Design title compositions in Figma, generate animated patterns around them in the browser, export layered PNG sequences, and import them into Blender as emissive image-sequence planes.

![PatternGen](https://img.shields.io/badge/license-MIT-blue)

[![Motion App — watch the walkthrough on YouTube](docs/motion-app-thumbnail.png)](https://www.youtube.com/watch?v=edUOvt6Y5ts)

**Watch the walkthrough:** [Motion App — Figma → Web App → Blender workflow](https://www.youtube.com/watch?v=edUOvt6Y5ts)

This video shows the full pipeline in action: designing a title composition in Figma, exporting it with the plugin, generating and animating patterns in the web app, and importing the layered PNG sequences into Blender for final compositing.

## Screenshots

![PatternGen editor with a loaded scene and square layer selected](docs/patterngen-editor.png)

The web app centers a 1920×1080 canvas beside layer and motion controls. Load a scene, generate a deterministic layout, select individual elements or whole layers, then preview and export transparent PNG sequences.

![PatternGen layer and motion controls](docs/patterngen-motion-controls.png)

## Overview

PatternGen is a creative toolchain for building animated title cards with procedural pattern fills:

1. **Figma plugin** — export artboards as scene JSON files with title positions and colors
2. **Web app** — load scenes, generate patterns, tune per-layer motion, preview animations, export PNG sequences
3. **Blender add-on** — import the exported sequences as layered 3D planes for compositing

The generator places SVG-based pattern shapes, colored squares, and pulsating dots around your title elements using a seeded random placement algorithm. Every generation is deterministic — same seed, same layout.

## Quick start

```bash
git clone https://github.com/halfof8/patterngen-oss.git
cd patterngen-oss
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Usage

### Adding titles

Drag and drop PNG/JPG images onto the canvas. They snap to a 20 px grid.
Click and drag to reposition. Drag off the canvas to remove.

### Selecting layers and elements

The sidebar lists generated layers and elements after a title image or scene has been loaded:

- Click **TITLES**, **SQUARES**, **PATTERNS**, or **DOTS** to select every item in that layer.
- Click an individual row such as **TITLE 1** or **SQUARE 3** to edit just that element.
- Selected items are outlined on the canvas.

### Motion controls

The **MOTION** panel changes how selected titles, pattern tiles, and squares reveal:

| Motion      | Effect                                           |
| ----------- | ------------------------------------------------ |
| `CENTER`    | Reveals from the element center                  |
| `WIPE`      | Reveals from the selected direction              |
| `DISSOLVE`  | Fades the element in                             |
| `SCALE`     | Scales and fades the element into place          |
| `UP/DOWN`   | Slides vertically into place                     |
| `LEFT/RIGHT`| Slides horizontally into place                   |
| `RANDOM`    | Gives selected items individual randomized motion |

Direction buttons set the wipe side for selected titles, pattern tiles, and squares. When **DOTS** are selected, **RANDOM** randomizes each dot's pulse timing instead of applying a reveal style.

### Adding pattern shapes

PatternGen ships without built-in patterns. Add your own SVG shapes to `public/patterns/`:

1. Create a 40×40 px SVG
2. Use `fill="white"` for the background rect and `fill="black"` / `stroke="black"` for foreground shapes
3. Register the file in `src/core/patterns.ts` → `PATTERN_FILES` array with an animation type

**Supported animation types:**

| Type       | Effect                                             |
| ---------- | -------------------------------------------------- |
| `dots`     | Each shape fades in individually with stagger       |
| `capsule`  | Shapes grow from center along their longer axis     |
| `circle`   | Pie-fill clockwise reveal                           |
| `arrow`    | Slides up into view from below                      |
| `square`   | Scales down from 1.6× to 1×                        |
| `stripes`  | Stripes slide in from top, staggered left-to-right  |
| `cross`    | Scales down from 1.6× to 1×                        |

**Example SVG** (`public/patterns/circle_fill.svg`):

```xml
<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="40" height="40" fill="white"/>
  <circle cx="20" cy="20" r="14" fill="black"/>
</svg>
```

Then register it:

```typescript
// src/core/patterns.ts
const PATTERN_FILES = [
  { file: 'circle_fill.svg', animType: 'circle' },
];
```

### Colors

The app starts with two fixed colors — **black** and **white**. Click **+ ADD COLOR** in the sidebar to add up to 3 custom colors via a color picker. Toggle any color on/off by clicking its swatch. Color pairs for pattern fills are generated algorithmically from your chosen palette.

### Controls

| Control    | Description                                           |
| ---------- | ----------------------------------------------------- |
| GENERATE   | Re-roll the pattern layout with a new random seed     |
| PLAY/PAUSE | Animate the reveal sequence                           |
| SAVE       | Download the current scene as a `.json` file          |
| LOAD       | Load a scene from a `.json` file                      |
| EXPORT     | Export three PNG sequences (titles, patterns, dots)   |
| RANDOM     | Randomize motion for the selected element or layer    |

### Sidebar parameters

- **Density** (1–20) — how many pattern elements to place
- **Proximity** (1–20) — how far from titles patterns can spawn
- **Stagger** (0–5) — animation delay spread across elements
- **Grid** — toggle the 20 px reference grid
- **Theme** — dark or light UI

### Export

Clicking **EXPORT** renders three 4× resolution PNG sequences packaged in a ZIP:

```
scene_pattern_gen.zip
  titles/
    scene_titles_00000.png
    scene_titles_00001.png
    ...
  patterns/
    scene_patterns_00000.png
    ...
  dots/
    scene_dots_00000.png
    ...
```

Each layer has a transparent background so they can be composited independently.

Changing layer motion in the web app changes the rendered PNG frames only. The exported folder structure remains compatible with the Blender add-on.

### Tests

Run the Playwright end-to-end tests with:

```bash
npm run test:e2e
```

The suite covers the editor shell, scene loading, layer selection, group motion controls, random square/dot behavior, sidebar scrolling, and saved scene motion settings.

## Figma plugin

See [`figma-plugin/README.md`](figma-plugin/README.md) for setup and usage.

The plugin exports 1920×1080 Figma frames as scene JSON files. Title elements are rendered at 2× resolution and embedded as data URLs. The plugin detects colors used in your design and includes them in the exported file.

## Blender add-on

See [`blender-addon/README.md`](blender-addon/README.md) for setup and usage.

The add-on imports the exported ZIP into Blender as three emissive image-sequence planes (titles, patterns, dots) with alpha blending, ready for 3D compositing.

## Project structure

```
patterngen/
├── public/
│   └── patterns/         # Place your SVG pattern shapes here
├── src/
│   ├── components/       # React UI components
│   ├── core/             # Pattern loading, color generation, grid, RNG
│   ├── engine/           # Animation timeline, easing functions
│   ├── export/           # PNG sequence exporter & renderer
│   ├── App.tsx           # Root component
│   ├── main.tsx          # Entry point
│   ├── store.ts          # Zustand state management
│   └── types.ts          # Shared type definitions & constants
├── figma-plugin/         # Figma scene export plugin
├── blender-addon/        # Blender importer add-on
├── index.html            # App shell
├── vite.config.ts        # Vite configuration
└── package.json
```

## Tech stack

- **React 18** + **TypeScript** — UI
- **Zustand** — state management
- **Vite** — dev server & build
- **Canvas 2D** — rendering & animation
- **JSZip** + **FileSaver** — PNG sequence export

## Creating your own pattern shapes

All pattern SVGs follow the same convention:

1. **Canvas**: 40 × 40 px viewBox
2. **Background**: a `<rect width="40" height="40" fill="white"/>` — recolored to the pattern's background color at runtime
3. **Foreground**: shapes with `fill="black"` and/or `stroke="black"` — recolored to the pattern's foreground color
4. **Naming**: descriptive filename, e.g. `dots_diagonal.svg`

The animation engine reads the SVG's structure to drive per-shape animations (stagger, growth direction, reveal order), so simpler shapes with discrete elements animate best.

## License

MIT — see [LICENSE](LICENSE).
