import { useState } from 'react';
import { IconMail, IconLock, IconEye, IconEyeOff, IconUser } from './icons';
import { InputField } from './InputField';
import { SubmitButton } from './SubmitButton';

const cardStyle: React.CSSProperties = {
  background: 'rgba(16,20,30,0.72)',
  backdropFilter: 'blur(20px)',
  border: '1px solid rgba(167,139,250,0.15)',
  boxShadow: '0 0 0 1px rgba(124,58,237,0.08), 0 24px 48px rgba(0,0,0,0.5)',
};

export function RegisterFace({ onFlip }: { onFlip: () => void }) {
  const [nombre, setNombre] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full rounded-2xl p-6" style={cardStyle}>
      <div className="text-center mb-5 pb-5 border-b border-white/[0.06]">
        <h1 className="text-primary font-bold text-lg tracking-tight mb-1">Crear cuenta</h1>
        <p className="text-on-surface-subtle text-xs">Únete y empieza a vivir los mejores eventos</p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <InputField id="r-nombre" label="Nombre" placeholder="Juan" value={nombre} onChange={setNombre} icon={<IconUser />} />
          <InputField id="r-apellidos" label="Apellidos" placeholder="García" value={apellidos} onChange={setApellidos} icon={<IconUser />} />
        </div>
        <InputField id="r-email" label="Correo electrónico" type="email"
          placeholder="nombre@ejemplo.com" value={email} onChange={setEmail} icon={<IconMail />} />
        <InputField id="r-password" label="Contraseña"
          type={showPassword ? 'text' : 'password'} placeholder="••••••••"
          value={password} onChange={setPassword} icon={<IconLock />}
          rightSlot={
            <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-on-surface-faint hover:text-on-surface-variant transition-colors">
              {showPassword ? <IconEye /> : <IconEyeOff />}
            </button>
          }
        />
        <SubmitButton label="Crear cuenta" />
      </form>

      <div className="mt-4 pt-4 text-center border-t border-white/[0.05]">
        <p className="text-on-surface-dim text-xs">
          ¿Ya tienes una cuenta?{' '}
          <button type="button" onClick={onFlip} className="text-accent font-semibold hover:text-primary transition-colors ml-0.5">
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
}
