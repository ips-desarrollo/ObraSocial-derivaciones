import { useState } from 'react';

export interface OpcionGuia {
  id: number;
  nombre: string;
}

interface Props {
  label: string;
  value: string;                                   // id seleccionado como string ('' = ninguno)
  opciones: OpcionGuia[];
  onChange: (value: string) => void;
  onCrear: (nombre: string) => Promise<OpcionGuia | null>;
  disabled?: boolean;
}

const NUEVO = '__nuevo__';

export default function SelectConCarga({ label, value, opciones, onChange, onCrear, disabled }: Props) {
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  function handleSelect(v: string) {
    if (v === NUEVO) {
      setNuevo('');
      setError('');
      setCreando(true);
    } else {
      onChange(v);
    }
  }

  async function confirmar() {
    const nombre = nuevo.trim();
    if (!nombre) {
      setError('Ingresá un nombre');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      const op = await onCrear(nombre);
      if (op) {
        onChange(String(op.id));
        setCreando(false);
        setNuevo('');
      } else {
        setError('No se pudo agregar');
      }
    } catch {
      setError('No se pudo agregar');
    } finally {
      setGuardando(false);
    }
  }

  function cancelar() {
    setCreando(false);
    setNuevo('');
    setError('');
  }

  return (
    <div className="dv-form-field">
      <label className="dv-form-label">{label}</label>
      {creando ? (
        <>
          <div className="dv-nuevo-row">
            <input
              className="dv-form-input"
              value={nuevo}
              autoFocus
              placeholder={`Nuevo ${label.toLowerCase()}...`}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); confirmar(); }
                if (e.key === 'Escape') cancelar();
              }}
              disabled={guardando}
            />
            <button type="button" className="dv-btn dv-btn--primary dv-btn--sm" onClick={confirmar} disabled={guardando}>
              {guardando ? '...' : 'Agregar'}
            </button>
            <button type="button" className="dv-btn dv-btn--outline dv-btn--sm" onClick={cancelar} disabled={guardando} title="Cancelar">
              ✕
            </button>
          </div>
          {error && <span className="dv-form-error">{error}</span>}
        </>
      ) : (
        <select
          className="dv-form-input"
          value={value}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={disabled}
        >
          <option value="">— Seleccionar —</option>
          {opciones.map((o) => (
            <option key={o.id} value={String(o.id)}>{o.nombre}</option>
          ))}
          {!disabled && <option value={NUEVO}>+ Agregar nuevo…</option>}
        </select>
      )}
    </div>
  );
}
