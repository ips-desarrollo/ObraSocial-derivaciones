import { useState, useRef, useEffect, useCallback } from 'react';

/* ────────────────────────────────────────────────────────────────
 * Campo de autocompletado asíncrono + popup con lista completa.
 *
 * Inline: busca en el servidor por texto y trae sólo un puñado de
 * coincidencias (TOP N) — no baja miles de opciones (eso traba todo).
 *
 * Popup ("Ver todas" / "Cambiar"): permite buscar por nombre o recorrer
 * TODA la lista dividida en bloques (páginas) navegables con flechitas.
 *
 * Es genérico: el consumidor decide cómo buscar/listar y cómo mostrar
 * cada item mediante las funciones `buscar`, `listar`, `getTexto`, etc.
 * ──────────────────────────────────────────────────────────────── */

export interface PaginaLista<T> {
  items: T[];
  total: number;
  pages: number;
}

interface Props<T> {
  label: string;
  value: string;                                    // texto actualmente elegido ('' = ninguno)
  buscar: (q: string) => Promise<T[]>;              // búsqueda rápida inline (TOP N)
  listar?: (q: string, page: number) => Promise<PaginaLista<T>>; // lista paginada (popup)
  getKey: (item: T) => string;                      // key única de React
  getTexto: (item: T) => string;                    // texto principal (lo que queda seleccionado)
  getDetalle?: (item: T) => string;                 // texto secundario (código, etc.)
  onSelect: (item: T) => void;
  onLimpiar?: () => void;                           // borrar la selección
  placeholder?: string;
  disabled?: boolean;
  minChars?: number;                                // mínimo de caracteres para buscar inline (def. 2)
  className?: string;
}

export default function BuscadorAsync<T>({
  label,
  value,
  buscar,
  listar,
  getKey,
  getTexto,
  getDetalle,
  onSelect,
  onLimpiar,
  placeholder,
  disabled,
  minChars = 2,
  className,
}: Props<T>) {
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(false);
  const [resultados, setResultados] = useState<T[]>([]);
  const [cargando, setCargando] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [buscoAlgo, setBuscoAlgo] = useState(false);
  const [modal, setModal] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | undefined>(undefined);
  const pedidoRef = useRef(0); // descarta respuestas viejas (fuera de orden)

  const cerrar = useCallback(() => {
    setAbierto(false);
    setActivo(-1);
  }, []);

  // Cerrar dropdown al clickear afuera
  useEffect(() => {
    if (!abierto) return;
    function onClickFuera(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) cerrar();
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, [abierto, cerrar]);

  const lanzarBusqueda = useCallback(
    (q: string) => {
      window.clearTimeout(debounceRef.current);
      const query = q.trim();
      if (query.length < minChars) {
        setResultados([]);
        setCargando(false);
        setBuscoAlgo(false);
        return;
      }
      setCargando(true);
      setBuscoAlgo(true);
      debounceRef.current = window.setTimeout(async () => {
        const id = ++pedidoRef.current;
        try {
          const data = await buscar(query);
          if (id !== pedidoRef.current) return; // llegó una respuesta más nueva
          setResultados(Array.isArray(data) ? data : []);
          setActivo(-1);
        } catch {
          if (id === pedidoRef.current) setResultados([]);
        } finally {
          if (id === pedidoRef.current) setCargando(false);
        }
      }, 300);
    },
    [buscar, minChars],
  );

  function onChangeInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setTexto(v);
    setAbierto(true);
    lanzarBusqueda(v);
  }

  function elegir(item: T) {
    onSelect(item);
    setTexto('');
    setResultados([]);
    setBuscoAlgo(false);
    cerrar();
    setModal(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!abierto) return;
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActivo((a) => (a + 1 >= resultados.length ? 0 : a + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActivo((a) => (a <= 0 ? resultados.length - 1 : a - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activo >= 0 && resultados[activo]) elegir(resultados[activo]);
        break;
      case 'Escape':
        e.preventDefault();
        cerrar();
        break;
    }
  }

  return (
    <div className={`dv-form-field${className ? ` ${className}` : ''}`}>
      <label className="dv-form-label">{label}</label>

      {/* Valor ya elegido: se muestra como "chip" con opción de cambiar */}
      {value ? (
        <div className="dv-bus-elegido">
          <span className="dv-bus-elegido-txt" title={value}>{value}</span>
          {!disabled && (
            <button
              type="button"
              className="dv-bus-cambiar"
              onClick={() => setModal(true)}
              title="Cambiar"
            >
              Cambiar
            </button>
          )}
        </div>
      ) : (
        <div className="dv-bus-wrap" ref={wrapRef}>
          <div className="dv-bus-inputrow">
            <input
              className="dv-form-input"
              value={texto}
              disabled={disabled}
              placeholder={placeholder || `Buscar ${label.toLowerCase()}...`}
              onChange={onChangeInput}
              onFocus={() => setAbierto(true)}
              onKeyDown={onKeyDown}
              autoComplete="off"
            />
            {listar && !disabled && (
              <button
                type="button"
                className="dv-bus-verlista"
                onClick={() => setModal(true)}
                title="Ver lista completa"
              >
                Ver todas
              </button>
            )}
          </div>

          {abierto && (
            <ul className="dv-bus-panel" role="listbox">
              {cargando && <li className="dv-bus-info">Buscando...</li>}
              {!cargando && texto.trim().length < minChars && (
                <li className="dv-bus-info">Escribí al menos {minChars} letras…</li>
              )}
              {!cargando && buscoAlgo && texto.trim().length >= minChars && resultados.length === 0 && (
                <li className="dv-bus-info">Sin resultados</li>
              )}
              {!cargando && resultados.map((item, i) => (
                <li
                  key={getKey(item)}
                  role="option"
                  aria-selected={i === activo}
                  className={`dv-bus-item${i === activo ? ' dv-bus-item--activa' : ''}`}
                  onMouseEnter={() => setActivo(i)}
                  onMouseDown={(e) => { e.preventDefault(); elegir(item); }}
                >
                  <span className="dv-bus-item-txt">{getTexto(item)}</span>
                  {getDetalle && <span className="dv-bus-item-det">{getDetalle(item)}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {modal && listar && (
        <ModalLista<T>
          label={label}
          listar={listar}
          getKey={getKey}
          getTexto={getTexto}
          getDetalle={getDetalle}
          valorActual={value}
          onElegir={elegir}
          onCerrar={() => setModal(false)}
        />
      )}
    </div>
  );
}

/* ── Popup: buscar por nombre + recorrer toda la lista por páginas ── */

interface ModalProps<T> {
  label: string;
  listar: (q: string, page: number) => Promise<PaginaLista<T>>;
  getKey: (item: T) => string;
  getTexto: (item: T) => string;
  getDetalle?: (item: T) => string;
  valorActual: string;
  onElegir: (item: T) => void;
  onCerrar: () => void;
}

function ModalLista<T>({ label, listar, getKey, getTexto, getDetalle, valorActual, onElegir, onCerrar }: ModalProps<T>) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [cargando, setCargando] = useState(false);

  const debounceRef = useRef<number | undefined>(undefined);
  const pedidoRef = useRef(0);

  const cargar = useCallback(
    async (query: string, p: number) => {
      setCargando(true);
      const id = ++pedidoRef.current;
      try {
        const data = await listar(query.trim(), p);
        if (id !== pedidoRef.current) return;
        setItems(Array.isArray(data.items) ? data.items : []);
        setTotal(data.total || 0);
        setPages(data.pages || 0);
      } catch {
        if (id === pedidoRef.current) { setItems([]); setTotal(0); setPages(0); }
      } finally {
        if (id === pedidoRef.current) setCargando(false);
      }
    },
    [listar],
  );

  // Al escribir: vuelve a página 1 (con debounce). Al cambiar de página: recarga.
  useEffect(() => {
    window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      cargar(q, page);
    }, q ? 300 : 0);
    return () => window.clearTimeout(debounceRef.current);
  }, [q, page, cargar]);

  function cambiarTexto(v: string) {
    setQ(v);
    setPage(1);
  }

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar();
      if (e.key === 'ArrowRight' && page < pages) setPage((p) => p + 1);
      if (e.key === 'ArrowLeft' && page > 1) setPage((p) => p - 1);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCerrar, page, pages]);

  return (
    <div className="dv-modal-overlay" onMouseDown={onCerrar}>
      <div className="dv-modal dv-modal--lista" onMouseDown={(e) => e.stopPropagation()}>
        <div className="dv-modal-head">
          <h2 className="dv-modal-title">Elegir {label.toLowerCase()}</h2>
          <button type="button" className="dv-modal-x" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </div>

        <input
          className="dv-form-input dv-modal-search"
          value={q}
          autoFocus
          placeholder={`Buscar ${label.toLowerCase()} por nombre... (o dejá vacío para ver todas)`}
          onChange={(e) => cambiarTexto(e.target.value)}
        />

        <ul className="dv-modal-lista">
          {cargando && <li className="dv-bus-info">Cargando...</li>}
          {!cargando && items.length === 0 && <li className="dv-bus-info">Sin resultados</li>}
          {!cargando && items.map((item) => {
            const sel = getTexto(item) === valorActual;
            return (
              <li
                key={getKey(item)}
                className={`dv-modal-item${sel ? ' dv-modal-item--sel' : ''}`}
                onClick={() => onElegir(item)}
              >
                <span className="dv-bus-item-txt">{getTexto(item)}</span>
                {getDetalle && <span className="dv-bus-item-det">{getDetalle(item)}</span>}
                {sel && <span className="dv-modal-check" aria-hidden="true">✓</span>}
              </li>
            );
          })}
        </ul>

        <div className="dv-modal-pager">
          <button
            type="button"
            className="dv-pager-btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || cargando}
            aria-label="Página anterior"
          >
            ◀
          </button>
          <span className="dv-pager-info">
            {total > 0 ? `Página ${page} de ${pages || 1} · ${total} en total` : '—'}
          </span>
          <button
            type="button"
            className="dv-pager-btn"
            onClick={() => setPage((p) => (pages ? Math.min(pages, p + 1) : p + 1))}
            disabled={page >= pages || cargando}
            aria-label="Página siguiente"
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
}
