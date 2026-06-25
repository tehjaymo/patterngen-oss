import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenePath = path.join(__dirname, 'fixtures', 'basic-scene.json');

type MotionStyle =
  | 'center-wipe'
  | 'wipe'
  | 'dissolve'
  | 'scale'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right';
type ClipSide = 'top' | 'bottom' | 'left' | 'right';

interface AppSnapshot {
  sceneName: string;
  titles: Array<{
    id: string;
    text?: string;
    textNodes?: Array<{ text: string }>;
    motionStyle: MotionStyle;
    clipSide: ClipSide;
  }>;
  squares: Array<{ id: string; motionStyle: MotionStyle; clipSide: ClipSide }>;
  dots: Array<{ id: string; blinkPhase: number; blinkSpeed: number }>;
  selectedElement: null | { scope: 'element' | 'layer'; kind: string; id?: string };
  theme: 'dark' | 'light';
  showGrid: boolean;
}

declare global {
  interface Window {
    __PATTERNGEN_STORE__?: {
      getState: () => {
        sceneName: string;
        titles: AppSnapshot['titles'];
        squares: AppSnapshot['squares'];
        dots: AppSnapshot['dots'];
        selectedElement: AppSnapshot['selectedElement'];
        theme: AppSnapshot['theme'];
        showGrid: boolean;
      };
    };
  }
}

async function appState(page: Page): Promise<AppSnapshot> {
  return page.evaluate(() => {
    const store = window.__PATTERNGEN_STORE__;
    if (!store) throw new Error('PatternGen e2e store hook is not available.');
    const state = store.getState();
    return {
      sceneName: state.sceneName,
      titles: state.titles.map((title) => ({
        id: title.id,
        text: title.text,
        textNodes: title.textNodes,
        motionStyle: title.motionStyle,
        clipSide: title.clipSide,
      })),
      squares: state.squares.map((square) => ({
        id: square.id,
        motionStyle: square.motionStyle,
        clipSide: square.clipSide,
      })),
      dots: state.dots.map((dot) => ({
        id: dot.id,
        blinkPhase: dot.blinkPhase,
        blinkSpeed: dot.blinkSpeed,
      })),
      selectedElement: state.selectedElement,
      theme: state.theme,
      showGrid: state.showGrid,
    };
  });
}

async function loadBasicScene(page: Page): Promise<AppSnapshot> {
  await page.goto('/');
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByTestId('load-button').click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(scenePath);

  await expect.poll(async () => (await appState(page)).titles.length).toBe(1);
  await expect.poll(async () => (await appState(page)).squares.length).toBeGreaterThan(0);
  await expect.poll(async () => (await appState(page)).dots.length).toBeGreaterThan(0);
  return appState(page);
}

test('boots to the editor shell', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('PATTERNGEN')).toBeVisible();
  await expect(page.getByTestId('pattern-canvas')).toBeVisible();
  await expect(page.getByTestId('load-button')).toBeVisible();
  await expect(page.getByTestId('generate-button')).toBeVisible();
  await expect(page.getByText('COLORS')).toBeVisible();
  await expect(page.getByText('PROXIMITY')).toBeVisible();
});

test('loads a scene and generates selectable layer groups', async ({ page }) => {
  const state = await loadBasicScene(page);

  expect(state.sceneName).toBe('e2e_scene');
  expect(state.titles[0].text).toBe('E2E');
  expect(state.titles[0].textNodes?.[0].text).toBe('E2E');
  await expect(page.getByTestId('metadata-box')).toContainText('E2E');
  await expect(page.getByTestId('layer-group-title')).toContainText('1');
  await expect(page.getByTestId('layer-group-square')).toContainText(String(state.squares.length));
  await expect(page.getByTestId('layer-group-dot')).toContainText(String(state.dots.length));
  await expect(page.getByTestId(`layer-row-title-${state.titles[0].id}`)).toBeVisible();
  await expect(page.getByTestId(`layer-row-square-${state.squares[0].id}`)).toBeVisible();
});

test('selects individual rows and whole layer groups', async ({ page }) => {
  const state = await loadBasicScene(page);

  await page.getByTestId('layer-group-square').click();
  await expect.poll(async () => (await appState(page)).selectedElement).toEqual({
    scope: 'layer',
    kind: 'square',
  });

  await page.getByTestId(`layer-row-square-${state.squares[0].id}`).click();
  await expect.poll(async () => (await appState(page)).selectedElement).toEqual({
    scope: 'element',
    kind: 'square',
    id: state.squares[0].id,
  });

  await page.getByTestId('layer-group-dot').click();
  await expect.poll(async () => (await appState(page)).selectedElement).toEqual({
    scope: 'layer',
    kind: 'dot',
  });
});

test('applies motion style and direction to every selected square', async ({ page }) => {
  await loadBasicScene(page);

  await page.getByTestId('layer-group-square').click();
  await page.getByTestId('motion-style-dissolve').click();
  await page.getByTestId('motion-direction-top').click();

  const state = await appState(page);
  expect(state.squares.length).toBeGreaterThan(1);
  expect(state.squares.every((square) => square.motionStyle === 'dissolve')).toBe(true);
  expect(state.squares.every((square) => square.clipSide === 'top')).toBe(true);
});

test('randomizes square reveals and dot pulse settings independently', async ({ page }) => {
  await loadBasicScene(page);

  await page.getByTestId('layer-group-square').click();
  await page.getByTestId('motion-style-dissolve').click();
  await page.getByTestId('motion-direction-top').click();
  await page.evaluate(() => {
    const values = [0, 0, 0.2, 0.25, 0.4, 0.5, 0.7, 0.75, 0.9, 0.99];
    let index = 0;
    Math.random = () => values[index++ % values.length];
  });
  await page.getByTestId('motion-random-button').click();

  const randomizedSquares = (await appState(page)).squares;
  expect(new Set(randomizedSquares.map((square) => square.motionStyle)).size).toBeGreaterThan(1);
  expect(new Set(randomizedSquares.map((square) => square.clipSide)).size).toBeGreaterThan(1);

  const beforeDots = (await appState(page)).dots;
  await page.getByTestId('layer-group-dot').click();
  await page.getByTestId('motion-random-button').click();
  const afterDots = (await appState(page)).dots;

  expect(afterDots).toHaveLength(beforeDots.length);
  expect(afterDots.some((dot, index) => dot.blinkPhase !== beforeDots[index].blinkPhase)).toBe(true);
  expect(afterDots.some((dot, index) => dot.blinkSpeed !== beforeDots[index].blinkSpeed)).toBe(true);
});

test('keeps the right sidebar scrollable when layer controls are present', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await loadBasicScene(page);

  const metrics = await page.getByTestId('sidebar').evaluate((sidebar) => ({
    clientHeight: sidebar.clientHeight,
    scrollHeight: sidebar.scrollHeight,
    overflowY: getComputedStyle(sidebar).overflowY,
  }));

  expect(metrics.overflowY).toBe('auto');
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);
});

test('saves title motion settings in scene JSON', async ({ page }) => {
  await loadBasicScene(page);

  await page.getByTestId('layer-group-title').click();
  await page.getByTestId('motion-style-scale').click();
  await page.getByTestId('motion-direction-bottom').click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('save-button').click();
  const download = await downloadPromise;
  const contents = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of contents) chunks.push(Buffer.from(chunk));
  const scene = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
    sceneName: string;
    titles: Array<{
      text?: string;
      textNodes?: Array<{ text: string }>;
      motionStyle: MotionStyle;
      clipSide: ClipSide;
    }>;
  };

  expect(download.suggestedFilename()).toBe('e2e_scene_patterngen.json');
  expect(scene.sceneName).toBe('e2e_scene');
  expect(scene.titles).toHaveLength(1);
  expect(scene.titles[0].text).toBe('E2E');
  expect(scene.titles[0].textNodes?.[0].text).toBe('E2E');
  expect(scene.titles[0].motionStyle).toBe('scale');
  expect(scene.titles[0].clipSide).toBe('bottom');
});
