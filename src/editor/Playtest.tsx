/** Play-test window: runs the current project in the engine with a debug panel. */

import { useEffect, useRef, useState } from 'react';
import { Game } from '../engine';
import { useEditor } from './store/store';

export function Playtest({ fromHere, onClose }: { fromHere?: { mapId: number; x: number; y: number }; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [debug, setDebug] = useState(false);
  const [, setTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const project = structuredClone(useEditor.getState().project!);
    let disposed = false;
    let frames = 0;
    Game.create({
      container: ref.current!,
      project,
      isTest: true,
      startAt: fromHere,
      skipTitle: !!fromHere,
      saveNamespace: `test:${project.id}`,
      touchControls: 'auto',
      onFrame: () => {
        if (++frames % 15 === 0) setTick((n) => n + 1);
      },
    })
      .then((g) => {
        if (disposed) g.destroy();
        else gameRef.current = g;
      })
      .catch((e) => setError(String(e?.stack ?? e)));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F9') {
        e.preventDefault();
        setDebug((d) => !d);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      disposed = true;
      window.removeEventListener('keydown', onKey);
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, [fromHere]);

  const g = gameRef.current;
  const sys = useEditor.getState().project!.system;
  return (
    <div className="playtest-back">
      <div className="playtest">
        <div className="playtest-bar">
          <b>▶ Playtest</b>
          <span className="hint">WASD move · mouse aim · click attack · right-click skill · Shift roll · Space/Enter talk · Esc menu · Ctrl walk through walls · F9 debug</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => setDebug((d) => !d)}>{debug ? 'Hide debug' : 'Debug'}</button>
          <button className="primary" onClick={onClose}>
            ✕ Stop
          </button>
        </div>
        <div className="playtest-body">
          <div ref={ref} className="playtest-screen" />
          {debug && g && (
            <div className="debug-panel">
              <div>
                Map {g.map.mapId} · ({g.map.player.x}, {g.map.player.y}) · {sys.currency} {g.state.gold}
              </div>
              <div className="debug-row">
                <button onClick={() => (g.state.gold += 1000)}>+1000 gold</button>
                <button onClick={() => g.state.members().forEach((a) => a.recoverAll())}>Heal party</button>
              </div>
              <h4>Switches</h4>
              <div className="debug-list">
                {sys.switches.map((n, i) => (
                  <label key={i}>
                    <input type="checkbox" checked={g.state.getSwitch(i + 1)} onChange={(e) => g.state.setSwitch(i + 1, e.target.checked)} />
                    {String(i + 1).padStart(4, '0')} {n}
                  </label>
                ))}
              </div>
              <h4>Variables</h4>
              <div className="debug-list">
                {sys.variables.map((n, i) => (
                  <label key={i}>
                    <input type="number" value={g.state.getVariable(i + 1)} onChange={(e) => g.state.setVariable(i + 1, Number(e.target.value))} />
                    {String(i + 1).padStart(4, '0')} {n}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        {error && <pre className="error">{error}</pre>}
      </div>
    </div>
  );
}
