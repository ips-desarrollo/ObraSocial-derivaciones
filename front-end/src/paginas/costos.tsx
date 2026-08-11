import { useState, useEffect, useCallback, useMemo } from 'react';
import NavBar from './NavBar';
import logoSiglas from '../multimedia/logo-siglas.svg';
import { fetchAuth, verificarSesion, API } from '../auth';
import { Derivacion, formatMes, formatMonto } from './FormularioDerivacion';
import './globales.css';
import './costos.css';
import './derivaciones.css';

/* ────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────── */

function mesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function generarOpcionesMeses(mesSeleccionado: string): string[] {
  const opciones: string[] = [];
  const hoy = new Date();
  for (let i = 11; i >= -1; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    opciones.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  if (!opciones.includes(mesSeleccionado)) {
    opciones.push(mesSeleccionado);
    opciones.sort();
  }
  return opciones;
}

/* ── Agrupamiento genérico ── */

interface GrupoResumen {
  nombre: string;
  cantidad: number;
  monto: number;
}

/**
 * Agrupa derivaciones por un campo de texto y suma el monto correspondiente.
 * Devuelve las categorías ordenadas por cantidad (desc).
 */
function agrupar(
  derivaciones: Derivacion[],
  campoClave: keyof Derivacion,
  campoMonto: keyof Derivacion,
): GrupoResumen[] {
  const map = new Map<string, { cantidad: number; monto: number }>();

  for (const d of derivaciones) {
    const nombre = (d[campoClave] as string) || 'Sin especificar';
    const monto = (d[campoMonto] as number) ?? 0;
    const entry = map.get(nombre) || { cantidad: 0, monto: 0 };
    entry.cantidad += 1;
    entry.monto += monto;
    map.set(nombre, entry);
  }

  return Array.from(map.entries())
    .map(([nombre, data]) => ({ nombre, ...data }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

/* ── Componente de sección (una de las 3 columnas del resumen) ── */

function SeccionResumen({
  titulo,
  grupos,
  totalDerivaciones,
  colorClase,
}: {
  titulo: string;
  grupos: GrupoResumen[];
  totalDerivaciones: number;
  colorClase: string;
}) {
  const totalMonto = grupos.reduce((s, g) => s + g.monto, 0);
  const gruposConMonto = grupos.filter((g) => g.monto > 0);

  return (
    <div className={`cr-section ${colorClase}`}>
      <h3 className="cr-section-title">{titulo}</h3>

      <table className="cr-section-table">
        <tbody>
          {/* ── Cantidades ── */}
          {grupos.map((g) => (
            <tr key={g.nombre}>
              <td className="cr-cell-name">{g.nombre}</td>
              <td className="cr-cell-qty">{g.cantidad}</td>
            </tr>
          ))}
          <tr className="cr-row-total">
            <td className="cr-cell-name cr-cell-bold">Total</td>
            <td className="cr-cell-qty cr-cell-bold">{totalDerivaciones}</td>
          </tr>

          {/* ── Separador ── */}
          <tr className="cr-row-sep">
            <td colSpan={2}></td>
          </tr>

          {/* ── Montos ── */}
          {gruposConMonto.length > 0 ? (
            gruposConMonto.map((g) => (
              <tr key={`$${g.nombre}`}>
                <td className="cr-cell-name">{g.nombre}</td>
                <td className="cr-cell-monto">{formatMonto(g.monto)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="cr-cell-name cr-cell-empty" colSpan={2}>
                Sin montos cargados
              </td>
            </tr>
          )}
          <tr className="cr-row-total">
            <td className="cr-cell-name cr-cell-bold">Total</td>
            <td className="cr-cell-monto cr-cell-bold">{formatMonto(totalMonto)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Componente principal
 * ──────────────────────────────────────────────────────────────── */

export default function Costos() {
  const [derivaciones, setDerivaciones] = useState<Derivacion[]>([]);
  const [mesSeleccionado, setMesSeleccionado] = useState(mesActual());
  const [loading, setLoading] = useState(true);

  const cargarDerivaciones = useCallback(async () => {
    if (!verificarSesion()) return;
    setLoading(true);
    try {
      const res = await fetchAuth(`${API}/derivaciones?mes=${mesSeleccionado}`);
      if (!res.ok) throw new Error('Error al cargar derivaciones');
      setDerivaciones(await res.json());
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [mesSeleccionado]);

  useEffect(() => {
    cargarDerivaciones();
  }, [cargarDerivaciones]);

  /* ── Agrupamientos ── */
  const gruposPrestacion = useMemo(
    () => agrupar(derivaciones, 'cobertura_prestacion', 'monto_prestacion'),
    [derivaciones],
  );
  const gruposTraslado = useMemo(
    () => agrupar(derivaciones, 'tipo_traslado', 'monto_traslado'),
    [derivaciones],
  );
  const gruposAlojamiento = useMemo(
    () => agrupar(derivaciones, 'lugar_alojamiento', 'monto_alojamiento'),
    [derivaciones],
  );

  /* ── Totales generales ── */
  const totalPrestacion = derivaciones.reduce((s, d) => s + (d.monto_prestacion ?? 0), 0);
  const totalTraslado = derivaciones.reduce((s, d) => s + (d.monto_traslado ?? 0), 0);
  const totalAlojamiento = derivaciones.reduce((s, d) => s + (d.monto_alojamiento ?? 0), 0);
  const totalGeneral = totalPrestacion + totalTraslado + totalAlojamiento;

  return (
    <>
      <NavBar />
      <div className="dv-page">
        {/* Toolbar */}
        <div className="dv-toolbar">
          <select
            className="dv-mes-select"
            value={mesSeleccionado}
            onChange={(e) => setMesSeleccionado(e.target.value)}
          >
            {generarOpcionesMeses(mesSeleccionado).map((m) => (
              <option key={m} value={m}>{formatMes(m)}</option>
            ))}
          </select>
          <div className="dv-toolbar-spacer" />
          <h1 className="dv-toolbar-title">Control de Costos</h1>
          <div className="dv-toolbar-spacer" />
          <span className="dv-toolbar-mes">{formatMes(mesSeleccionado)}</span>
        </div>

        {/* Panel principal — Resumen */}
        <div className="dv-panel">
          <div className="dv-header">
            <img src={logoSiglas} alt="IPS" className="dv-header-logo" />
            <h1 className="dv-header-title">
              Resumen Derivaciones {formatMes(mesSeleccionado).toUpperCase()}
            </h1>
            <span className="dv-header-count">
              {derivaciones.length} derivación{derivaciones.length !== 1 ? 'es' : ''}
            </span>
          </div>

          {loading ? (
            <p className="dv-empty">Cargando derivaciones...</p>
          ) : derivaciones.length === 0 ? (
            <p className="dv-empty">No hay derivaciones para {formatMes(mesSeleccionado)}</p>
          ) : (
            <>
              {/* 3 columnas de resumen */}
              <div className="cr-grid">
                <SeccionResumen
                  titulo="Prestaciones médicas"
                  grupos={gruposPrestacion}
                  totalDerivaciones={derivaciones.length}
                  colorClase="cr-section--prestacion"
                />
                <SeccionResumen
                  titulo="Traslado"
                  grupos={gruposTraslado}
                  totalDerivaciones={derivaciones.length}
                  colorClase="cr-section--traslado"
                />
                <SeccionResumen
                  titulo="Alojamiento"
                  grupos={gruposAlojamiento}
                  totalDerivaciones={derivaciones.length}
                  colorClase="cr-section--alojamiento"
                />
              </div>

              {/* Fila de totales generales */}
              <div className="cr-totales">
                <div className="cr-total-item">
                  <span className="cr-total-label">Total Prestaciones</span>
                  <span className="cr-total-value">{formatMonto(totalPrestacion)}</span>
                </div>
                <span className="cr-total-plus">+</span>
                <div className="cr-total-item">
                  <span className="cr-total-label">Total Traslado</span>
                  <span className="cr-total-value">{formatMonto(totalTraslado)}</span>
                </div>
                <span className="cr-total-plus">+</span>
                <div className="cr-total-item">
                  <span className="cr-total-label">Total Alojamiento</span>
                  <span className="cr-total-value">{formatMonto(totalAlojamiento)}</span>
                </div>
                <span className="cr-total-eq">=</span>
                <div className="cr-total-item cr-total-item--final">
                  <span className="cr-total-label">TOTAL GENERAL</span>
                  <span className="cr-total-value cr-total-value--final">
                    {formatMonto(totalGeneral)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
