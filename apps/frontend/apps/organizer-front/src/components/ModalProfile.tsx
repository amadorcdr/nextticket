import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, Icon, Input, Label, TextField } from "@nextticket-frontend/commons";

interface ProfileData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
}

interface ModalProfileProps {
  open: boolean;
  onClose: () => void;
}

const INITIAL: ProfileData = {
  nombre: "Carlos",
  apellido: "Rivera",
  email: "carlos.rivera@organizador.com",
  telefono: "+52 55 1234 5678",
};

export function ModalProfile({ open, onClose }: ModalProfileProps) {
  const [data, setData] = useState<ProfileData>(INITIAL);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileData>(INITIAL);

  const startEdit = () => {
    setDraft(data);
    setEditing(true);
  };
  const saveEdit = () => {
    setData(draft);
    setEditing(false);
  };
  const cancelEdit = () => setEditing(false);

  const set = (k: keyof ProfileData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((p) => ({ ...p, [k]: e.target.value }));

  const initials = `${data.nombre.charAt(0)}${data.apellido.charAt(0)}`.toUpperCase();

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 z-90 backdrop-blur-md" style={{ background: "var(--backdrop)" }} />

      {/* Modal */}
      <div className="fixed inset-0 z-91 flex items-center justify-center p-5 pointer-events-none">
        <div className="w-full max-w-130 max-h-[90vh] overflow-y-auto rounded-[20px] bg-surface border border-border shadow-overlay pointer-events-auto">
          {/* Header */}
          <div className="px-7 pt-6 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-accent flex items-center justify-center text-accent-foreground text-xl font-black select-none shrink-0">
                  {initials}
                </div>
                <div>
                  <p className="text-foreground font-bold text-lg">
                    {data.nombre} {data.apellido}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!editing ? (
                  <Button size="sm" variant="secondary" onPress={startEdit}>
                    <Icon.Pencil />
                    Editar perfil
                  </Button>
                ) : (
                  <>
                    <Button size="sm" variant="ghost" onPress={cancelEdit}>
                      Cancelar
                    </Button>
                    <Button size="sm" onPress={saveEdit}>
                      <Icon.Check />
                      Guardar
                    </Button>
                  </>
                )}
                <Button size="sm" variant="ghost" isIconOnly onPress={onClose}>
                  <Icon.X />
                </Button>
              </div>
            </div>

            {/* Meta */}
            <div className="flex gap-4 flex-wrap pb-4 text-muted text-xs">
              <span className="flex items-center gap-1.5">
                <Icon.Mail className="size-3.5" />
                {data.email}
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="px-7 py-5 flex flex-col gap-3.5">
            <p className="text-foreground font-bold text-sm">Datos Personales</p>

            <div className="grid grid-cols-2 gap-3.5">
              <TextField isDisabled={!editing}>
                <Label>Nombre</Label>
                <Input value={editing ? draft.nombre : data.nombre} onChange={set("nombre")} />
              </TextField>
              <TextField isDisabled={!editing}>
                <Label>Apellido</Label>
                <Input value={editing ? draft.apellido : data.apellido} onChange={set("apellido")} />
              </TextField>
              <TextField isDisabled={!editing}>
                <Label>Correo electrónico</Label>
                <Input type="email" value={editing ? draft.email : data.email} onChange={set("email")} />
              </TextField>
              <TextField isDisabled={!editing}>
                <Label>Teléfono</Label>
                <Input value={editing ? draft.telefono : data.telefono} onChange={set("telefono")} />
              </TextField>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
