import { create } from 'zustand';
import type {
  TitleElement,
  PatternElement,
  SquareElement,
  DotElement,
  LetterElement,
  PatternDef,
  ColorPair,
  MotionStyle,
  ClipSide,
  SelectedElement,
  SelectableElementKind,
  SelectableLayerKind,
  TitleTextNode,
  GenerationMode,
} from './types';
import { FIXED_COLORS, DEFAULT_CUSTOM_COLORS, DEFAULT_TITLE_MOTION, DEFAULT_ELEMENT_MOTION } from './types';
import type { EasingName } from './engine/easing';
import { loadAllPatterns } from './core/patterns';
import { generatePlacement } from './core/placement';
import { generatePalette } from './core/colors';
import { mulberry32, randomSeed } from './core/rng';

interface SavedTitle {
  id: string;
  name?: string;
  text?: string;
  textNodes?: TitleTextNode[];
  dataUrl: string;
  x: number;
  y: number;
  w: number;
  h: number;
  motionStyle?: MotionStyle;
  clipSide?: ClipSide;
}

interface SavedScene {
  sceneName?: string;
  seed?: number;
  titles: SavedTitle[];
  patterns?: PatternElement[];
  squares?: SquareElement[];
  dots?: DotElement[];
  letters?: LetterElement[];
  generationMode?: GenerationMode;
  durationMs: number;
  easing: EasingName;
  density: number;
  proximity: number;
  stagger: number;
  theme: 'dark' | 'light';
  enabledColors: string[];
  customColors?: string[];
  enabledPatterns?: string[];
}

function imgToDataUrl(img: HTMLImageElement, displayW: number, displayH: number): string {
  const c = document.createElement('canvas');
  c.width = displayW;
  c.height = displayH;
  c.getContext('2d')!.drawImage(img, 0, 0, displayW, displayH);
  return c.toDataURL('image/png');
}

function dataUrlToImg(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

interface AppState {
  patternDefs: PatternDef[];
  patternDefsMap: Map<string, PatternDef>;
  enabledPatterns: Set<string>;
  loadingPatterns: boolean;

  titles: TitleElement[];
  patterns: PatternElement[];
  squares: SquareElement[];
  dots: DotElement[];
  letters: LetterElement[];

  sceneName: string;
  seed: number;
  durationMs: number;
  easing: EasingName;
  density: number;
  proximity: number;
  stagger: number;
  showGrid: boolean;
  theme: 'dark' | 'light';
  generationMode: GenerationMode;

  enabledColors: string[];
  customColors: string[];

  bgImage: HTMLImageElement | null;
  bgImageDataUrl: string | null;

  logoColors: ColorPair[];
  selectedElement: SelectedElement | null;

  playing: boolean;
  elapsedMs: number;

  exporting: boolean;
  exportProgress: number;

  init: () => Promise<void>;
  togglePattern: (id: string) => void;
  selectAllPatterns: () => void;
  deselectAllPatterns: () => void;
  toggleColor: (color: string) => void;
  setCustomColor: (index: number, color: string) => void;
  addCustomColor: () => void;
  removeCustomColor: (index: number) => void;
  setSceneName: (name: string) => void;
  setSeed: (seed: number) => void;
  setDuration: (ms: number) => void;
  setEasing: (e: EasingName) => void;
  setDensity: (d: number) => void;
  setProximity: (p: number) => void;
  setStagger: (s: number) => void;
  setShowGrid: (v: boolean) => void;
  setTheme: (t: 'dark' | 'light') => void;
  setGenerationMode: (mode: GenerationMode) => void;
  addTitle: (img: HTMLImageElement, x: number, y: number, w: number, h: number) => void;
  moveTitle: (id: string, x: number, y: number) => void;
  removeTitle: (id: string) => void;
  generate: (seed?: number) => void;
  setPlaying: (p: boolean) => void;
  setElapsedMs: (ms: number) => void;
  setExporting: (e: boolean) => void;
  setExportProgress: (p: number) => void;
  saveSceneToFile: () => void;
  loadSceneFromFile: () => void;
  setBgImage: (img: HTMLImageElement, dataUrl: string) => void;
  clearBgImage: () => void;
  selectElement: (kind: SelectableElementKind, id: string) => void;
  selectLayer: (kind: SelectableLayerKind) => void;
  clearSelection: () => void;
  setSelectedMotionStyle: (style: MotionStyle) => void;
  setSelectedClipSide: (side: ClipSide) => void;
  randomizeSelectedMotion: () => void;
}

let idCounter = 0;
const nextId = () => `el_${++idCounter}`;
const RANDOM_MOTION_STYLES: MotionStyle[] = [
  'center-wipe',
  'wipe',
  'dissolve',
  'scale',
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
];
const RANDOM_CLIP_SIDES: ClipSide[] = ['top', 'bottom', 'left', 'right'];

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDotMotion(dot: DotElement): DotElement {
  return {
    ...dot,
    blinkPhase: Math.random(),
    blinkSpeed: 0.15 + Math.random() * 0.25,
  };
}

function randomElementMotion<T extends { motionStyle: MotionStyle; clipSide: ClipSide }>(element: T): T {
  return {
    ...element,
    motionStyle: pickRandom(RANDOM_MOTION_STYLES),
    clipSide: pickRandom(RANDOM_CLIP_SIDES),
  };
}

export const useStore = create<AppState>((set, get) => ({
  patternDefs: [],
  patternDefsMap: new Map(),
  enabledPatterns: new Set(),
  loadingPatterns: true,

  titles: [],
  patterns: [],
  squares: [],
  dots: [],
  letters: [],

  sceneName: 'scene',
  seed: randomSeed(),
  durationMs: 6000,
  easing: 'easeOutCubic',
  density: 10,
  proximity: 2,
  stagger: 3,
  showGrid: true,
  theme: 'dark',
  generationMode: 'marks',

  enabledColors: [...FIXED_COLORS],
  customColors: [...DEFAULT_CUSTOM_COLORS],

  bgImage: null,
  bgImageDataUrl: null,

  logoColors: [],
  selectedElement: null,

  playing: false,
  elapsedMs: 0,

  exporting: false,
  exportProgress: 0,

  async init() {
    const defs = await loadAllPatterns();
    const defsMap = new Map(defs.map((d) => [d.id, d]));
    const allIds = new Set(defs.map((d) => d.id));
    set({ patternDefs: defs, patternDefsMap: defsMap, enabledPatterns: allIds, loadingPatterns: false });
  },

  togglePattern(id) {
    set((s) => {
      const next = new Set(s.enabledPatterns);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { enabledPatterns: next };
    });
  },

  selectAllPatterns() {
    set((s) => ({ enabledPatterns: new Set(s.patternDefs.map((d) => d.id)) }));
  },

  deselectAllPatterns() {
    set({ enabledPatterns: new Set() });
  },

  toggleColor(color) {
    set((s) => {
      const next = s.enabledColors.includes(color)
        ? s.enabledColors.filter((c) => c !== color)
        : [...s.enabledColors, color];
      return { enabledColors: next };
    });
  },

  setCustomColor(index, color) {
    set((s) => {
      const next = [...s.customColors];
      next[index] = color;
      const wasEnabled = s.enabledColors.includes(s.customColors[index]);
      let enabledNext = s.enabledColors.filter((c) => c !== s.customColors[index]);
      if (wasEnabled) enabledNext = [...enabledNext, color];
      return { customColors: next, enabledColors: enabledNext };
    });
  },

  addCustomColor() {
    set((s) => {
      if (s.customColors.length >= 3) return {};
      const newColor = '#808080';
      return {
        customColors: [...s.customColors, newColor],
        enabledColors: [...s.enabledColors, newColor],
      };
    });
  },

  removeCustomColor(index) {
    set((s) => {
      const removed = s.customColors[index];
      const next = s.customColors.filter((_, i) => i !== index);
      return {
        customColors: next,
        enabledColors: s.enabledColors.filter((c) => c !== removed),
      };
    });
  },

  setSceneName(name) { set({ sceneName: name }); },
  setSeed(seed) { set({ seed }); },
  setDuration(ms) { set({ durationMs: ms }); },
  setEasing(e) { set({ easing: e }); },
  setDensity(d) { set({ density: d }); },
  setProximity(p) { set({ proximity: p }); },
  setStagger(s) { set({ stagger: s }); },
  setShowGrid(v) { set({ showGrid: v }); },
  setTheme(t) {
    set({ theme: t });
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = t;
    }
  },
  setGenerationMode(mode) {
    set({ generationMode: mode });
    const { titles, seed } = get();
    if (titles.length > 0) get().generate(seed);
  },

  addTitle(img, x, y, w, h) {
    set((s) => ({
      titles: [...s.titles, {
        id: nextId(), img, x, y, w, h,
        motionStyle: DEFAULT_TITLE_MOTION,
        clipSide: 'left',
      }],
    }));
  },

  moveTitle(id, x, y) {
    set((s) => ({ titles: s.titles.map((t) => (t.id === id ? { ...t, x, y } : t)) }));
  },

  removeTitle(id) {
    set((s) => ({
      titles: s.titles.filter((t) => t.id !== id),
      selectedElement: s.selectedElement?.scope === 'element' &&
        s.selectedElement.kind === 'title' &&
        s.selectedElement.id === id
        ? null
        : s.selectedElement,
    }));
  },

  generate(seed) {
    const s = get();
    const useSeed = seed !== undefined ? seed : randomSeed();
    const rand = mulberry32(useSeed);
    const enabledDefs = s.patternDefs.filter((d) => s.enabledPatterns.has(d.id));
    const { patterns, squares, dots, letters } = generatePlacement(
      s.titles, enabledDefs, s.enabledColors, s.density, s.proximity, rand, s.generationMode,
    );
    const palette = generatePalette(s.enabledColors);
    const logoColors: ColorPair[] = [];
    for (let i = 0; i < 3; i++) {
      logoColors.push(palette.length > 0 ? palette[Math.floor(rand() * palette.length)] : { bg: '#404040', fg: '#888888' });
    }
    set({ seed: useSeed, patterns, squares, dots, letters, logoColors, elapsedMs: 3 * s.durationMs, playing: false, selectedElement: null });
  },

  setPlaying(p) { set({ playing: p }); },
  setElapsedMs(ms) { set({ elapsedMs: ms }); },
  setExporting(e) { set({ exporting: e }); },
  setExportProgress(p) { set({ exportProgress: p }); },

  setBgImage(img, dataUrl) { set({ bgImage: img, bgImageDataUrl: dataUrl }); },
  clearBgImage() { set({ bgImage: null, bgImageDataUrl: null }); },

  saveSceneToFile() {
    try {
      const s = get();
      const saved: SavedScene = {
        sceneName: s.sceneName,
        seed: s.seed,
        titles: s.titles.map((t) => ({
          id: t.id,
          name: t.name,
          text: t.text,
          textNodes: t.textNodes,
          dataUrl: imgToDataUrl(t.img, t.w, t.h),
          x: t.x,
          y: t.y,
          w: t.w,
          h: t.h,
          motionStyle: t.motionStyle,
          clipSide: t.clipSide,
        })),
        durationMs: s.durationMs,
        easing: s.easing,
        density: s.density,
        proximity: s.proximity,
        stagger: s.stagger,
        theme: s.theme,
        generationMode: s.generationMode,
        enabledColors: s.enabledColors,
        customColors: s.customColors,
        enabledPatterns: Array.from(s.enabledPatterns),
      };
      const json = JSON.stringify(saved, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${s.sceneName || 'scene'}_patterngen.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Save failed:', e);
    }
  },

  loadSceneFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const saved: SavedScene = JSON.parse(text);
        const titles: TitleElement[] = [];
        for (const st of saved.titles) {
          const img = await dataUrlToImg(st.dataUrl);
          titles.push({
            id: st.id,
            name: st.name,
            text: st.text,
            textNodes: st.textNodes,
            img,
            x: st.x,
            y: st.y,
            w: st.w,
            h: st.h,
            motionStyle: st.motionStyle ?? DEFAULT_TITLE_MOTION,
            clipSide: st.clipSide ?? 'left',
          });
        }
        const maxId = titles.length > 0
          ? Math.max(...titles.map((t) => parseInt(t.id.replace('el_', '')) || 0))
          : 0;
        idCounter = Math.max(idCounter, maxId);
        const allPatternIds = get().patternDefs.map((d) => d.id);
        const seed = saved.seed ?? randomSeed();
        set({
          sceneName: saved.sceneName ?? 'scene',
          seed,
          titles,
          patterns: (saved.patterns ?? []).map((p) => ({
            ...p,
            motionStyle: p.motionStyle ?? DEFAULT_ELEMENT_MOTION,
            clipSide: p.clipSide ?? 'left',
          })),
          squares: (saved.squares ?? []).map((sq) => ({
            ...sq,
            motionStyle: sq.motionStyle ?? DEFAULT_ELEMENT_MOTION,
            clipSide: sq.clipSide ?? 'left',
          })),
          dots: saved.dots ?? [],
          letters: (saved.letters ?? []).map((letter) => ({
            ...letter,
            motionStyle: letter.motionStyle ?? DEFAULT_ELEMENT_MOTION,
            clipSide: letter.clipSide ?? 'left',
          })),
          durationMs: saved.durationMs ?? 6000,
          easing: saved.easing ?? 'easeOutCubic',
          density: saved.density ?? 10,
          proximity: saved.proximity ?? 2,
          stagger: saved.stagger ?? 3,
          theme: saved.theme ?? 'dark',
          generationMode: saved.generationMode ?? 'marks',
          enabledColors: saved.enabledColors ?? [...FIXED_COLORS],
          customColors: saved.customColors ?? [...DEFAULT_CUSTOM_COLORS],
          enabledPatterns: new Set(
            saved.enabledPatterns !== undefined ? saved.enabledPatterns : allPatternIds,
          ),
          selectedElement: null,
        });
        if (typeof document !== 'undefined') {
          document.documentElement.dataset.theme = saved.theme ?? 'dark';
        }

        const noPlacement =
          (saved.patterns?.length ?? 0) === 0 &&
          (saved.squares?.length ?? 0) === 0 &&
          (saved.dots?.length ?? 0) === 0 &&
          (saved.letters?.length ?? 0) === 0;
        if (noPlacement && titles.length > 0) {
          get().generate(seed);
        }
      } catch (e) {
        console.error('Load failed:', e);
      }
    };
    input.click();
  },

  selectElement(kind, id) {
    set({ selectedElement: { scope: 'element', kind, id } });
  },

  selectLayer(kind) {
    set({ selectedElement: { scope: 'layer', kind } });
  },

  clearSelection() {
    set({ selectedElement: null });
  },

  setSelectedMotionStyle(style) {
    set((s) => {
      const selected = s.selectedElement;
      if (!selected) return {};
      if (selected.scope === 'layer') {
        if (selected.kind === 'title') {
          return { titles: s.titles.map((t) => ({ ...t, motionStyle: style })) };
        }
        if (selected.kind === 'pattern') {
          return { patterns: s.patterns.map((p) => ({ ...p, motionStyle: style })) };
        }
        if (selected.kind === 'square') {
          return { squares: s.squares.map((sq) => ({ ...sq, motionStyle: style })) };
        }
        if (selected.kind === 'letter') {
          return { letters: s.letters.map((letter) => ({ ...letter, motionStyle: style })) };
        }
        return {};
      }
      if (selected.kind === 'title') {
        return {
          titles: s.titles.map((t) => (
            t.id === selected.id ? { ...t, motionStyle: style } : t
          )),
        };
      }
      if (selected.kind === 'pattern') {
        return {
          patterns: s.patterns.map((p) => (
            p.id === selected.id ? { ...p, motionStyle: style } : p
          )),
        };
      }
      if (selected.kind === 'square') {
        return {
          squares: s.squares.map((sq) => (
            sq.id === selected.id ? { ...sq, motionStyle: style } : sq
          )),
        };
      }
      if (selected.kind === 'letter') {
        return {
          letters: s.letters.map((letter) => (
            letter.id === selected.id ? { ...letter, motionStyle: style } : letter
          )),
        };
      }
      return {};
    });
  },

  setSelectedClipSide(side) {
    set((s) => {
      const selected = s.selectedElement;
      if (!selected) return {};
      if (selected.scope === 'layer') {
        if (selected.kind === 'title') {
          return { titles: s.titles.map((t) => ({ ...t, clipSide: side })) };
        }
        if (selected.kind === 'pattern') {
          return { patterns: s.patterns.map((p) => ({ ...p, clipSide: side })) };
        }
        if (selected.kind === 'square') {
          return { squares: s.squares.map((sq) => ({ ...sq, clipSide: side })) };
        }
        if (selected.kind === 'letter') {
          return { letters: s.letters.map((letter) => ({ ...letter, clipSide: side })) };
        }
        return {};
      }
      if (selected.kind === 'title') {
        return {
          titles: s.titles.map((t) => (
            t.id === selected.id ? { ...t, clipSide: side } : t
          )),
        };
      }
      if (selected.kind === 'pattern') {
        return {
          patterns: s.patterns.map((p) => (
            p.id === selected.id ? { ...p, clipSide: side } : p
          )),
        };
      }
      if (selected.kind === 'square') {
        return {
          squares: s.squares.map((sq) => (
            sq.id === selected.id ? { ...sq, clipSide: side } : sq
          )),
        };
      }
      if (selected.kind === 'letter') {
        return {
          letters: s.letters.map((letter) => (
            letter.id === selected.id ? { ...letter, clipSide: side } : letter
          )),
        };
      }
      return {};
    });
  },

  randomizeSelectedMotion() {
    set((s) => {
      const selected = s.selectedElement;
      if (!selected) return {};

      if (selected.scope === 'layer') {
        if (selected.kind === 'title') {
          return { titles: s.titles.map(randomElementMotion) };
        }
        if (selected.kind === 'pattern') {
          return { patterns: s.patterns.map(randomElementMotion) };
        }
        if (selected.kind === 'square') {
          return { squares: s.squares.map(randomElementMotion) };
        }
        if (selected.kind === 'letter') {
          return { letters: s.letters.map(randomElementMotion) };
        }
        return { dots: s.dots.map(randomDotMotion) };
      }

      if (selected.kind === 'title') {
        return {
          titles: s.titles.map((t) => (
            t.id === selected.id ? randomElementMotion(t) : t
          )),
        };
      }
      if (selected.kind === 'pattern') {
        return {
          patterns: s.patterns.map((p) => (
            p.id === selected.id ? randomElementMotion(p) : p
          )),
        };
      }
      if (selected.kind === 'square') {
        return {
          squares: s.squares.map((sq) => (
            sq.id === selected.id ? randomElementMotion(sq) : sq
          )),
        };
      }
      if (selected.kind === 'letter') {
        return {
          letters: s.letters.map((letter) => (
            letter.id === selected.id ? randomElementMotion(letter) : letter
          )),
        };
      }
      return {
        dots: s.dots.map((dot) => (
          dot.id === selected.id ? randomDotMotion(dot) : dot
        )),
      };
    });
  },
}));

const e2eEnabled =
  (import.meta as unknown as { env?: { VITE_E2E?: string } }).env?.VITE_E2E === '1';

if (e2eEnabled && typeof window !== 'undefined') {
  (window as typeof window & { __PATTERNGEN_STORE__?: typeof useStore }).__PATTERNGEN_STORE__ = useStore;
}
