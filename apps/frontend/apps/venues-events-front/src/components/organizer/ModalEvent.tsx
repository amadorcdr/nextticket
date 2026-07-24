import { useState } from 'react';
import { IcoX, IcoUpload, IcoCalendar, IcoClock } from './icons';
import { colors } from './theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModalEventProps {
  open: boolean;
  onClose: () => void;
}

// ─── Shared input style ───────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: colors.background,
  border: `1px solid ${colors.outlineVariant}`,
  borderRadius: 10,
  color: colors.onBackground,
  fontSize: 13,
  padding: '8px 12px',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: colors.white,
  marginBottom: 6,
  display: 'block',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ModalEvent({ open, onClose }: ModalEventProps) {
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState('');
  const [hora, setHora] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [recinto, setRecinto] = useState('');
  const [zonas, setZonas] = useState<string[]>([]);
  const [imgPreview, setImgPreview] = useState<string | null>(null);

  const toggleZona = (zona: string) => {
    setZonas((prev) =>
      prev.includes(zona) ? prev.filter((z) => z !== zona) : [...prev, zona]
    );
  };

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImgPreview(url);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // handle create event logic here
    onClose();
  };

  const handleReset = () => {
    setNombre(''); setFecha(''); setHora(''); setDescripcion('');
    setRecinto(''); setZonas([]); setImgPreview(null);
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop — blur */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'rgba(11,15,16,0.7)',
          backdropFilter: 'blur(6px)',
          transition: 'opacity 0.3s ease',
          opacity: open ? 1 : 0,
        }}
      />

      {/* Panel — slides in from right */}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          height: '100%',
          width: '100%',
          maxWidth: 480,
          zIndex: 70,
          display: 'flex',
          flexDirection: 'column',
          background: colors.surfaceContainerLow,
          borderLeft: `1px solid ${colors.outlineVariant}`,
          borderRadius: '16px 0 0 16px',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.32s cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '20px 24px',
            borderBottom: `1px solid ${colors.outlineVariant}`,
            flexShrink: 0,
          }}
        >
          <div>
            <h2 style={{ color: colors.white, fontWeight: 800, fontSize: 18, margin: 0, letterSpacing: '-0.01em' }}>
              Crear Nuevo Evento
            </h2>
            <p style={{ color: colors.onSurfaceVariant, fontSize: 12, marginTop: 4 }}>
              Configura los detalles de tu próximo gran evento.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.onSurfaceFaint, padding: 4, display: 'flex', marginTop: 2 }}
            onMouseEnter={(e) => (e.currentTarget.style.color = colors.onSurfaceVariant)}
            onMouseLeave={(e) => (e.currentTarget.style.color = colors.onSurfaceFaint)}
          >
            <IcoX />
          </button>
        </div>

        {/* ── Form body (scrollable) ── */}
        <form
          onSubmit={handleSubmit}
          style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}
        >
          {/* Imagen */}
          <div>
            <label style={labelStyle}>Imagen del Evento</label>
            <label
              htmlFor="modal-img"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                height: 140,
                borderRadius: 10,
                border: `2px dashed ${colors.outlineVariant}`,
                background: colors.background,
                cursor: 'pointer',
                overflow: 'hidden',
                position: 'relative',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = colors.primaryContainer)}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = colors.outlineVariant)}
            >
              {imgPreview ? (
                <img src={imgPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} />
              ) : (
                <>
                  <span style={{ color: colors.primaryContainer }}><IcoUpload /></span>
                  <span style={{ color: colors.onSurfaceVariant, fontSize: 12 }}>Cargar imagen (1200×800 px)</span>
                </>
              )}
            </label>
            <input id="modal-img" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImgChange} />
          </div>

          {/* Nombre */}
          <div>
            <label htmlFor="modal-nombre" style={labelStyle}>Nombre del Evento</label>
            <input
              id="modal-nombre"
              type="text"
              placeholder="Ej: Festival de Verano 2024"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryContainer)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.outlineVariant)}
            />
          </div>

          {/* Fecha + Hora */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label htmlFor="modal-fecha" style={labelStyle}>Fecha</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.onSurfaceFaint, pointerEvents: 'none', display: 'flex' }}>
                  <IcoCalendar />
                </span>
                <input
                  id="modal-fecha"
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 34, colorScheme: 'dark' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryContainer)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = colors.outlineVariant)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="modal-hora" style={labelStyle}>Hora</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: colors.onSurfaceFaint, pointerEvents: 'none', display: 'flex' }}>
                  <IcoClock />
                </span>
                <input
                  id="modal-hora"
                  type="time"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: 34, colorScheme: 'dark' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryContainer)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = colors.outlineVariant)}
                />
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label htmlFor="modal-desc" style={labelStyle}>Descripción</label>
            <textarea
              id="modal-desc"
              placeholder="Describe los puntos clave del evento..."
              rows={4}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryContainer)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.outlineVariant)}
            />
          </div>

          {/* Recinto */}
          <div>
            <label htmlFor="modal-recinto" style={labelStyle}>Recinto</label>
            <select
              id="modal-recinto"
              value={recinto}
              onChange={(e) => setRecinto(e.target.value)}
              style={{ ...inputStyle, appearance: 'none', cursor: 'pointer', borderRadius: 10 }}
              onFocus={(e) => (e.currentTarget.style.borderColor = colors.primaryContainer)}
              onBlur={(e) => (e.currentTarget.style.borderColor = colors.outlineVariant)}
            >
              <option value="" style={{ background: colors.surfaceContainerLow }}>Selecciona un recinto</option>
              {['Arena Movistar', 'Teatro Nacional', 'Estadio Olímpico', 'Playa del Sol'].map((r) => (
                <option key={r} value={r} style={{ background: colors.surfaceContainerLow }}>{r}</option>
              ))}
            </select>
          </div>

          {/* Zonas */}
          <div>
            <label style={labelStyle}>Zonas Disponibles</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['VIP Premium', 'General', 'Palcos', 'Platea'].map((zona) => {
                const checked = zonas.includes(zona);
                return (
                  <label
                    key={zona}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '6px 14px',
                      borderRadius: 20,
                      border: checked ? '1px solid rgba(124,58,237,0.6)' : `1px solid ${colors.outlineVariant}`,
                      background: checked ? 'rgba(124,58,237,0.12)' : 'transparent',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: checked ? colors.primary : colors.onSurfaceVariant,
                      transition: 'all 0.15s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleZona(zona)}
                      style={{ display: 'none' }}
                    />
                    <span style={{
                      width: 14, height: 14, borderRadius: 6,
                      border: checked ? 'none' : `1.5px solid ${colors.outlineVariant}`,
                      background: checked ? colors.primaryContainer : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {checked && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    {zona}
                  </label>
                );
              })}
            </div>
          </div>
        </form>

        {/* ── Footer ── */}
        <div
          style={{
            display: 'flex',
            gap: 10,
            padding: '16px 24px',
            borderTop: `1px solid ${colors.outlineVariant}`,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => { handleReset(); onClose(); }}
            style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: 'none', border: `1px solid ${colors.outlineVariant}`, color: colors.onSurfaceVariant, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceContainerHigh)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.primaryContainerDark} 100%)`, border: 'none', color: colors.white, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.3)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
          >
            Guardar Evento
          </button>
        </div>
      </aside>
    </>
  );
}
