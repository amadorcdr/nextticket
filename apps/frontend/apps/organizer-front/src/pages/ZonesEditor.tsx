import { useEffect, useMemo, useState } from "react";
import {
  ApiError,
  Button,
  CommercialEditor,
  Icon,
  ListBox,
  Select,
  toast,
  useApi,
  useSession,
  type CommercialEventState,
  type PhysicalVenueState,
} from "@nextticket-frontend/commons";
import { toPhysicalVenueState, type ApiVenueTree } from "@nextticket-frontend/venues-front";
import { toCommercialEventState, type ApiEvent, type ApiEventStatus, type ApiEventZoneDetail } from "../api";

const FETCH_LIMIT = 100;

interface Paginated<T> {
  data: T[];
}

interface EventOption {
  id: string;
  name: string;
  venueId: string;
  status: ApiEventStatus;
}

/*
 * Modelo de negocio (recordatorio para quien toque este archivo):
 * el ADMIN crea el recinto físico (secciones/asientos, en Recintos → editor
 * de canvas). El ORGANIZADOR, aquí, toma ese recinto ya existente y define
 * las zonas comerciales de SU evento sobre esas mismas secciones: precio,
 * aforo, y qué asientos vende. Por eso el canvas se carga en modo lectura
 * estructural (physical) + las zonas propias del evento (commercial).
 */
export function ZonesEditor() {
  const api = useApi();
  const { user } = useSession();

  const [events, setEvents] = useState<EventOption[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | undefined>(undefined);

  const [physical, setPhysical] = useState<PhysicalVenueState | null>(null);
  const [savedCommercial, setSavedCommercial] = useState<CommercialEventState | null>(null);
  const [localCommercial, setLocalCommercial] = useState<CommercialEventState | null>(null);
  const [canvasLoading, setCanvasLoading] = useState(false);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setEventsLoading(false);
      setEventsError("Tu sesión no tiene un id de usuario válido. Cierra sesión y vuelve a iniciarla.");
      return;
    }

    setEventsLoading(true);
    setEventsError(null);
    api
      .get<Paginated<ApiEvent>>(`/events?organizerId=${user.id}&limit=${FETCH_LIMIT}`)
      .then((res) => {
        // Un evento cancelado o finalizado ya no admite editar sus zonas
        // (ver isEditable más abajo): no tiene caso ni mostrarlo aquí, solo
        // ensucia el selector con eventos sobre los que no se puede hacer nada.
        const options = res.data
          .filter((ev) => ev.status !== "CANCELED" && ev.status !== "COMPLETED")
          .map((ev) => ({ id: ev.id, name: ev.name, venueId: ev.venueId, status: ev.status }));
        setEvents(options);
        setSelectedEventId((prev) => prev ?? options[0]?.id);
      })
      .catch((err) => setEventsError(err instanceof ApiError ? err.message : "No se pudieron cargar tus eventos"))
      .finally(() => setEventsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const selectedEvent = events.find((e) => e.id === selectedEventId);
  const isEditable = selectedEvent ? selectedEvent.status !== "CANCELED" && selectedEvent.status !== "COMPLETED" : false;

  useEffect(() => {
    if (!selectedEvent) return;

    setCanvasLoading(true);
    setCanvasError(null);
    setLocalCommercial(null);

    Promise.all([
      api.get<ApiVenueTree>(`/venues/${selectedEvent.venueId}`),
      api.get<ApiEventZoneDetail[]>(`/events/${selectedEvent.id}/zones`),
    ])
      .then(([venueTree, zones]) => {
        setPhysical(toPhysicalVenueState(venueTree));
        const commercial = toCommercialEventState(selectedEvent.id, selectedEvent.name, zones);
        setSavedCommercial(commercial);
        setLocalCommercial(commercial);
      })
      .catch((err) => setCanvasError(err instanceof ApiError ? err.message : "No se pudo cargar el recinto de este evento"))
      .finally(() => setCanvasLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEvent?.id, reloadTick]);

  const editorKey = useMemo(() => `${selectedEventId ?? "none"}-${reloadTick}`, [selectedEventId, reloadTick]);

  const saveCommercial = async () => {
    if (!selectedEvent || !localCommercial || !savedCommercial) return;
    setSaving(true);

    const errors: string[] = [];
    const savedZonesById = new Map(savedCommercial.zones.map((z) => [z.id, z]));
    const localZonesById = new Map(localCommercial.zones.map((z) => [z.id, z]));
    // Ids temporales del canvas ("zone_xxx") -> id real que el backend asigna
    // al crear la zona, para poder crear las etapas de precio que el usuario
    // le haya agregado a una zona nueva en la misma sesión de edición.
    const realZoneIdByLocalId = new Map<string, string>();
    const deletedZoneIds = new Set<string>();

    // 1. Zonas que ya no están localmente → se borran del backend (esto ya
    // se lleva sus etapas de precio entre manos, no hace falta borrarlas aparte).
    for (const savedZone of savedCommercial.zones) {
      if (localZonesById.has(savedZone.id)) continue;
      try {
        await api.del(`/events/${selectedEvent.id}/zones/${savedZone.id}`);
        deletedZoneIds.add(savedZone.id);
      } catch (err) {
        errors.push(`No se pudo borrar "${savedZone.publicName}": ${err instanceof ApiError ? err.message : "error desconocido"}`);
      }
    }

    // 2. Zonas nuevas o modificadas.
    for (const zone of localCommercial.zones) {
      const existing = savedZonesById.get(zone.id);

      if (!existing) {
        if (zone.sectionIds.length === 0) {
          errors.push(`"${zone.publicName}": asígnale al menos una sección en el canvas para poder guardarla.`);
          continue;
        }
        try {
          const created = await api.post<{ id: string }>(`/events/${selectedEvent.id}/zones`, {
            publicName: zone.publicName,
            admissionType: zone.admissionType,
            eventPrice: zone.eventPrice,
            mapColor: zone.mapColor ?? undefined,
            maxTicketsPerPurchase: zone.maxTicketsPerPurchase,
            status: zone.status,
            sectionIds: zone.sectionIds,
          });
          realZoneIdByLocalId.set(zone.id, created.id);
        } catch (err) {
          errors.push(`No se pudo crear "${zone.publicName}": ${err instanceof ApiError ? err.message : "error desconocido"}`);
        }
        continue;
      }

      const metaChanged =
        zone.publicName !== existing.publicName ||
        zone.eventPrice !== existing.eventPrice ||
        zone.mapColor !== existing.mapColor ||
        zone.admissionType !== existing.admissionType ||
        zone.maxTicketsPerPurchase !== existing.maxTicketsPerPurchase ||
        zone.status !== existing.status;

      if (metaChanged) {
        try {
          await api.patch(`/events/${selectedEvent.id}/zones/${zone.id}`, {
            publicName: zone.publicName,
            admissionType: zone.admissionType,
            eventPrice: zone.eventPrice,
            mapColor: zone.mapColor ?? undefined,
            maxTicketsPerPurchase: zone.maxTicketsPerPurchase,
            status: zone.status,
          });
        } catch (err) {
          errors.push(`No se pudo actualizar "${zone.publicName}": ${err instanceof ApiError ? err.message : "error desconocido"}`);
        }
      }

      const addedSections = zone.sectionIds.filter((id) => !existing.sectionIds.includes(id));
      const removedSections = existing.sectionIds.filter((id) => !zone.sectionIds.includes(id));

      if (addedSections.length > 0) {
        try {
          await api.post(`/events/${selectedEvent.id}/zones/${zone.id}/sections`, { sectionIds: addedSections });
        } catch (err) {
          errors.push(`No se pudieron agregar secciones a "${zone.publicName}": ${err instanceof ApiError ? err.message : "error desconocido"}`);
        }
      }

      for (const sectionId of removedSections) {
        try {
          await api.del(`/events/${selectedEvent.id}/zones/${zone.id}/sections/${sectionId}`);
        } catch (err) {
          errors.push(`No se pudo quitar una sección de "${zone.publicName}": ${err instanceof ApiError ? err.message : "error desconocido"}`);
        }
      }
    }

    // 3. Etapas de precio extra (sortOrder > 0 — la 0 es la "Regular" que ya
    // se maneja junto con eventPrice de la zona, arriba).
    const savedTiersById = new Map(savedCommercial.priceTiers.map((t) => [t.id, t]));
    const localTierIds = new Set(localCommercial.priceTiers.map((t) => t.id));
    // Zonas que sí existen en el backend a este punto (ya existían, o se
    // acaban de crear arriba) — una zona nueva sin secciones nunca llegó a
    // crearse, así que sus etapas tampoco tienen dónde crearse.
    const existingZoneIds = new Set([...savedZonesById.keys(), ...realZoneIdByLocalId.values()]);

    for (const tier of savedCommercial.priceTiers) {
      if (tier.sortOrder === 0 || deletedZoneIds.has(tier.eventZoneId) || localTierIds.has(tier.id)) continue;
      try {
        await api.del(`/events/${selectedEvent.id}/zones/${tier.eventZoneId}/price-tiers/${tier.id}`);
      } catch (err) {
        errors.push(`No se pudo borrar la etapa "${tier.name}": ${err instanceof ApiError ? err.message : "error desconocido"}`);
      }
    }

    for (const tier of localCommercial.priceTiers) {
      if (tier.sortOrder === 0) continue;
      const realZoneId = realZoneIdByLocalId.get(tier.eventZoneId) ?? tier.eventZoneId;
      if (deletedZoneIds.has(realZoneId)) continue;

      const payload = {
        name: tier.name,
        price: tier.price,
        initialCapacity: tier.initialCapacity ?? undefined,
        startsAt: tier.startsAt ?? undefined,
        endsAt: tier.endsAt ?? undefined,
        sortOrder: tier.sortOrder,
        status: tier.status,
      };

      const existingTier = savedTiersById.get(tier.id);
      try {
        if (!existingTier) {
          if (!existingZoneIds.has(realZoneId)) continue;
          await api.post(`/events/${selectedEvent.id}/zones/${realZoneId}/price-tiers`, payload);
        } else {
          const changed =
            tier.name !== existingTier.name ||
            tier.price !== existingTier.price ||
            tier.initialCapacity !== existingTier.initialCapacity ||
            tier.startsAt !== existingTier.startsAt ||
            tier.endsAt !== existingTier.endsAt ||
            tier.sortOrder !== existingTier.sortOrder ||
            tier.status !== existingTier.status;
          if (changed) {
            await api.patch(`/events/${selectedEvent.id}/zones/${realZoneId}/price-tiers/${tier.id}`, payload);
          }
        }
      } catch (err) {
        errors.push(`No se pudo guardar la etapa "${tier.name}": ${err instanceof ApiError ? err.message : "error desconocido"}`);
      }
    }

    // 4. Asientos ya existentes que cambiaron de estado (habilitar/deshabilitar).
    // Los de zonas recién creadas no se tocan aquí: el backend los genera al
    // asignar las secciones y quedan disponibles; el recargar tras guardar los trae.
    const savedSeatStatusById = new Map(savedCommercial.eventSeats.map((es) => [es.id, es.status]));
    for (const seat of localCommercial.eventSeats) {
      const prevStatus = savedSeatStatusById.get(seat.id);
      if (prevStatus && prevStatus !== seat.status) {
        try {
          await api.patch(`/events/${selectedEvent.id}/seats/${seat.seatId}`, { status: seat.status });
        } catch (err) {
          errors.push(`No se pudo actualizar un asiento: ${err instanceof ApiError ? err.message : "error desconocido"}`);
        }
      }
    }

    setSaving(false);

    if (errors.length > 0) {
      toast.danger(errors.length === 1 ? errors[0] : `${errors[0]} (+${errors.length - 1} más)`);
    } else {
      toast.success("Zonas guardadas");
    }

    // Siempre se recarga desde el backend: es la única forma de que el canvas
    // refleje ids reales (zonas/asientos recién creados) y no un estado local
    // a medias si algo falló.
    setReloadTick((t) => t + 1);
  };

  return (
    <div className="h-full w-full flex flex-col gap-2">
      {/* Selector de evento + guardar */}
      <div className="flex items-center justify-between gap-3 px-2 pt-2 shrink-0">
        <Select
          className="w-fit"
          aria-label="Evento"
          value={selectedEventId}
          onChange={(v) => v && setSelectedEventId(v as string)}
          isDisabled={eventsLoading || events.length === 0}
        >
          <Select.Trigger>
            <div className="flex items-center gap-2">
              <Icon.Calendar className="shrink-0 size-3.5" />
              <Select.Value className="line-clamp-1 max-w-60 text-xs">
                {() => events.find((e) => e.id === selectedEventId)?.name ?? "Sin eventos"}
              </Select.Value>
            </div>
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {events.map((e) => (
                <ListBox.Item key={e.id} id={e.id} textValue={e.name}>
                  {e.name}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        {selectedEvent && (
          <Button size="sm" onPress={saveCommercial} isDisabled={!isEditable || saving || canvasLoading || !localCommercial}>
            <Icon.Save />
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        )}
      </div>

      {!isEditable && selectedEvent && (
        <p className="text-muted text-xs px-2">
          Este evento está {selectedEvent.status === "CANCELED" ? "cancelado" : "finalizado"}: sus zonas ya no se pueden modificar.
        </p>
      )}

      {eventsLoading && <p className="text-muted text-xs py-8 text-center">Cargando tus eventos...</p>}

      {!eventsLoading && eventsError && <p className="text-muted text-xs py-8 text-center">{eventsError}</p>}

      {!eventsLoading && !eventsError && events.length === 0 && (
        <p className="text-muted text-xs py-8 text-center">
          No tienes eventos activos. Crea uno en "Mis Eventos" para configurar sus zonas aquí (los eventos cancelados
          o finalizados ya no aparecen).
        </p>
      )}

      {!eventsLoading && !eventsError && events.length > 0 && canvasLoading && (
        <p className="text-muted text-xs py-8 text-center">Cargando recinto y zonas...</p>
      )}

      {!eventsLoading && !eventsError && events.length > 0 && !canvasLoading && canvasError && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-muted text-xs text-center">{canvasError}</p>
          <Button size="sm" onPress={() => setReloadTick((t) => t + 1)}>
            Reintentar
          </Button>
        </div>
      )}

      {!eventsLoading && !canvasLoading && !canvasError && physical && localCommercial && (
        <div className="flex-1 min-h-0">
          <CommercialEditor key={editorKey} physical={physical} initialCommercial={localCommercial} onChange={setLocalCommercial} />
        </div>
      )}
    </div>
  );
}
