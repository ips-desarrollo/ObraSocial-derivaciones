import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

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
  onEliminar?: (op: OpcionGuia) => Promise<boolean>; // borra (baja lógica) una opción
  disabled?: boolean;
  className?: string;
}

const NUEVO_IDX = -2; // índice virtual de la opción "+ Agregar nuevo…"

export default function SelectConCarga({ label, value, opciones, onChange, onCrear, onEliminar, disabled, className }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState<number>(-1); // índice resaltado; NUEVO_IDX = agregar nuevo
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmando, setConfirmando] = useState<OpcionGuia | null>(null); // opción a borrar
  const [borrando, setBorrando] = useState(false);
  const [errorBorrar, setErrorBorrar] = useState('');

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const opcionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const typeahead = useRef<{ txt: string; t: number }>({ txt: '', t: 0 });

  const seleccionada = useMemo(
    () => opciones.find((o) => String(o.id) === value) || null,
    [opciones, value],
  );

  const cerrar = useCallback(() => {
    setAbierto(false);
    setActivo(-1);
  }, []);

  const abrir = useCallback(() => {
    if (disabled) return;
    const idx = opciones.findIndex((o) => String(o.id) === value);
    setActivo(idx);
    setAbierto(true);
  }, [disabled, opciones, value]);

  // Cerrar al clickear afuera
  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) cerrar();
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto, cerrar]);

  // Mantener la opción activa a la vista
  useEffect(() => {
    if (abierto && activo >= 0) {
      opcionRefs.current[activo]?.scrollIntoView({ block: 'nearest' });
    }
  }, [abierto, activo]);

  function seleccionar(idx: number) {
    if (idx === NUEVO_IDX) {
      setNuevo('');
      setError('');
      setCreando(true);
      setAbierto(false);
      return;
    }
    const op = opciones[idx];
    if (op) onChange(String(op.id));
    cerrar();
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!abierto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        abrir();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActivo((a) => (a === NUEVO_IDX ? NUEVO_IDX : a + 1 >= opciones.length ? NUEVO_IDX : a + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActivo((a) => (a === NUEVO_IDX ? opciones.length - 1 : a <= 0 ? 0 : a - 1));
        break;
      case 'Home':
        e.preventDefault();
        setActivo(0);
        break;
      case 'End':
        e.preventDefault();
        setActivo(NUEVO_IDX);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        seleccionar(activo);
        break;
      case 'Escape':
        e.preventDefault();
        cerrar();
        triggerRef.current?.focus();
        break;
      case 'Tab':
        cerrar();
        break;
      default:
        // typeahead: escribir para saltar a una opción
        if (e.key.length === 1 && /\S/.test(e.key)) {
          const ahora = Date.now();
          typeahead.current.txt = ahora - typeahead.current.t > 700 ? e.key : typeahead.current.txt + e.key;
          typeahead.current.t = ahora;
          const q = typeahead.current.txt.toLowerCase();
          const i = opciones.findIndex((o) => o.nombre.toLowerCase().startsWith(q));
          if (i >= 0) setActivo(i);
        }
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

  function cancelarCreacion() {
    setCreando(false);
    setNuevo('');
    setError('');
  }

  function pedirBorrado(op: OpcionGuia) {
    setErrorBorrar('');
    setConfirmando(op);
    cerrar();
  }

  function cancelarBorrado() {
    setConfirmando(null);
    setErrorBorrar('');
    setBorrando(false);
  }

  async function confirmarBorrado() {
    if (!confirmando || !onEliminar) return;
    setBorrando(true);
    setErrorBorrar('');
    try {
      const ok = await onEliminar(confirmando);
      if (ok) {
        cancelarBorrado();
      } else {
        setErrorBorrar('No se pudo borrar');
        setBorrando(false);
      }
    } catch {
      setErrorBorrar('No se pudo borrar');
      setBorrando(false);
    }
  }

  return (
    <div className={`dv-form-field${className ? ` ${className}` : ''}`}>
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
                if (e.key === 'Escape') cancelarCreacion();
              }}
              disabled={guardando}
            />
            <button type="button" className="dv-btn dv-btn--primary dv-btn--sm" onClick={confirmar} disabled={guardando}>
              {guardando ? '...' : 'Agregar'}
            </button>
            <button type="button" className="dv-btn dv-btn--outline dv-btn--sm" onClick={cancelarCreacion} disabled={guardando} title="Cancelar">
              ✕
            </button>
          </div>
          {error && <span className="dv-form-error">{error}</span>}
        </>
      ) : (
        <div className="dv-cbx" ref={wrapRef}>
          <button
            type="button"
            ref={triggerRef}
            className={`dv-cbx-trigger${abierto ? ' dv-cbx-trigger--open' : ''}`}
            onClick={() => (abierto ? cerrar() : abrir())}
            onKeyDown={onTriggerKeyDown}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={abierto}
          >
            <span className={seleccionada ? 'dv-cbx-valor' : 'dv-cbx-placeholder'}>
              {seleccionada ? seleccionada.nombre : '— Seleccionar —'}
            </span>
            <span className="dv-cbx-caret" aria-hidden="true">▾</span>
          </button>

          {abierto && (
            <ul className="dv-cbx-panel" role="listbox" tabIndex={-1}>
              {opciones.length === 0 && (
                <li className="dv-cbx-vacio">Sin opciones cargadas</li>
              )}
              {opciones.map((o, i) => {
                const sel = String(o.id) === value;
                return (
                  <li
                    key={o.id}
                    ref={(el) => { opcionRefs.current[i] = el; }}
                    role="option"
                    aria-selected={sel}
                    className={`dv-cbx-option${i === activo ? ' dv-cbx-option--activa' : ''}${sel ? ' dv-cbx-option--sel' : ''}`}
                    onMouseEnter={() => setActivo(i)}
                    onMouseDown={(e) => { e.preventDefault(); seleccionar(i); }}
                  >
                    <span className="dv-cbx-option-txt">{o.nombre}</span>
                    {sel && <span className="dv-cbx-check" aria-hidden="true">✓</span>}
                    {onEliminar && !disabled && (
                      <button
                        type="button"
                        className="dv-cbx-borrar"
                        title={`Borrar ${o.nombre}`}
                        aria-label={`Borrar ${o.nombre}`}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pedirBorrado(o); }}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                );
              })}
              {!disabled && (
                <li
                  role="option"
                  aria-selected={false}
                  className={`dv-cbx-option dv-cbx-option--nuevo${activo === NUEVO_IDX ? ' dv-cbx-option--activa' : ''}`}
                  onMouseEnter={() => setActivo(NUEVO_IDX)}
                  onMouseDown={(e) => { e.preventDefault(); seleccionar(NUEVO_IDX); }}
                >
                  + Agregar nuevo…
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {confirmando && (
        <div className="dv-modal-overlay" onMouseDown={(e) => e.stopPropagation()} onClick={cancelarBorrado}>
          <div className="dv-modal dv-modal--sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="dv-modal-title">Borrar opción</h2>
            <p className="dv-confirm-text">
              ¿Estás seguro de que querés borrar{' '}
              <span className="dv-confirm-name">{confirmando.nombre}</span> de {label.toLowerCase()}?
              <br />
              Dejará de aparecer en la lista, pero las derivaciones que ya la usan no se modifican.
            </p>
            {errorBorrar && <p className="dv-form-error">{errorBorrar}</p>}
            <div className="dv-modal-btns">
              <button type="button" className="dv-btn dv-btn--outline" onClick={cancelarBorrado} disabled={borrando}>
                Cancelar
              </button>
              <button type="button" className="dv-btn dv-btn--danger" onClick={confirmarBorrado} disabled={borrando}>
                {borrando ? 'Borrando...' : 'Borrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
