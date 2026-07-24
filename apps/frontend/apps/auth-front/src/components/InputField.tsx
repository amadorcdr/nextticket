import type { ReactNode } from 'react';

interface InputFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  icon: ReactNode;
  rightSlot?: ReactNode;
}

export function InputField({ id, label, type = 'text', placeholder, value, onChange, icon, rightSlot }: InputFieldProps) {
  return (
    <div className="group">
      <label htmlFor={id} className="text-on-surface-faint text-[10px] font-bold tracking-[0.1em] uppercase block mb-1.5 transition-colors group-focus-within:text-accent">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-on-surface-faint group-focus-within:text-accent transition-colors">{icon}</span>
        <input
          id={id}
          type={type}
          required
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent border-0 border-b border-white/[0.08] pl-6 py-1.5 text-sm text-on-background placeholder:text-input-placeholder outline-none transition-all focus:border-primary-container"
          style={{ paddingRight: rightSlot ? '2rem' : undefined }}
        />
        {rightSlot && <span className="absolute right-0 top-1/2 -translate-y-1/2">{rightSlot}</span>}
      </div>
    </div>
  );
}
