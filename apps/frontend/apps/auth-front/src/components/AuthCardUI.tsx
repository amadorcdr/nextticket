import { ReactNode } from "react";
import { Icon } from "@nextticket-frontend/commons";

// Colores del theme de la app (bg-surface, border-border, bg-accent): nada de morado aquí.
export const authCardClassName = "bg-surface/95 backdrop-blur-xl border border-border shadow-2xl shadow-black/30";

interface InputFieldProps {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  icon: ReactNode;
  rightSlot?: ReactNode;
}

export function InputField({
  id,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  icon,
  rightSlot,
}: InputFieldProps) {
  return (
    <div className="group">
      <label
        htmlFor={id}
        className="text-muted text-[10px] font-bold tracking-widest uppercase block mb-1 transition-colors group-focus-within:text-foreground"
      >
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-foreground transition-colors">
          {icon}
        </span>
        <input
          id={id}
          type={type}
          required
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent border-0 border-b border-border pl-6 py-1 text-sm text-foreground placeholder:text-muted outline-none transition-all focus:border-foreground"
          style={{ paddingRight: rightSlot ? "2rem" : undefined }}
        />
        {rightSlot && <span className="absolute right-0 top-1/2 -translate-y-1/2">{rightSlot}</span>}
      </div>
    </div>
  );
}

export type UserType = "usuario" | "organizador" | "admin" | "validador";

export const USER_TYPES: { key: UserType; label: string; icon: ReactNode }[] = [
  { key: "usuario", label: "Usuario", icon: <Icon.User className="w-3.5 h-3.5" /> },
  { key: "organizador", label: "Organizador", icon: <Icon.CalendarCheck className="w-3.5 h-3.5" /> },
  { key: "admin", label: "Admin", icon: <Icon.ShieldCheck className="w-3.5 h-3.5" /> },
  { key: "validador", label: "Validador", icon: <Icon.QrCode className="w-3.5 h-3.5" /> },
];

export function RoleSelector({ value, onChange }: { value: UserType; onChange: (v: UserType) => void }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {USER_TYPES.map(({ key, label, icon }) => {
        const isActive = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition-all duration-150 active:scale-95 flex flex-col items-center justify-center gap-1 border ${
              isActive
                ? "border-transparent bg-accent text-accent-foreground"
                : "border-border bg-surface-secondary text-muted hover:text-foreground"
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
