import { useState } from "react";
import { createPortal } from "react-dom";
import { Button, Description, Icon, Input, Label, TextField } from "@nextticket-frontend/commons";

interface ModalEventProps {
  open: boolean;
  onClose: () => void;
}

const RECINTOS = ["Arena Movistar", "Teatro Nacional", "Estadio Olímpico", "Playa del Sol"];
const ZONA_OPTIONS = ["VIP Premium", "General", "Palcos", "Platea"];

export function ModalEvent({ open, onClose }: ModalEventProps) {
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [recinto, setRecinto] = useState("");
  const [zonas, setZonas] = useState<string[]>([]);
  const [imgPreview, setImgPreview] = useState<string | null>(null);

  const toggleZona = (zona: string) => {
    setZonas((prev) => (prev.includes(zona) ? prev.filter((z) => z !== zona) : [...prev, zona]));
  };

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgPreview(URL.createObjectURL(file));
  };

  const handleReset = () => {
    setNombre("");
    setFecha("");
    setHora("");
    setDescripcion("");
    setRecinto("");
    setZonas([]);
    setImgPreview(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
  };

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div onClick={onClose} className="fixed inset-0 z-60 backdrop-blur-md" style={{ background: "var(--backdrop)" }} />

      {/* Panel — slides in from right */}
      <aside className="fixed top-0 right-0 h-full w-full max-w-100 z-70 flex flex-col bg-surface border-l border-border rounded-l-2xl shadow-overlay">
        {/* Header */}
        <div className="flex justify-between items-start px-5 py-4 border-b border-border shrink-0">
          <div>
            <h4 className="text-foreground font-bold">Crear Nuevo Evento</h4>
            <p className="text-muted text-xs mt-0.5">Configura los detalles de tu próximo gran evento.</p>
          </div>
          <Button variant="ghost" size="sm" isIconOnly onPress={onClose}>
            <Icon.X />
          </Button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {/* Imagen */}
          <div>
            <Label>Imagen del Evento</Label>
            <label
              htmlFor="modal-img"
              className="mt-1 flex flex-col items-center justify-center gap-1.5 h-24 rounded-xl border-2 border-dashed border-border bg-background cursor-pointer overflow-hidden relative hover:border-foreground transition-colors"
            >
              {imgPreview ? (
                <img src={imgPreview} alt="preview" className="w-full h-full object-cover absolute inset-0" />
              ) : (
                <>
                  <Icon.Upload className="text-muted size-5" />
                  <span className="text-muted text-[11px]">Cargar imagen (1200×800 px)</span>
                </>
              )}
            </label>
            <input id="modal-img" type="file" accept="image/*" className="hidden" onChange={handleImgChange} />
          </div>

          <TextField isRequired name="nombre">
            <Label>Nombre del Evento</Label>
            <Input placeholder="Ej: Festival de Verano 2024" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </TextField>

          <div className="grid grid-cols-2 gap-2">
            <TextField isRequired name="fecha" type="date">
              <Label>Fecha</Label>
              <Input value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </TextField>
            <TextField isRequired name="hora" type="time">
              <Label>Hora</Label>
              <Input value={hora} onChange={(e) => setHora(e.target.value)} />
            </TextField>
          </div>

          <TextField name="descripcion">
            <Label>Descripción</Label>
            <Input placeholder="Describe los puntos clave del evento..." value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </TextField>

          <div>
            <Label>Recinto</Label>
            <select
              value={recinto}
              onChange={(e) => setRecinto(e.target.value)}
              className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer"
            >
              <option value="">Selecciona un recinto</option>
              {RECINTOS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Zonas Disponibles</Label>
            <Description className="mb-1.5">Selecciona una o más zonas de venta</Description>
            <div className="flex gap-1.5 flex-wrap">
              {ZONA_OPTIONS.map((zona) => {
                const checked = zonas.includes(zona);
                return (
                  <button
                    key={zona}
                    type="button"
                    onClick={() => toggleZona(zona)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                      checked ? "bg-accent text-accent-foreground border-transparent" : "bg-surface-secondary text-muted border-border hover:text-foreground"
                    }`}
                  >
                    {checked && <Icon.Check className="size-3" />}
                    {zona}
                  </button>
                );
              })}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex gap-2 px-5 py-3 border-t border-border shrink-0">
          <Button
            size="sm"
            variant="secondary"
            fullWidth
            onPress={() => {
              handleReset();
              onClose();
            }}
          >
            Cancelar
          </Button>
          <Button size="sm" fullWidth onPress={handleSubmit as unknown as () => void}>
            Guardar Evento
          </Button>
        </div>
      </aside>
    </>,
    document.body
  );
}
