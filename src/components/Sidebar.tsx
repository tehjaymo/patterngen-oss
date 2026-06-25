import React from 'react';
import { useStore } from '../store';
import { FIXED_COLORS, type ClipSide, type MotionStyle, type SelectableElementKind, type SelectableLayerKind } from '../types';
import { PatternTile } from './PatternTile';

const PATTERN_GAP = 20;
const PATTERN_SIZE = 40;
const PATTERN_COLS = 4;
const CONTENT_W = PATTERN_COLS * PATTERN_SIZE + (PATTERN_COLS - 1) * PATTERN_GAP;

const MOTION_OPTIONS: Array<{ value: MotionStyle; label: string }> = [
  { value: 'center-wipe', label: 'CENTER' },
  { value: 'wipe', label: 'WIPE' },
  { value: 'dissolve', label: 'DISSOLVE' },
  { value: 'scale', label: 'SCALE' },
  { value: 'slide-up', label: 'UP' },
  { value: 'slide-down', label: 'DOWN' },
  { value: 'slide-left', label: 'LEFT' },
  { value: 'slide-right', label: 'RIGHT' },
];

const CLIP_OPTIONS: Array<{ value: ClipSide; label: string }> = [
  { value: 'left', label: 'LEFT' },
  { value: 'right', label: 'RIGHT' },
  { value: 'top', label: 'TOP' },
  { value: 'bottom', label: 'BOTTOM' },
];

export const Sidebar: React.FC = () => {
  const {
    patternDefs, patternDefsMap, enabledPatterns, togglePattern, selectAllPatterns, deselectAllPatterns,
    enabledColors, toggleColor,
    customColors, setCustomColor, addCustomColor, removeCustomColor,
    density, setDensity,
    proximity, setProximity,
    stagger, setStagger,
    showGrid, setShowGrid,
    theme, setTheme,
    titles, patterns, squares, dots,
    selectedElement, selectElement, selectLayer,
    setSelectedMotionStyle, setSelectedClipSide, randomizeSelectedMotion,
  } = useStore();

  const allSelected = patternDefs.length > 0 && patternDefs.every((d) => enabledPatterns.has(d.id));
  const layerGroups = [
    { kind: 'title' as SelectableLayerKind, label: 'TITLES', detail: `${titles.length}` },
    { kind: 'pattern' as SelectableLayerKind, label: 'PATTERNS', detail: `${patterns.length}` },
    { kind: 'square' as SelectableLayerKind, label: 'SQUARES', detail: `${squares.length}` },
    { kind: 'dot' as SelectableLayerKind, label: 'DOTS', detail: `${dots.length}` },
  ].filter((group) => Number(group.detail) > 0);
  const layers = [
    ...titles.map((t, i) => ({
      kind: 'title' as SelectableElementKind,
      id: t.id,
      label: `TITLE ${i + 1}`,
      detail: `${Math.round(t.w)}x${Math.round(t.h)}`,
      motionStyle: t.motionStyle,
      clipSide: t.clipSide,
    })),
    ...patterns.map((p, i) => ({
      kind: 'pattern' as SelectableElementKind,
      id: p.id,
      label: `PATTERN ${i + 1}`,
      detail: patternDefsMap.get(p.patternId)?.name ?? p.patternId,
      motionStyle: p.motionStyle,
      clipSide: p.clipSide,
    })),
    ...squares.map((sq, i) => ({
      kind: 'square' as SelectableElementKind,
      id: sq.id,
      label: `SQUARE ${i + 1}`,
      detail: `${sq.size}px`,
      motionStyle: sq.motionStyle,
      clipSide: sq.clipSide,
    })),
    ...dots.map((dot, i) => ({
      kind: 'dot' as SelectableElementKind,
      id: dot.id,
      label: `DOT ${i + 1}`,
      detail: `${Math.round(dot.x)},${Math.round(dot.y)}`,
      motionStyle: undefined,
      clipSide: undefined,
    })),
  ];
  const selectedMotion = getSelectedMotion(selectedElement, layers);

  return (
    <aside data-testid="sidebar" style={styles.sidebar}>
      {(layerGroups.length > 0 || layers.length > 0) && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>LAYERS</div>
          {layerGroups.length > 0 && (
            <div style={{ ...styles.layerGroupGrid, width: CONTENT_W }}>
              {layerGroups.map((group) => {
                const selected = selectedElement?.scope === 'layer' && selectedElement.kind === group.kind;
                return (
                  <button
                    data-testid={`layer-group-${group.kind}`}
                    key={group.kind}
                    onClick={() => selectLayer(group.kind)}
                    style={{ ...styles.layerGroupBtn, ...(selected ? styles.layerGroupBtnSelected : {}) }}
                  >
                    <span>{group.label}</span>
                    <span style={styles.layerGroupCount}>{group.detail}</span>
                  </button>
                );
              })}
            </div>
          )}
          <div style={{ ...styles.layerList, width: CONTENT_W }}>
            {layers.map((layer) => {
              const selected =
                selectedElement?.scope === 'element' &&
                selectedElement.kind === layer.kind &&
                selectedElement.id === layer.id;
              return (
                <button
                  data-testid={`layer-row-${layer.kind}-${layer.id}`}
                  key={`${layer.kind}:${layer.id}`}
                  onClick={() => selectElement(layer.kind, layer.id)}
                  style={{ ...styles.layerRow, ...(selected ? styles.layerRowSelected : {}) }}
                >
                  <span>{layer.label}</span>
                  <span style={styles.layerDetail}>{layer.detail}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedElement && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>MOTION</div>
          <button data-testid="motion-random-button" onClick={randomizeSelectedMotion} style={{ ...styles.randomBtn, width: CONTENT_W }}>
            RANDOM
          </button>
          {selectedMotion && (
            <>
              <div style={{ ...styles.motionGrid, width: CONTENT_W }}>
                {MOTION_OPTIONS.map((option) => (
                  <button
                    data-testid={`motion-style-${option.value}`}
                    key={option.value}
                    onClick={() => setSelectedMotionStyle(option.value)}
                    style={{
                      ...styles.motionBtn,
                      ...(selectedMotion.motionStyle === option.value ? styles.motionBtnActive : {}),
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div style={{ ...styles.directionGrid, width: CONTENT_W }}>
                {CLIP_OPTIONS.map((option) => (
                  <button
                    data-testid={`motion-direction-${option.value}`}
                    key={option.value}
                    onClick={() => setSelectedClipSide(option.value)}
                    style={{
                      ...styles.directionBtn,
                      ...(selectedMotion.clipSide === option.value ? styles.motionBtnActive : {}),
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.sectionTitle}>COLORS</div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {FIXED_COLORS.map((c) => (
            <div
              key={c}
              onClick={() => toggleColor(c)}
              style={{
                ...styles.colorSwatch,
                background: c,
                border: `2px solid ${c === '#000000' ? '#444' : '#ccc'}`,
              }}
            >
              <SelectedDot visible={enabledColors.includes(c)} inverted={c === '#FFFFFF'} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {customColors.map((c, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                type="color"
                value={c}
                onChange={(e) => setCustomColor(i, e.target.value)}
                style={styles.colorPicker}
              />
              <div
                onClick={() => toggleColor(c)}
                style={{ ...styles.colorSwatch, background: c, width: 40, height: 40 }}
              >
                <SelectedDot visible={enabledColors.includes(c)} />
              </div>
              <button
                onClick={() => removeCustomColor(i)}
                style={styles.removeBtn}
                title="Remove color"
              >
                ×
              </button>
            </div>
          ))}
          {customColors.length < 3 && (
            <button onClick={addCustomColor} style={styles.addColorBtn}>
              + ADD COLOR
            </button>
          )}
        </div>
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          DENSITY <span style={styles.valueNum}>{density}</span>
        </div>
        <BarSlider value={density} max={20} onChange={setDensity} width={CONTENT_W} />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          PROXIMITY <span style={styles.valueNum}>{proximity}</span>
        </div>
        <BarSlider value={proximity} max={20} onChange={setProximity} width={CONTENT_W} />
      </div>

      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          STAGGER <span style={styles.valueNum}>{stagger}</span>
        </div>
        <BarSlider value={stagger} max={5} min={0} onChange={setStagger} width={CONTENT_W} />
      </div>

      <div style={styles.section}>
        <div
          style={{ ...styles.sectionTitle, cursor: 'pointer', marginBottom: 0 }}
          onClick={() => setShowGrid(!showGrid)}
        >
          GRID <span style={styles.valueNum}>{showGrid ? 'ON' : 'OFF'}</span>
        </div>
      </div>

      <div style={styles.section}>
        <div
          style={{ ...styles.sectionTitle, cursor: 'pointer', marginBottom: 0 }}
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          THEME <span style={styles.valueNum}>{theme === 'dark' ? 'DARK' : 'LIGHT'}</span>
        </div>
      </div>

      {patternDefs.length > 0 && (
        <div style={styles.section}>
          <div
            style={{ ...styles.sectionTitle, cursor: 'pointer' }}
            onClick={() => { allSelected ? deselectAllPatterns() : selectAllPatterns(); }}
          >
            {allSelected ? 'DESELECT ALL' : 'SELECT ALL'}
          </div>
          <div style={{ ...styles.patternGrid, width: CONTENT_W }}>
            {patternDefs.map((def) => (
              <PatternTile
                key={def.id}
                def={def}
                enabled={enabledPatterns.has(def.id)}
                onToggle={() => togglePattern(def.id)}
              />
            ))}
          </div>
        </div>
      )}
    </aside>
  );
};

interface LayerRow {
  kind: SelectableElementKind;
  id: string;
  label: string;
  detail: string;
  motionStyle?: MotionStyle;
  clipSide?: ClipSide;
}

function getSelectedMotion(
  selected: ReturnType<typeof useStore.getState>['selectedElement'],
  layers: LayerRow[],
): { motionStyle?: MotionStyle; clipSide?: ClipSide } | null {
  if (!selected || selected.kind === 'dot') return null;

  const selectedRows = selected.scope === 'layer'
    ? layers.filter((layer) => layer.kind === selected.kind)
    : layers.filter((layer) => layer.kind === selected.kind && layer.id === selected.id);

  if (selectedRows.length === 0) return null;

  const firstMotion = selectedRows[0].motionStyle;
  const firstClip = selectedRows[0].clipSide;
  return {
    motionStyle: selectedRows.every((row) => row.motionStyle === firstMotion) ? firstMotion : undefined,
    clipSide: selectedRows.every((row) => row.clipSide === firstClip) ? firstClip : undefined,
  };
}

const SelectedDot: React.FC<{ visible: boolean; inverted?: boolean }> = ({ visible, inverted }) => (
  <div
    style={{
      ...styles.selectedDot,
      background: inverted ? '#ccc' : 'var(--swatch-dot)',
      transform: visible ? 'scale(1)' : 'scale(0)',
      opacity: visible ? 1 : 0,
      transition:
        'transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease-out',
    }}
  />
);

const BarSlider: React.FC<{ value: number; max: number; min?: number; onChange: (v: number) => void; width: number }> = ({ value, max, min = 1, onChange, width }) => {
  const steps = [];
  for (let v = min === 0 ? 1 : min; v <= max; v++) steps.push(v);
  return (
    <div style={{ display: 'flex', gap: 3, cursor: 'pointer', width }}>
      {steps.map((v) => (
        <div
          key={v}
          className="bar-step"
          onClick={() => onChange(v)}
          style={{ flex: 1, height: 16, borderRadius: 2, background: v <= value ? 'var(--bar-filled)' : 'var(--bar-empty)' }}
        />
      ))}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'fit-content',
    maxHeight: '100%',
    flexShrink: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 30,
    alignSelf: 'stretch',
    paddingRight: 4,
  },
  section: {
    width: 'fit-content',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--fg-strong)',
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    marginBottom: 12,
  },
  valueNum: {
    color: 'var(--muted-2)',
    opacity: 0.5,
  },
  colorSwatch: {
    width: 60,
    height: 60,
    borderRadius: 4,
    cursor: 'pointer',
    position: 'relative' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDot: {
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: 'var(--swatch-dot)',
  },
  colorPicker: {
    width: 40,
    height: 40,
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    borderRadius: 4,
    background: 'transparent',
  },
  removeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--muted)',
    fontSize: 20,
    cursor: 'pointer',
    padding: '0 4px',
    fontFamily: 'inherit',
  },
  addColorBtn: {
    background: 'none',
    border: '1px dashed var(--muted-3)',
    borderRadius: 4,
    color: 'var(--muted)',
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    padding: '8px 12px',
    fontFamily: 'inherit',
  },
  patternGrid: {
    display: 'grid',
    gridTemplateColumns: `repeat(${PATTERN_COLS}, ${PATTERN_SIZE}px)`,
    gap: PATTERN_GAP,
  },
  layerGroupGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 6,
    marginBottom: 10,
  },
  layerGroupBtn: {
    border: '1px solid var(--muted-3)',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 6,
    fontFamily: 'inherit',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.04em',
    padding: '7px 6px',
  },
  layerGroupBtnSelected: {
    borderColor: 'var(--fg-strong)',
    color: 'var(--fg-strong)',
  },
  layerGroupCount: {
    color: 'var(--muted)',
    fontWeight: 700,
  },
  layerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 168,
    overflowY: 'auto',
  },
  layerRow: {
    width: '100%',
    border: 'none',
    borderBottom: '1px solid var(--muted-3)',
    background: 'transparent',
    color: 'var(--fg)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    gap: 8,
    padding: '6px 0',
    fontFamily: 'inherit',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textAlign: 'left' as const,
  },
  layerRowSelected: {
    color: 'var(--fg-strong)',
    borderBottomColor: 'var(--fg-strong)',
  },
  layerDetail: {
    color: 'var(--muted)',
    fontWeight: 600,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  motionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 6,
    marginBottom: 8,
  },
  directionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 4,
  },
  motionBtn: {
    border: '1px solid var(--muted-3)',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.04em',
    padding: '7px 4px',
  },
  randomBtn: {
    border: '1px solid var(--fg-strong)',
    borderRadius: 4,
    background: 'var(--fg-strong)',
    color: 'var(--bg)',
    cursor: 'pointer',
    display: 'block',
    fontFamily: 'inherit',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: '0.06em',
    marginBottom: 8,
    padding: '8px 6px',
  },
  directionBtn: {
    border: '1px solid var(--muted-3)',
    borderRadius: 4,
    background: 'transparent',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '0.03em',
    padding: '6px 2px',
  },
  motionBtnActive: {
    borderColor: 'var(--fg-strong)',
    color: 'var(--fg-strong)',
  },
};
