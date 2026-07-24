import { useState } from 'react';
import { IcoX, IcoMail, IcoPhone, IcoPin, IcoCalendar, IcoEdit, IcoCheck } from './icons';
import { colors } from './theme';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  ubicacion: string;
  bio: string;
  rol: string;
  desde: string;
}

interface ModalProfileProps {
  open: boolean;
  onClose: () => void;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const input = (focus = false): React.CSSProperties => ({
  width: '100%',
  background: colors.background,
  border: `1px solid ${focus ? colors.primaryContainer : colors.outlineVariant}`,
  borderRadius: 10,
  color: colors.white,
  fontSize: 13,
  fontWeight: 500,
  padding: '9px 12px',
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
});

const readonlyBox: React.CSSProperties = {
  background: colors.background,
  border: `1px solid ${colors.outlineVariant}`,
  borderRadius: 10,
  color: colors.white,
  fontSize: 13,
  fontWeight: 500,
  padding: '9px 12px',
};

const lbl: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: colors.onSurfaceVariant,
  marginBottom: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 5,
};

const INITIAL: ProfileData = {
  nombre: 'Carlos',
  apellido: 'Rivera',
  email: 'carlos.rivera@organizador.com',
  telefono: '+52 55 1234 5678',
  ubicacion: 'Ciudad de México, MX',
  bio: 'Organizador de eventos masivos con más de 10 años de experiencia en la industria del entretenimiento y festivales culturales.',
  rol: 'Organizador Senior',
  desde: 'Enero 2024',
};

// ─── Component ────────────────────────────────────────────────────────────────

export function ModalProfile({ open, onClose }: ModalProfileProps) {
  const [data, setData] = useState<ProfileData>(INITIAL);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData>(INITIAL);
  const [focusField, setFocus] = useState<string | null>(null);

  const startEdit = () => { setDraft(data); setEditing(true); };
  const saveEdit = () => { setData(draft); setEditing(false); };
  const cancelEdit = () => { setEditing(false); };

  const set = (k: keyof ProfileData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((p) => ({ ...p, [k]: e.target.value }));

  const initials = `${data.nombre.charAt(0)}${data.apellido.charAt(0)}`.toUpperCase();

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(11,15,16,0.75)',
          backdropFilter: 'blur(8px)',
          transition: 'opacity 0.25s',
          opacity: open ? 1 : 0,
        }}
      />

      {/* Modal */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9001, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, pointerEvents: 'none' }}>
        <div
          style={{
            width: '100%', maxWidth: 520,
            maxHeight: '90vh',
            overflowY: 'auto',
            background: colors.surfaceContainerLow,
            border: `1px solid ${colors.outlineVariant}`,
            borderRadius: 20,
            boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            pointerEvents: 'auto',
            transition: 'opacity 0.25s, transform 0.28s cubic-bezier(0.34,1.2,0.64,1)',
            opacity: open ? 1 : 0,
            transform: open ? 'scale(1)' : 'scale(0.96)',
          }}
        >
          {/* Header */}
          <div style={{ padding: '24px 28px 0', borderBottom: `1px solid ${colors.outlineVariant}` }}>
            {/* Top row: avatar + close + edit */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Avatar */}
                <div style={{
                  width: 56, height: 56, borderRadius: 14, flexShrink: 0,
                  background: `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.primaryContainerDark} 100%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: colors.white, fontSize: 20, fontWeight: 900, userSelect: 'none',
                }}>
                  {initials}
                </div>
                <div>
                  <p style={{ color: colors.white, fontWeight: 800, fontSize: 18, margin: 0, letterSpacing: '-0.01em' }}>
                    {data.nombre} {data.apellido}
                  </p>
                  <p style={{ color: colors.primary, fontSize: 12, fontWeight: 600, margin: '3px 0 0' }}>{data.rol}</p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* Edit / Save / Cancel */}
                {!editing ? (
                  <button
                    onClick={startEdit}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 10, background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.35)', color: colors.primary, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.22)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.12)')}
                  ><IcoEdit /> Editar perfil</button>
                ) : (
                  <>
                    <button
                      onClick={cancelEdit}
                      style={{ padding: '7px 14px', borderRadius: 10, background: 'none', border: `1px solid ${colors.outlineVariant}`, color: colors.onSurfaceVariant, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = colors.surfaceContainerHigh)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >Cancelar</button>
                    <button
                      onClick={saveEdit}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 10, background: `linear-gradient(135deg,${colors.primaryContainer} 0%,${colors.primaryContainerDark} 100%)`, border: 'none', color: colors.white, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
                    ><IcoCheck /> Guardar</button>
                  </>
                )}
                {/* Close */}
                <button
                  onClick={onClose}
                  style={{ width: 30, height: 30, borderRadius: 8, background: colors.surfaceContainerHigh, border: `1px solid ${colors.outlineVariant}`, cursor: 'pointer', color: colors.onSurfaceVariant, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceVariant; (e.currentTarget as HTMLElement).style.color = colors.white; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = colors.surfaceContainerHigh; (e.currentTarget as HTMLElement).style.color = colors.onSurfaceVariant; }}
                ><IcoX /></button>
              </div>
            </div>

            {/* Meta chips */}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', paddingBottom: 16 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: colors.onSurfaceVariant }}>
                <span style={{ color: colors.primaryContainer }}><IcoMail /></span>{data.email}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: colors.onSurfaceVariant }}>
                <span style={{ color: colors.primaryContainer }}><IcoCalendar /></span>Miembro desde {data.desde}
              </span>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: '20px 28px 28px' }}>

            <p style={{ color: colors.white, fontWeight: 700, fontSize: 14, margin: '0 0 18px' }}>Datos Personales</p>

            {/* Grid fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {/* Nombre */}
              <div>
                <label style={lbl}>Nombre</label>
                {editing
                  ? <input value={draft.nombre} onChange={set('nombre')} style={input(focusField === 'nombre')} onFocus={() => setFocus('nombre')} onBlur={() => setFocus(null)} />
                  : <div style={readonlyBox}>{data.nombre}</div>}
              </div>
              {/* Apellido */}
              <div>
                <label style={lbl}>Apellido</label>
                {editing
                  ? <input value={draft.apellido} onChange={set('apellido')} style={input(focusField === 'apellido')} onFocus={() => setFocus('apellido')} onBlur={() => setFocus(null)} />
                  : <div style={readonlyBox}>{data.apellido}</div>}
              </div>
              {/* Email */}
              <div>
                <label style={lbl}><span style={{ color: colors.primaryContainer }}><IcoMail /></span>Correo Electrónico</label>
                {editing
                  ? <input type="email" value={draft.email} onChange={set('email')} style={input(focusField === 'email')} onFocus={() => setFocus('email')} onBlur={() => setFocus(null)} />
                  : <div style={readonlyBox}>{data.email}</div>}
              </div>
              {/* Teléfono */}
              <div>
                <label style={lbl}><span style={{ color: colors.primaryContainer }}><IcoPhone /></span>Teléfono</label>
                {editing
                  ? <input value={draft.telefono} onChange={set('telefono')} style={input(focusField === 'telefono')} onFocus={() => setFocus('telefono')} onBlur={() => setFocus(null)} />
                  : <div style={readonlyBox}>{data.telefono}</div>}
              </div>
            </div>

            {/* Ubicación */}
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}><span style={{ color: colors.primaryContainer }}><IcoPin /></span>Ubicación</label>
              {editing
                ? <input value={draft.ubicacion} onChange={set('ubicacion')} style={input(focusField === 'ubicacion')} onFocus={() => setFocus('ubicacion')} onBlur={() => setFocus(null)} />
                : <div style={readonlyBox}>{data.ubicacion}</div>}
            </div>

            {/* Biografía */}
            <div>
              <label style={lbl}>Biografía Corta</label>
              {editing
                ? <textarea rows={3} value={draft.bio} onChange={set('bio')} style={{ ...input(focusField === 'bio'), resize: 'none', lineHeight: 1.6 }} onFocus={() => setFocus('bio')} onBlur={() => setFocus(null)} />
                : <div style={{ ...readonlyBox, lineHeight: 1.7, color: colors.onSurfaceVariant }}>{data.bio}</div>}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
