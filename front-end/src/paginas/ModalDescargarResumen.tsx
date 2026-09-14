import { useState, useCallback, useMemo } from 'react';
import { fetchAuth, API } from '../auth';
import { Derivacion, formatMonto } from './FormularioDerivacion';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './ModalDescargarResumen.css';

/* ────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────── */

const MESES_NOMBRE = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/** "2026-07" → { year: 2026, month: 7 } */
function parseMes(mes: string) {
  const [y, m] = mes.split('-').map(Number);
  return { year: y, month: m };
}

/** { year: 2026, month: 7 } → "2026-07" */
function toMesStr(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** Genera lista de meses entre desde y hasta (inclusive) */
function mesesEntre(desde: string, hasta: string): string[] {
  const d = parseMes(desde);
  const h = parseMes(hasta);
  const result: string[] = [];
  let y = d.year, m = d.month;
  while (y < h.year || (y === h.year && m <= h.month)) {
    result.push(toMesStr(y, m));
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

/** Construye el título descriptivo del periodo */
function tituloDelPeriodo(tipo: TipoPeriodo, config: PeriodoConfig): string {
  if (tipo === 'mensual') {
    const { year, month } = parseMes(config.mes);
    return `Resumen Mensual — ${MESES_NOMBRE[month - 1]} ${year}`;
  }
  if (tipo === 'semestral') {
    const d = parseMes(config.desde);
    const h = parseMes(config.hasta);
    if (d.year === h.year) {
      return `Resumen Semestral — ${MESES_NOMBRE[d.month - 1]} a ${MESES_NOMBRE[h.month - 1]} de ${d.year}`;
    }
    return `Resumen Semestral — ${MESES_NOMBRE[d.month - 1]} ${d.year} a ${MESES_NOMBRE[h.month - 1]} ${h.year}`;
  }
  if (tipo === 'anual') {
    const d = parseMes(config.desde);
    const h = parseMes(config.hasta);
    if (d.month === 1 && h.month === 12 && d.year === h.year) {
      return `Resumen Anual — ${d.year}`;
    }
    if (d.year === h.year) {
      return `Resumen Anual — ${MESES_NOMBRE[d.month - 1]} a ${MESES_NOMBRE[h.month - 1]} de ${d.year}`;
    }
    return `Resumen Anual — ${MESES_NOMBRE[d.month - 1]} ${d.year} a ${MESES_NOMBRE[h.month - 1]} ${h.year}`;
  }
  // rango
  if (config.fechaDesde && config.fechaHasta) {
    const fd = new Date(config.fechaDesde + 'T12:00:00');
    const fh = new Date(config.fechaHasta + 'T12:00:00');
    const fmtFecha = (d: Date) => {
      return `${d.getDate()} de ${MESES_NOMBRE[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`;
    };
    return `Resumen — Del ${fmtFecha(fd)} al ${fmtFecha(fh)}`;
  }
  return 'Resumen de Derivaciones';
}

/** Nombre del archivo (sin extensión) */
function nombreArchivo(tipo: TipoPeriodo, config: PeriodoConfig): string {
  const base = 'Resumen_Costos';
  if (tipo === 'mensual') {
    const { year, month } = parseMes(config.mes);
    return `${base}_${MESES_NOMBRE[month - 1]}_${year}`;
  }
  if (tipo === 'semestral' || tipo === 'anual') {
    return `${base}_${config.desde}_a_${config.hasta}`;
  }
  return `${base}_${config.fechaDesde}_a_${config.fechaHasta}`;
}

/* ── Agrupamiento (replicado de costos.tsx para independencia) ── */

interface GrupoResumen {
  nombre: string;
  cantidad: number;
  monto: number;
}

function agrupar(derivaciones: Derivacion[], campoClave: keyof Derivacion, campoMonto: keyof Derivacion): GrupoResumen[] {
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

/* ────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────── */

type TipoPeriodo = 'mensual' | 'semestral' | 'anual' | 'rango';
type Formato = 'pdf' | 'excel';

interface PeriodoConfig {
  mes: string;       // para mensual
  desde: string;     // para semestral/anual
  hasta: string;     // para semestral/anual
  fechaDesde: string; // para rango (YYYY-MM-DD)
  fechaHasta: string; // para rango (YYYY-MM-DD)
}

/* ────────────────────────────────────────────────────────────────
 * Generación PDF
 * ──────────────────────────────────────────────────────────────── */

const IPS_BLUE = [68, 92, 164] as const;    // #445ca4
const IPS_DARK = [46, 64, 128] as const;    // #2e4080
const HEADER_BG = [240, 242, 247] as const; // --bg

function generarPDF(derivaciones: Derivacion[], titulo: string, filename: string) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();

  // ── Header
  doc.setFillColor(...IPS_DARK);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('IPS — Control de Costos', 14, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(titulo, 14, 19);
  doc.setFontSize(8);
  doc.text(`${derivaciones.length} derivación${derivaciones.length !== 1 ? 'es' : ''} · Generado: ${new Date().toLocaleDateString('es-AR')}`, 14, 24);

  let yPos = 36;

  // ── Secciones
  const secciones = [
    { titulo: 'Prestaciones Médicas', grupos: agrupar(derivaciones, 'cobertura_prestacion', 'monto_prestacion') },
    { titulo: 'Traslado', grupos: agrupar(derivaciones, 'tipo_traslado', 'monto_traslado') },
    { titulo: 'Alojamiento', grupos: agrupar(derivaciones, 'lugar_alojamiento', 'monto_alojamiento') },
  ];

  for (const seccion of secciones) {
    // Título de sección
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...IPS_BLUE);
    doc.text(seccion.titulo.toUpperCase(), 14, yPos);
    yPos += 2;

    const totalMonto = seccion.grupos.reduce((s, g) => s + g.monto, 0);
    const rows = seccion.grupos.map(g => [
      g.nombre,
      String(g.cantidad),
      formatMonto(g.monto),
    ]);
    rows.push(['Total', String(derivaciones.length), formatMonto(totalMonto)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Categoría', 'Cantidad', 'Monto']],
      body: rows,
      margin: { left: 14, right: 14 },
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        lineColor: [226, 230, 240],
        lineWidth: 0.25,
        textColor: [30, 42, 58],
      },
      headStyles: {
        fillColor: [...HEADER_BG],
        textColor: [...IPS_BLUE],
        fontStyle: 'bold',
        lineColor: [226, 230, 240],
      },
      bodyStyles: {
        fillColor: [255, 255, 255],
      },
      alternateRowStyles: {
        fillColor: [247, 248, 252],
      },
      // Última fila (total) en negrita
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === rows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [...HEADER_BG];
          data.cell.styles.textColor = [...IPS_DARK];
        }
      },
      columnStyles: {
        0: { cellWidth: 'auto' },
        1: { halign: 'right', cellWidth: 25 },
        2: { halign: 'right', cellWidth: 35 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Salto de página si queda poco espacio
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
  }

  // ── Totales generales
  const totalPrestacion = derivaciones.reduce((s, d) => s + (d.monto_prestacion ?? 0), 0);
  const totalTraslado = derivaciones.reduce((s, d) => s + (d.monto_traslado ?? 0), 0);
  const totalAlojamiento = derivaciones.reduce((s, d) => s + (d.monto_alojamiento ?? 0), 0);
  const totalGeneral = totalPrestacion + totalTraslado + totalAlojamiento;

  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }

  autoTable(doc, {
    startY: yPos,
    head: [['Concepto', 'Monto']],
    body: [
      ['Total Prestaciones', formatMonto(totalPrestacion)],
      ['Total Traslado', formatMonto(totalTraslado)],
      ['Total Alojamiento', formatMonto(totalAlojamiento)],
      ['TOTAL GENERAL', formatMonto(totalGeneral)],
    ],
    margin: { left: 14, right: 14 },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [226, 230, 240],
      lineWidth: 0.25,
      textColor: [30, 42, 58],
    },
    headStyles: {
      fillColor: [...IPS_DARK],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    bodyStyles: {
      fillColor: [255, 255, 255],
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 3) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [...IPS_DARK];
        data.cell.styles.textColor = [255, 255, 255];
      }
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'right', cellWidth: 45 },
    },
  });

  doc.save(`${filename}.pdf`);
}

/* ────────────────────────────────────────────────────────────────
 * Generación Excel
 * ──────────────────────────────────────────────────────────────── */

function generarExcel(derivaciones: Derivacion[], titulo: string, filename: string) {
  const wb = XLSX.utils.book_new();

  // ── Hoja Resumen
  const resumenData: (string | number)[][] = [];
  resumenData.push([titulo]);
  resumenData.push([`${derivaciones.length} derivación${derivaciones.length !== 1 ? 'es' : ''}`]);
  resumenData.push([`Generado: ${new Date().toLocaleDateString('es-AR')}`]);
  resumenData.push([]);

  const secciones = [
    { titulo: 'Prestaciones Médicas', grupos: agrupar(derivaciones, 'cobertura_prestacion', 'monto_prestacion') },
    { titulo: 'Traslado', grupos: agrupar(derivaciones, 'tipo_traslado', 'monto_traslado') },
    { titulo: 'Alojamiento', grupos: agrupar(derivaciones, 'lugar_alojamiento', 'monto_alojamiento') },
  ];

  for (const seccion of secciones) {
    resumenData.push([seccion.titulo.toUpperCase()]);
    resumenData.push(['Categoría', 'Cantidad', 'Monto']);
    const totalMonto = seccion.grupos.reduce((s, g) => s + g.monto, 0);
    for (const g of seccion.grupos) {
      resumenData.push([g.nombre, g.cantidad, g.monto]);
    }
    resumenData.push(['Total', derivaciones.length, totalMonto]);
    resumenData.push([]);
  }

  // Totales generales
  const totalPrestacion = derivaciones.reduce((s, d) => s + (d.monto_prestacion ?? 0), 0);
  const totalTraslado = derivaciones.reduce((s, d) => s + (d.monto_traslado ?? 0), 0);
  const totalAlojamiento = derivaciones.reduce((s, d) => s + (d.monto_alojamiento ?? 0), 0);
  const totalGeneral = totalPrestacion + totalTraslado + totalAlojamiento;

  resumenData.push(['TOTALES GENERALES']);
  resumenData.push(['Concepto', 'Monto']);
  resumenData.push(['Total Prestaciones', totalPrestacion]);
  resumenData.push(['Total Traslado', totalTraslado]);
  resumenData.push(['Total Alojamiento', totalAlojamiento]);
  resumenData.push(['TOTAL GENERAL', totalGeneral]);

  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);

  // Ancho de columnas
  wsResumen['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 18 }];

  // Formato numérico para columna de montos
  const range = XLSX.utils.decode_range(wsResumen['!ref'] || 'A1');
  for (let r = range.s.r; r <= range.e.r; r++) {
    const cell = wsResumen[XLSX.utils.encode_cell({ r, c: 2 })];
    if (cell && typeof cell.v === 'number') {
      cell.z = '#,##0.00';
    }
    // Columna B de totales generales
    const cellB = wsResumen[XLSX.utils.encode_cell({ r, c: 1 })];
    if (cellB && typeof cellB.v === 'number' && r >= resumenData.length - 5) {
      cellB.z = '#,##0.00';
    }
  }

  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // ── Hoja Detalle
  const detalleData: (string | number | null)[][] = [];
  detalleData.push([
    'Mes', 'Fecha', 'Disposición', 'Documento', 'Nombre', 'Diagnóstico',
    'Prestación', 'Monto Prestación', 'Traslado', 'Monto Traslado',
    'Alojamiento', 'Monto Alojamiento', 'Total',
  ]);

  for (const d of derivaciones) {
    const total = (d.monto_prestacion ?? 0) + (d.monto_traslado ?? 0) + (d.monto_alojamiento ?? 0);
    detalleData.push([
      d.mes,
      d.fecha,
      d.nro_disposicion,
      d.afiliado_documento,
      d.afiliado_nombre,
      d.diagnostico,
      d.cobertura_prestacion,
      d.monto_prestacion,
      d.tipo_traslado,
      d.monto_traslado,
      d.lugar_alojamiento,
      d.monto_alojamiento,
      total,
    ]);
  }

  const wsDetalle = XLSX.utils.aoa_to_sheet(detalleData);
  wsDetalle['!cols'] = [
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 25 }, { wch: 30 },
    { wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 16 },
    { wch: 22 }, { wch: 16 }, { wch: 16 },
  ];

  // Formato moneda para columnas de montos en detalle
  const rangeD = XLSX.utils.decode_range(wsDetalle['!ref'] || 'A1');
  const montoCols = [7, 9, 11, 12]; // H, J, L, M (0-indexed)
  for (let r = 1; r <= rangeD.e.r; r++) {
    for (const c of montoCols) {
      const cell = wsDetalle[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'number') {
        cell.z = '#,##0.00';
      }
    }
  }

  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/* ────────────────────────────────────────────────────────────────
 * Componente Modal
 * ──────────────────────────────────────────────────────────────── */

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  mesActual: string;
}

export default function ModalDescargarResumen({ abierto, onCerrar, mesActual }: Props) {
  const [tipoPeriodo, setTipoPeriodo] = useState<TipoPeriodo>('mensual');
  const [formato, setFormato] = useState<Formato>('pdf');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState('');

  const hoy = new Date();
  const mesHoy = toMesStr(hoy.getFullYear(), hoy.getMonth() + 1);

  const [config, setConfig] = useState<PeriodoConfig>({
    mes: mesActual,
    desde: toMesStr(hoy.getFullYear(), 1),
    hasta: mesHoy,
    fechaDesde: '',
    fechaHasta: '',
  });

  // Opciones de meses para selects
  const opcionesMeses = useMemo(() => {
    const opciones: { value: string; label: string }[] = [];
    for (let i = 24; i >= -1; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      const val = toMesStr(d.getFullYear(), d.getMonth() + 1);
      opciones.push({ value: val, label: `${MESES_NOMBRE[d.getMonth()]} ${d.getFullYear()}` });
    }
    return opciones;
  }, []);

  // Opciones de semestres
  const opcionesSemestres = useMemo(() => {
    const opciones: { desde: string; hasta: string; label: string }[] = [];
    const anioActual = hoy.getFullYear();
    for (let y = anioActual - 1; y <= anioActual + 1; y++) {
      opciones.push({
        desde: toMesStr(y, 1), hasta: toMesStr(y, 6),
        label: `1er semestre ${y} (Ene – Jun)`,
      });
      opciones.push({
        desde: toMesStr(y, 7), hasta: toMesStr(y, 12),
        label: `2do semestre ${y} (Jul – Dic)`,
      });
    }
    return opciones;
  }, []);

  // Opciones anuales
  const opcionesAnuales = useMemo(() => {
    const anioActual = hoy.getFullYear();
    const opciones: { desde: string; hasta: string; label: string }[] = [];
    for (let y = anioActual - 2; y <= anioActual; y++) {
      opciones.push({
        desde: toMesStr(y, 1), hasta: toMesStr(y, 12),
        label: `Año ${y} completo`,
      });
    }
    return opciones;
  }, []);

  /** Determina qué meses (YYYY-MM) cargar según la config */
  const mesesACargar = useCallback((): string[] => {
    if (tipoPeriodo === 'mensual') return [config.mes];
    if (tipoPeriodo === 'semestral' || tipoPeriodo === 'anual') {
      return mesesEntre(config.desde, config.hasta);
    }
    // Rango de fechas: cargar los meses que cubren
    if (!config.fechaDesde || !config.fechaHasta) return [];
    const fd = parseMes(config.fechaDesde.slice(0, 7));
    const fh = parseMes(config.fechaHasta.slice(0, 7));
    return mesesEntre(toMesStr(fd.year, fd.month), toMesStr(fh.year, fh.month));
  }, [tipoPeriodo, config]);

  /** Filtra derivaciones por rango de fecha exacta (solo para tipo "rango") */
  const filtrarPorRango = useCallback((derivaciones: Derivacion[]): Derivacion[] => {
    if (tipoPeriodo !== 'rango') return derivaciones;
    const desde = config.fechaDesde;
    const hasta = config.fechaHasta;
    return derivaciones.filter(d => {
      const fecha = d.fecha ?? d.mes + '-01';
      return fecha >= desde && fecha <= hasta;
    });
  }, [tipoPeriodo, config.fechaDesde, config.fechaHasta]);

  const handleGenerar = async () => {
    setError('');

    // Validaciones
    if (tipoPeriodo === 'rango') {
      if (!config.fechaDesde || !config.fechaHasta) {
        setError('Seleccioná ambas fechas del rango');
        return;
      }
      if (config.fechaDesde > config.fechaHasta) {
        setError('La fecha "desde" debe ser anterior a "hasta"');
        return;
      }
    }

    const meses = mesesACargar();
    if (meses.length === 0) {
      setError('No hay periodo seleccionado');
      return;
    }

    setGenerando(true);
    try {
      // Cargar todas las derivaciones del periodo
      const todas: Derivacion[] = [];
      for (const mes of meses) {
        const res = await fetchAuth(`${API}/derivaciones?mes=${mes}`);
        if (res.ok) {
          const data = await res.json();
          todas.push(...data);
        }
      }

      const filtradas = filtrarPorRango(todas);

      if (filtradas.length === 0) {
        setError('No hay derivaciones en el periodo seleccionado');
        setGenerando(false);
        return;
      }

      const titulo = tituloDelPeriodo(tipoPeriodo, config);
      const fname = nombreArchivo(tipoPeriodo, config);

      if (formato === 'pdf') {
        generarPDF(filtradas, titulo, fname);
      } else {
        generarExcel(filtradas, titulo, fname);
      }

      onCerrar();
    } catch (e: any) {
      setError(e.message || 'Error al generar el archivo');
    } finally {
      setGenerando(false);
    }
  };

  if (!abierto) return null;

  return (
    <div className="mdr-overlay" onClick={onCerrar}>
      <div className="mdr-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="mdr-header">
          <h2 className="mdr-title">Descargar Resumen</h2>
          <button className="mdr-close" onClick={onCerrar} title="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Formato */}
        <div className="mdr-section">
          <label className="mdr-label">Formato</label>
          <div className="mdr-toggle-group">
            <button
              className={`mdr-toggle ${formato === 'pdf' ? 'mdr-toggle--active' : ''}`}
              onClick={() => setFormato('pdf')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              PDF
            </button>
            <button
              className={`mdr-toggle ${formato === 'excel' ? 'mdr-toggle--active' : ''}`}
              onClick={() => setFormato('excel')}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="3" y1="9" x2="21" y2="9" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
              Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* Tipo de periodo */}
        <div className="mdr-section">
          <label className="mdr-label">Periodo</label>
          <div className="mdr-periodo-tabs">
            {(['mensual', 'semestral', 'anual', 'rango'] as TipoPeriodo[]).map(t => (
              <button
                key={t}
                className={`mdr-tab ${tipoPeriodo === t ? 'mdr-tab--active' : ''}`}
                onClick={() => setTipoPeriodo(t)}
              >
                {t === 'rango' ? 'Rango de fechas' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Selector según tipo */}
        <div className="mdr-section">
          {tipoPeriodo === 'mensual' && (
            <select
              className="mdr-select"
              value={config.mes}
              onChange={e => setConfig(c => ({ ...c, mes: e.target.value }))}
            >
              {opcionesMeses.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}

          {tipoPeriodo === 'semestral' && (
            <select
              className="mdr-select"
              value={`${config.desde}|${config.hasta}`}
              onChange={e => {
                const [d, h] = e.target.value.split('|');
                setConfig(c => ({ ...c, desde: d, hasta: h }));
              }}
            >
              {opcionesSemestres.map(o => (
                <option key={o.desde} value={`${o.desde}|${o.hasta}`}>{o.label}</option>
              ))}
            </select>
          )}

          {tipoPeriodo === 'anual' && (
            <select
              className="mdr-select"
              value={`${config.desde}|${config.hasta}`}
              onChange={e => {
                const [d, h] = e.target.value.split('|');
                setConfig(c => ({ ...c, desde: d, hasta: h }));
              }}
            >
              {opcionesAnuales.map(o => (
                <option key={o.desde} value={`${o.desde}|${o.hasta}`}>{o.label}</option>
              ))}
            </select>
          )}

          {tipoPeriodo === 'rango' && (
            <div className="mdr-rango">
              <div className="mdr-rango-field">
                <label className="mdr-label-sm">Desde</label>
                <input
                  type="date"
                  className="mdr-input"
                  value={config.fechaDesde}
                  onChange={e => setConfig(c => ({ ...c, fechaDesde: e.target.value }))}
                />
              </div>
              <div className="mdr-rango-field">
                <label className="mdr-label-sm">Hasta</label>
                <input
                  type="date"
                  className="mdr-input"
                  value={config.fechaHasta}
                  onChange={e => setConfig(c => ({ ...c, fechaHasta: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && <p className="mdr-error">{error}</p>}

        {/* Acciones */}
        <div className="mdr-actions">
          <button className="mdr-btn-cancel" onClick={onCerrar}>Cancelar</button>
          <button
            className="mdr-btn-generar"
            onClick={handleGenerar}
            disabled={generando}
          >
            {generando ? (
              <>
                <span className="mdr-spinner" />
                Generando…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Descargar {formato === 'pdf' ? 'PDF' : 'Excel'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
