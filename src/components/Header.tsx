import React, { useCallback, useRef, useEffect } from 'react';
import { useStore } from '../store';
import { exportAll } from '../export/exporter';

export const Header: React.FC = () => {
  const {
    playing, setPlaying, elapsedMs, setElapsedMs,
    generate, durationMs, setDuration, easing, stagger, titles, patterns, squares, dots,
    patternDefsMap, exporting, setExporting, setExportProgress, exportProgress,
    saveSceneToFile, loadSceneFromFile,
    sceneName, setSceneName,
  } = useStore();

  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = performance.now() - elapsedMs;
    const tick = (now: number) => {
      const ms = now - startRef.current;
      setElapsedMs(ms);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, setElapsedMs]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportProgress(0);
    try {
      await exportAll({
        sceneName,
        durationMs,
        easing,
        stagger,
        titles,
        patterns,
        squares,
        dots,
        patternDefs: patternDefsMap,
        onProgress: (done, total) => setExportProgress(done / total),
      });
    } finally {
      setExporting(false);
    }
  }, [sceneName, durationMs, easing, stagger, titles, patterns, squares, dots, patternDefsMap, setExporting, setExportProgress]);

  return (
    <header style={styles.header}>
      <div style={styles.left}>
        <span style={styles.brand}>PATTERNGEN</span>
        <button data-testid="save-button" style={styles.linkBtn} onClick={saveSceneToFile}>SAVE</button>
        <button data-testid="load-button" style={styles.linkBtn} onClick={loadSceneFromFile}>LOAD</button>
        <button
          data-testid="export-button"
          style={{ ...styles.linkBtn, opacity: exporting ? 0.5 : 1 }}
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? `${(exportProgress * 100).toFixed(0)}%` : 'EXPORT'}
        </button>
      </div>

      <div style={styles.right}>
        <input
          data-testid="scene-name-input"
          type="text"
          className="auto-input"
          value={sceneName}
          onChange={(e) => setSceneName(e.target.value)}
          size={Math.max(5, sceneName.length)}
          placeholder="scene name"
        />
        <button data-testid="generate-button" style={styles.linkBtn} onClick={() => { generate(); }}>GENERATE</button>
        <input
          data-testid="duration-input"
          type="number"
          className="auto-input"
          min={100}
          max={20000}
          step={100}
          value={durationMs}
          size={Math.max(5, String(durationMs).length)}
          onChange={(e) => setDuration(parseInt(e.target.value) || 3000)}
        />
        <span style={styles.msLabel}>MS</span>
        <button
          data-testid="play-button"
          style={styles.linkBtn}
          onClick={() => {
            if (playing) setPlaying(false);
            else { setElapsedMs(0); setPlaying(true); }
          }}
        >
          {playing ? 'PAUSE' : 'PLAY'}
        </button>
      </div>
    </header>
  );
};

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 40,
    flexShrink: 0,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  brand: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--fg)',
    letterSpacing: '0.06em',
    lineHeight: 1,
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--btn)',
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '0.04em',
    textTransform: 'uppercase' as const,
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  },
  msLabel: {
    fontSize: 22,
    fontWeight: 600,
    color: 'var(--ms-label)',
  },
};
