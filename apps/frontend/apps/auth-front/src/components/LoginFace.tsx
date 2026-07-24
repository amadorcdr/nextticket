import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconMail, IconLock, IconEye, IconEyeOff } from './icons';
import { InputField } from './InputField';
import { SubmitButton } from './SubmitButton';
import { USER_TYPES, type UserType } from './userTypes';

const cardStyle: React.CSSProperties = {
  background: 'rgba(16,20,30,0.72)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(167,139,250,0.15)',
  boxShadow: '0 0 0 1px rgba(124,58,237,0.08), 0 24px 48px rgba(0,0,0,0.5)',
};

export function LoginFace({ onFlip }: { onFlip: () => void }) {
  const navigate = useNavigate();
  const [userType, setUserType] = useState<UserType>('organizador');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (userType === 'organizador') {
      navigate('/organizer/dashboard');
      return;
    }

    if (userType === 'validador') {
      navigate('/validator');
      return;
    }

    // TODO: todavía no existe la vista de Admin.
    console.log('Rol seleccionado:', userType);
  };

  return (
    <div className="w-full rounded-2xl p-6" style={cardStyle}>
      <div className="text-center mb-5 pb-5 border-b border-white/[0.06]">
        <h1 className="text-primary font-bold text-lg tracking-tight mb-1">Inicio de sesión</h1>
        <p className="text-on-surface-subtle text-xs">Accede a tu cuenta para gestionar tus eventos</p>
      </div>

      <div className="mb-5">
        <label className="text-on-surface-muted text-[10px] font-bold tracking-[0.1em] uppercase block mb-2">Tipo de usuario</label>
        <div className="grid grid-cols-3 gap-1.5">
          {USER_TYPES.map(({ key, label, icon }) => {
            const isActive = userType === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setUserType(key)}
                className="py-2 px-1 rounded-lg text-[11px] font-bold transition-all duration-150 active:scale-95 flex flex-col items-center justify-center gap-1"
                style={{
                  background: isActive ? 'linear-gradient(135deg,#7c3aed 0%,#4f35c7 100%)' : 'rgba(255,255,255,0.04)',
                  color: isActive ? '#ede0ff' : '#6b6080',
                  border: isActive ? '1px solid rgba(167,139,250,0.6)' : '1px solid rgba(255,255,255,0.06)',
                  boxShadow: isActive ? '0 0 14px rgba(124,58,237,0.35)' : 'none',
                }}
              >
                {icon}
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/[0.05] mb-5" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <InputField id="l-email" label="Correo electrónico" type="email"
          placeholder="nombre@ejemplo.com" value={email} onChange={setEmail} icon={<IconMail />} />
        <InputField id="l-password" label="Contraseña"
          type={showPassword ? 'text' : 'password'} placeholder="••••••••"
          value={password} onChange={setPassword} icon={<IconLock />}
          rightSlot={
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-on-surface-faint hover:text-on-surface-variant transition-colors">
              {showPassword ? <IconEye /> : <IconEyeOff />}
            </button>
          }
        />
        <div className="flex justify-end -mt-2">
          <a href="#" className="text-accent-muted text-[11px] hover:text-primary transition-colors">¿Olvidaste tu contraseña?</a>
        </div>
        <SubmitButton label="Ingresar" />
      </form>

      <div className="mt-4 pt-4 text-center border-t border-white/[0.05]">
        <p className="text-on-surface-dim text-xs">
          ¿No tienes una cuenta?{' '}
          <button type="button" onClick={onFlip} className="text-accent font-semibold hover:text-primary transition-colors ml-0.5">
            Regístrate
          </button>
        </p>
      </div>
    </div>
  );
}
