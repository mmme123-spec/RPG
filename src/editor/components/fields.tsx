/** Small form controls used throughout the editor. */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AudioRef, CharacterRef, FaceRef } from '../../core/types';
import { BUILTIN_BGM, BUILTIN_BGS, BUILTIN_CHARACTERS, BUILTIN_FACES, BUILTIN_ME, BUILTIN_SE, ICON_COLUMNS, ICON_SIZE, BUILTIN_ICONS } from '../../core/builtins';
import { useEditor } from '../store/store';
import { getImages } from './images';

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={`field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return <div className="row">{children}</div>;
}

export function TextInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function TextArea({ value, onChange, rows = 4 }: { value: string; onChange: (v: string) => void; rows?: number }) {
  return <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} />;
}

export function NumberInput({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.max(min ?? -Infinity, Math.min(max ?? Infinity, n)));
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

export function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

export function Select<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <select
      value={String(value)}
      onChange={(e) => {
        const o = options.find(([v]) => String(v) === e.target.value);
        if (o) onChange(o[0]);
      }}
    >
      {options.map(([v, l]) => (
        <option key={String(v)} value={String(v)}>
          {l}
        </option>
      ))}
    </select>
  );
}

/** Pick a database entry by id. */
export function IdSelect({ value, list, onChange, none }: { value: number; list: { id: number; name: string }[]; onChange: (v: number) => void; none?: string }) {
  const opts: [number, string][] = list.map((e) => [e.id, `${String(e.id).padStart(3, '0')}: ${e.name}`]);
  if (none !== undefined) opts.unshift([0, none]);
  return <Select value={value} options={opts} onChange={onChange} />;
}

/** Switch / variable pickers using the project's names. */
export function SwitchSelect({ value, onChange, variables }: { value: number; onChange: (v: number) => void; variables?: boolean }) {
  const sys = useEditor((s) => s.project!.system);
  const names = variables ? sys.variables : sys.switches;
  return <IdSelect value={value} onChange={onChange} list={names.map((n, i) => ({ id: i + 1, name: n || '(unnamed)' }))} />;
}

function drawToCanvas(canvas: HTMLCanvasElement | null, draw: (ctx: CanvasRenderingContext2D) => void, deps: unknown[]) {
  void deps;
  if (!canvas) return;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  draw(ctx);
}

export function CharacterPreview({ value, size = 48, direction = 2 }: { value: CharacterRef | { sheet: string; index: number } | null; size?: number; direction?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tick = useEditor((s) => s.project?.assets.length);
  useEffect(() => {
    drawToCanvas(
      ref.current,
      (ctx) => {
        if (!value?.sheet) return;
        const f = getImages().character(value);
        if (!f) return;
        const s = Math.min(size / f.fw, (size * 1.5) / f.fh);
        ctx.drawImage(f.image, f.sx + f.fw, f.sy + (direction / 2 - 1) * f.fh, f.fw, f.fh, (size - f.fw * s) / 2, size * 1.5 - f.fh * s, f.fw * s, f.fh * s);
      },
      [value, tick],
    );
  });
  return <canvas ref={ref} width={size} height={size * 1.5} className="pixel" />;
}

export function FacePreview({ value, size = 64 }: { value: FaceRef | null; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    drawToCanvas(
      ref.current,
      (ctx) => {
        if (!value) return;
        const f = getImages().face(value);
        if (f) ctx.drawImage(f.image, f.sx, f.sy, f.fw, f.fh, 0, 0, size, size);
      },
      [value],
    );
  });
  return <canvas ref={ref} width={size} height={size} className="pixel" />;
}

export function IconView({ index, size = 24 }: { index: number; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    drawToCanvas(
      ref.current,
      (ctx) => {
        const img = getImages().get('icons', 'builtin:icons');
        if (img && index > 0) ctx.drawImage(img, (index % ICON_COLUMNS) * ICON_SIZE, Math.floor(index / ICON_COLUMNS) * ICON_SIZE, ICON_SIZE, ICON_SIZE, 0, 0, size, size);
      },
      [index],
    );
  });
  return <canvas ref={ref} width={size} height={size} className="pixel icon" />;
}

export function IconPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="picker">
      <button type="button" className="iconbtn" onClick={() => setOpen(!open)} title={BUILTIN_ICONS[value]}>
        <IconView index={value} /> {BUILTIN_ICONS[value] ?? value}
      </button>
      {open && (
        <div className="popover icon-grid">
          {BUILTIN_ICONS.map((name, i) => (
            <button
              type="button"
              key={i}
              title={name}
              className={i === value ? 'sel' : ''}
              onClick={() => {
                onChange(i);
                setOpen(false);
              }}
            >
              <IconView index={i} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Builtin + uploaded character sheets. */
export function CharacterPicker({ value, onChange, allowNone }: { value: CharacterRef | null; onChange: (v: CharacterRef | null) => void; allowNone?: boolean }) {
  const assets = useEditor((s) => s.project!.assets.filter((a) => a.kind === 'character'));
  const [open, setOpen] = useState(false);
  const options: { ref: CharacterRef; label: string }[] = [
    ...BUILTIN_CHARACTERS.map((c) => ({ ref: { sheet: `builtin:${c.key}`, index: 0 }, label: c.label })),
    ...assets.flatMap((a) => (a.layout === 'multi' ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ ref: { sheet: `asset:${a.id}`, index: i }, label: `${a.name} #${i + 1}` })) : [{ ref: { sheet: `asset:${a.id}`, index: 0 }, label: a.name }])),
  ];
  return (
    <div className="picker">
      <button type="button" className="charbtn" onClick={() => setOpen(!open)}>
        <CharacterPreview value={value} size={32} />
        <span>{value ? (options.find((o) => o.ref.sheet === value.sheet && o.ref.index === value.index)?.label ?? value.sheet) : '(none)'}</span>
      </button>
      {open && (
        <div className="popover char-grid">
          {allowNone && (
            <button type="button" onClick={() => (onChange(null), setOpen(false))}>
              (none)
            </button>
          )}
          {options.map((o) => (
            <button type="button" key={`${o.ref.sheet}#${o.ref.index}`} title={o.label} onClick={() => (onChange(o.ref), setOpen(false))}>
              <CharacterPreview value={o.ref} size={32} />
              <small>{o.label}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FacePicker({ value, onChange }: { value: FaceRef | null; onChange: (v: FaceRef | null) => void }) {
  const assets = useEditor((s) => s.project!.assets.filter((a) => a.kind === 'face'));
  const [open, setOpen] = useState(false);
  const options: FaceRef[] = [
    ...BUILTIN_FACES.flatMap((f) => [0, 1, 2, 3].map((i) => ({ sheet: `builtin:${f.key}`, index: i }))),
    ...assets.flatMap((a) => (a.layout === 'multi' ? [0, 1, 2, 3, 4, 5, 6, 7] : [0]).map((i) => ({ sheet: `asset:${a.id}`, index: i }))),
  ];
  return (
    <div className="picker">
      <button type="button" className="charbtn" onClick={() => setOpen(!open)}>
        {value ? <FacePreview value={value} size={40} /> : <span className="noface">no face</span>}
      </button>
      {open && (
        <div className="popover face-grid">
          <button type="button" onClick={() => (onChange(null), setOpen(false))}>
            (none)
          </button>
          {options.map((f) => (
            <button type="button" key={`${f.sheet}#${f.index}`} onClick={() => (onChange(f), setOpen(false))}>
              <FacePreview value={f} size={48} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

let previewAudio: import('../../audio/engine').AudioEngine | null = null;
async function previewSound(ref: AudioRef, kind: 'bgm' | 'se') {
  const { AudioEngine } = await import('../../audio/engine');
  if (!previewAudio) previewAudio = new AudioEngine(useEditor.getState().project?.assets ?? []);
  previewAudio.setAssets(useEditor.getState().project?.assets ?? []);
  previewAudio.unlock();
  if (kind === 'se') previewAudio.playSe(ref);
  else {
    previewAudio.stopAll();
    previewAudio.playBgm(ref);
    window.setTimeout(() => previewAudio?.fadeOutBgm(1), 6000);
  }
}

export function stopPreview() {
  previewAudio?.stopAll();
}

export function AudioPicker({ value, onChange, kind, allowNone = true }: { value: AudioRef | null; onChange: (v: AudioRef | null) => void; kind: 'bgm' | 'bgs' | 'me' | 'se'; allowNone?: boolean }) {
  const assets = useEditor((s) => s.project!.assets.filter((a) => a.kind === 'audio'));
  const builtins = kind === 'bgm' ? BUILTIN_BGM : kind === 'bgs' ? BUILTIN_BGS : kind === 'me' ? BUILTIN_ME : BUILTIN_SE;
  const opts: [string, string][] = [...builtins.map((b): [string, string] => [`builtin:${b.key}`, b.label]), ...assets.map((a): [string, string] => [`asset:${a.id}`, `📁 ${a.name}`])];
  if (allowNone) opts.unshift(['', '(none)']);
  const v = value ?? { name: '', volume: 90, pitch: 100 };
  return (
    <div className="audio-picker">
      <Select value={v.name} options={opts} onChange={(name) => onChange(name ? { ...v, name } : null)} />
      {value && (
        <>
          <input type="range" min={0} max={100} value={v.volume} title={`Volume ${v.volume}`} onChange={(e) => onChange({ ...v, volume: Number(e.target.value) })} />
          <button type="button" title="Preview" onClick={() => void previewSound(v, kind === 'se' ? 'se' : 'bgm')}>
            ▶
          </button>
        </>
      )}
    </div>
  );
}

export function Modal({ title, onClose, children, wide, footer }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  const backRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // only the top-most modal closes
      const all = document.querySelectorAll('.modal-back');
      if (all[all.length - 1] === backRef.current) onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div ref={backRef} className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal${wide ? ' wide' : ''}`}>
        <header>
          <h2>{title}</h2>
          <button type="button" className="close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
}
