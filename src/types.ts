export const CANVAS_W = 1920;
export const CANVAS_H = 1080;
export const GRID_SIZE = 20;
export const GRID_COLS = CANVAS_W / GRID_SIZE; // 96
export const GRID_ROWS = CANVAS_H / GRID_SIZE; // 54
export const EXPORT_SCALE = 4;
export const FPS = 30;
export const BG_COLOR = '#323232';

export const FIXED_COLORS = ['#000000', '#FFFFFF'] as const;

export const DEFAULT_CUSTOM_COLORS: string[] = [];

export type ClipSide = 'top' | 'bottom' | 'left' | 'right';

export type MotionStyle =
  | 'center-wipe'
  | 'wipe'
  | 'dissolve'
  | 'scale'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right';

export const DEFAULT_TITLE_MOTION: MotionStyle = 'center-wipe';
export const DEFAULT_ELEMENT_MOTION: MotionStyle = 'wipe';

export type SelectableElementKind = 'title' | 'pattern' | 'square' | 'dot' | 'letter';
export type SelectableLayerKind = SelectableElementKind;

export type GenerationMode = 'marks' | 'letters';

export interface SelectedSingleElement {
  scope: 'element';
  kind: SelectableElementKind;
  id: string;
}

export interface SelectedLayer {
  scope: 'layer';
  kind: SelectableLayerKind;
}

export type SelectedElement = SelectedSingleElement | SelectedLayer;

export interface ColorPair {
  bg: string;
  fg: string;
}

export type PatternAnimType =
  | 'dots'
  | 'capsule'
  | 'circle'
  | 'arrow'
  | 'square'
  | 'stripes'
  | 'cross';

export interface SvgShapeInfo {
  tag: 'rect' | 'circle' | 'path';
  x: number;
  y: number;
  w: number;
  h: number;
  rx: number;
  cx: number;
  cy: number;
  rotation: number;
  rotOriginX: number;
  rotOriginY: number;
  isStroked: boolean;
  strokeWidth: number;
  stagger: number;
}

export interface PatternDef {
  id: string;
  name: string;
  svgText: string;
  animType: PatternAnimType;
  shapes: SvgShapeInfo[];
}

export interface TitleTextNode {
  id: string;
  name: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TitleElement {
  id: string;
  name?: string;
  text?: string;
  textNodes?: TitleTextNode[];
  img: HTMLImageElement;
  x: number;
  y: number;
  w: number;
  h: number;
  motionStyle: MotionStyle;
  clipSide: ClipSide;
}

export interface PatternElement {
  id: string;
  patternId: string;
  x: number;
  y: number;
  colors: ColorPair;
  animDelay: number;
  clipSide: ClipSide;
  motionStyle: MotionStyle;
}

export interface SquareElement {
  id: string;
  x: number;
  y: number;
  size: number;
  color: string;
  clipSide: ClipSide;
  motionStyle: MotionStyle;
  animDelay: number;
}

export interface DotElement {
  id: string;
  x: number;
  y: number;
  color: string;
  clipSide: ClipSide;
  motionStyle: MotionStyle;
  animDelay: number;
  blinkPhase: number;
  blinkSpeed: number;
}

export interface LetterElement {
  id: string;
  char: string;
  x: number;
  y: number;
  size: number;
  color: string;
  clipSide: ClipSide;
  motionStyle: MotionStyle;
  animDelay: number;
}

export type ExportLayer = 'titles' | 'patterns' | 'dots';

export interface AnimationState {
  t: number;
  titleClips: Map<string, { x: number; y: number; w: number; h: number }>;
  titleProgress: Map<string, number>;
  patternProgress: Map<string, number>;
  squareClips: Map<string, { x: number; y: number; w: number; h: number }>;
  squareProgress: Map<string, number>;
  letterProgress: Map<string, number>;
  dotProgress: Map<string, number>;
  dotOpacities: Map<string, number>;
}
