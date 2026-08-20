import { useEffect, useState } from "react";
import { API_BASE_URL, ApiError, Button, Icon, Input, Label, Router, TextField, toast, useApi, useSession } from "@nextticket-frontend/commons";
import { toIsoDateTime, uploadEventImage, type ApiEvent, type ApiEventCategory, type ApiVenue } from "../api";

// El backend no soporta busqueda por texto en la query todavia (solo
// page/limit): se trae una sola pagina grande, mismo patron que MyEvents.
const FETCH_LIMIT = 100;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface Paginated<T> {
  data: T[];
}

interface Draft {
  nombre: string;
  venueId: string;
  categoryId: string;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  descripcion: string;
}

const EMPTY: Draft = { nombre: "", venueId: "", categoryId: "", fecha: "", horaInicio: "", horaFin: "", descripcion: "" };

function toDateInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toTimeInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EventFormPage() {
  const { id } = Router.useParams<{ id: string }>();
  const navigate = Router.useNavigate();
  const api = useApi();
  const { user } = useSession();
  const isCreate = !id;

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [originalCategoryId, setOriginalCategoryId] = useState("");
  const [venues, setVenues] = useState<ApiVenue[]>([]);
  const [categories, setCategories] = useState<ApiEventCategory[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!isCreate);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<Paginated<ApiVenue>>(`/venues?limit=${FETCH_LIMIT}`)
      .then((res) => setVenues(res.data.filter((v) => v.status !== "REMOVED" && v.status !== "INACTIVE" && v.status !== "UNDER_MAINTENANCE")))
      .catch(() => {
        // Si falla, el selector de recinto simplemente queda vacío.
      });
    api
      .get<Paginated<ApiEventCategory>>(`/event-categories?limit=${FETCH_LIMIT}`)
      .then((res) => setCategories(res.data.filter((c) => c.status === "ACTIVE")))
      .catch(() => {
        // Si falla, el selector de categoría simplemente queda vacío.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isCreate || !id) return;
    setLoading(true);
    setNotFound(false);
    api
      .get<ApiEvent>(`/events/${id}`)
      .then((ev) => {
        const categoryId = ev.categories[0]?.category.id ?? "";
        setDraft({
          nombre: ev.name,
          venueId: ev.venueId,
          categoryId,
          fecha: toDateInput(ev.startsAt),
          horaInicio: toTimeInput(ev.startsAt),
          horaFin: toTimeInput(ev.endsAt),
          descripcion: ev.description ?? "",
        });
        setOriginalCategoryId(categoryId);
        setImagePreview(ev.imageUrl ?? "");
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else toast.danger(err instanceof ApiError ? err.message : "No se pudo cargar el evento");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Libera el blob URL anterior cuando se elige otra imagen.
  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const set = (k: "nombre" | "fecha" | "horaInicio" | "horaFin" | "descripcion") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((p) => ({ ...p, [k]: e.target.value }));

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageError("Elige un archivo de imagen (JPEG, PNG, WEBP o GIF).");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError("La imagen no puede pesar más de 5 MB.");
      return;
    }
    setImageError(null);
    setImageFile(file);
  };

  const datesValid = Boolean(draft.fecha && draft.horaInicio && draft.horaFin) && draft.horaFin > draft.horaInicio;
  const canSave = draft.nombre.trim() && draft.venueId && datesValid;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload = {
        venueId: draft.venueId,
        name: draft.nombre,
        startsAt: toIsoDateTime(draft.fecha, draft.horaInicio),
        endsAt: toIsoDateTime(draft.fecha, draft.horaFin),
        description: draft.descripcion.trim() || undefined,
      };

      let eventId: string;

      if (isCreate) {
        const created = await api.post<ApiEvent>("/events", {
          ...payload,
          categoryIds: draft.categoryId ? [draft.categoryId] : undefined,
        });
        eventId = created.id;
      } else {
        if (!id) return;
        eventId = id;
        await api.patch<ApiEvent>(`/events/${eventId}`, payload);

        if (draft.categoryId !== originalCategoryId) {
          if (originalCategoryId) {
            await api.del(`/events/${eventId}/categories/${originalCategoryId}`).catch(() => {
              // Si ya no existía la asignación, no hay nada que limpiar.
            });
          }
          if (draft.categoryId) {
            await api.post(`/events/${eventId}/categories`, { categoryIds: [draft.categoryId] });
          }
        }
      }

      if (imageFile) {
        await uploadEventImage(API_BASE_URL, eventId, imageFile, user?.token);
      }

      toast.success(isCreate ? "Evento creado" : "Evento actualizado");
      navigate("/organizer/myEvents");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : "No se pudo guardar el evento";
      toast.danger(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-muted text-xs py-16 text-center">Cargando evento...</p>;
  }

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <p className="text-foreground font-semibold">Evento no encontrado</p>
        <p className="text-muted text-xs">Usa las migas de pan de arriba para volver a Mis Eventos.</p>
      </div>
    );
  }

  const title = isCreate ? "Crear Nuevo Evento" : "Editar Evento";
  const subtitle = isCreate ? "Configura los detalles de tu próximo gran evento." : "Modifica los detalles de tu evento.";

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
      <div>
        <h3>{title}</h3>
        <p className="text-muted text-xs mt-0.5">{subtitle}</p>
      </div>

      <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
        <p className="text-foreground font-bold text-sm">Imagen del evento</p>
        <label
          htmlFor="event-image-input"
          className="flex flex-col items-center justify-center gap-1.5 h-36 rounded-xl border-2 border-dashed border-border bg-background cursor-pointer overflow-hidden relative hover:border-foreground transition-colors"
        >
          {imagePreview ? (
            <img src={imagePreview} alt="preview" className="w-full h-full object-cover absolute inset-0" />
          ) : (
            <>
              <Icon.Upload className="text-muted size-5" />
              <span className="text-muted text-[11px]">Sube una imagen (JPEG, PNG, WEBP o GIF, máx. 5MB)</span>
            </>
          )}
        </label>
        <input id="event-image-input" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        {imageError && <p className="text-danger text-[11px]">{imageError}</p>}
      </section>

      <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
        <p className="text-foreground font-bold text-sm">Información general</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField isRequired name="nombre" className="sm:col-span-2">
            <Label>Nombre del Evento</Label>
            <Input placeholder="Ej: Festival de Verano 2024" value={draft.nombre} onChange={set("nombre")} />
          </TextField>

          <div>
            <Label>Recinto</Label>
            <select
              value={draft.venueId}
              onChange={(e) => setDraft((p) => ({ ...p, venueId: e.target.value }))}
              className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer"
            >
              <option value="">Selecciona un recinto</option>
              {venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label>Categoría</Label>
            <select
              value={draft.categoryId}
              onChange={(e) => setDraft((p) => ({ ...p, categoryId: e.target.value }))}
              className="mt-1 w-full bg-background border border-border rounded-[10px] text-foreground text-xs px-2.5 py-1.5 outline-none cursor-pointer"
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <TextField name="descripcion" className="sm:col-span-2">
            <Label>Descripción</Label>
            <Input placeholder="Describe los puntos clave del evento..." value={draft.descripcion} onChange={set("descripcion")} />
          </TextField>
        </div>
      </section>

      <section className="bg-surface border border-border rounded-[10px] p-4 flex flex-col gap-3">
        <p className="text-foreground font-bold text-sm">Fecha y hora</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <TextField isRequired name="fecha" type="date">
            <Label>Fecha</Label>
            <Input value={draft.fecha} onChange={set("fecha")} />
          </TextField>
          <TextField isRequired name="horaInicio" type="time">
            <Label>Hora de inicio</Label>
            <Input value={draft.horaInicio} onChange={set("horaInicio")} />
          </TextField>
          <TextField isRequired name="horaFin" type="time">
            <Label>Hora de fin</Label>
            <Input value={draft.horaFin} onChange={set("horaFin")} />
          </TextField>
        </div>
        {draft.horaInicio && draft.horaFin && !datesValid && (
          <p className="text-danger text-[11px]">La hora de fin debe ser posterior a la hora de inicio.</p>
        )}
      </section>

      <div className="flex gap-2 justify-end border-t border-border pt-3 pb-1">
        <Button size="sm" variant="secondary" onPress={() => navigate("/organizer/myEvents")} isDisabled={saving}>
          Cancelar
        </Button>
        <Button size="sm" onPress={handleSave} isDisabled={!canSave || saving}>
          <Icon.Check />
          {saving ? "Guardando..." : isCreate ? "Crear Evento" : "Guardar Cambios"}
        </Button>
      </div>
    </div>
  );
}
