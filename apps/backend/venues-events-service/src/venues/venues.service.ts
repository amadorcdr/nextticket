import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateVenueDto } from '../dto/venues/create-venue.dto';
import { UpdateVenueDto } from '../dto/venues/update-venue.dto';
import { CreateFloorDto } from '../dto/floors/create-floor.dto';
import { UpdateFloorDto } from '../dto/floors/update-floor.dto';
import { CreateSectionDto } from '../dto/sections/create-section.dto';
import { UpdateSectionDto } from '../dto/sections/update-section.dto';
import { CreateSeatDto } from '../dto/seats/create-seat.dto';
import { UpdateSeatDto } from '../dto/seats/update-seat.dto';
import { CreateCanvasElementDto } from '../dto/canvas-elements/create-canvas-element.dto';
import { UpdateCanvasElementDto } from '../dto/canvas-elements/update-canvas-element.dto';

// ─── Cache keys ──────────────────────────────────────────────
const VENUES_LIST_KEY = 'venues:list';
const venueDetailKey = (id: string) => `venues:${id}`;

// ─── Prisma include para árbol completo del venue ────────────
const VENUE_FULL_INCLUDE = {
  floors: {
    orderBy: { levelIndex: 'asc' as const },
    include: {
      sections: {
        include: { seats: true },
      },
      canvasElements: true,
    },
  },
};

/** Type guard para errores conocidos de Prisma */
function isPrismaKnownError(
  err: unknown,
): err is { code: string; meta?: Record<string, unknown> } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string'
  );
}

@Injectable()
export class VenuesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  // ═══════════════════════════════════════════════════════════
  //  VENUES
  // ═══════════════════════════════════════════════════════════

  async createVenue(dto: CreateVenueDto) {
    try {
      const venue = await this.prisma.venue.create({
        data: { ...dto, createdAt: new Date() },
        include: VENUE_FULL_INCLUDE,
      });
      await this.invalidateVenueCache();
      return venue;
    } catch (err) {
      this.handlePrismaError(err, 'Venue');
    }
  }

  async findAllVenues() {
    const cached = await this.redis.get<unknown[]>(VENUES_LIST_KEY);
    if (cached) return cached;

    const venues = await this.prisma.venue.findMany({
      include: VENUE_FULL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    await this.redis.set(VENUES_LIST_KEY, venues, 30);
    return venues;
  }

  async findOneVenue(id: string) {
    const cacheKey = venueDetailKey(id);
    const cached = await this.redis.get(cacheKey);
    if (cached) return cached;

    const venue = await this.prisma.venue.findUnique({
      where: { id },
      include: VENUE_FULL_INCLUDE,
    });
    if (!venue) throw new NotFoundException(`Venue ${id} no existe`);

    await this.redis.set(cacheKey, venue, 60);
    return venue;
  }

  async updateVenue(id: string, dto: UpdateVenueDto) {
    await this.ensureVenueExists(id);
    try {
      const venue = await this.prisma.venue.update({
        where: { id },
        data: { ...dto, updatedAt: new Date() },
        include: VENUE_FULL_INCLUDE,
      });
      await this.invalidateVenueCache(id);
      return venue;
    } catch (err) {
      this.handlePrismaError(err, 'Venue');
    }
  }

  async removeVenue(id: string) {
    await this.ensureVenueExists(id);

    // Eliminación en cascada usando transacción: seats → sections → canvasElements → floors → venue
    await this.prisma.$transaction(async (tx) => {
      // 1. Eliminar seats de todas las secciones del venue
      await tx.seat.deleteMany({
        where: { section: { venueId: id } },
      });
      // 2. Eliminar secciones del venue
      await tx.section.deleteMany({ where: { venueId: id } });
      // 3. Eliminar canvas elements de los pisos del venue
      await tx.canvasElement.deleteMany({
        where: { floor: { venueId: id } },
      });
      // 4. Eliminar pisos del venue
      await tx.floor.deleteMany({ where: { venueId: id } });
      // 5. Eliminar el venue
      await tx.venue.delete({ where: { id } });
    });

    await this.invalidateVenueCache(id);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  FLOORS
  // ═══════════════════════════════════════════════════════════

  async createFloor(venueId: string, dto: CreateFloorDto) {
    await this.ensureVenueExists(venueId);
    try {
      const floor = await this.prisma.floor.create({
        data: { ...dto, venueId },
        include: { sections: true, canvasElements: true },
      });
      await this.invalidateVenueCache(venueId);
      return floor;
    } catch (err) {
      this.handlePrismaError(err, 'Floor');
    }
  }

  async findAllFloors(venueId: string) {
    await this.ensureVenueExists(venueId);
    return this.prisma.floor.findMany({
      where: { venueId },
      orderBy: { levelIndex: 'asc' },
      include: {
        sections: { include: { seats: true } },
        canvasElements: true,
      },
    });
  }

  async findOneFloor(floorId: string) {
    const floor = await this.prisma.floor.findUnique({
      where: { id: floorId },
      include: {
        sections: { include: { seats: true } },
        canvasElements: true,
      },
    });
    if (!floor) throw new NotFoundException(`Floor ${floorId} no existe`);
    return floor;
  }

  async updateFloor(floorId: string, dto: UpdateFloorDto) {
    const floor = await this.findOneFloor(floorId);
    try {
      const updated = await this.prisma.floor.update({
        where: { id: floorId },
        data: dto,
        include: { sections: true, canvasElements: true },
      });
      await this.invalidateVenueCache(floor.venueId);
      return updated;
    } catch (err) {
      this.handlePrismaError(err, 'Floor');
    }
  }

  async removeFloor(floorId: string) {
    const floor = await this.findOneFloor(floorId);

    await this.prisma.$transaction(async (tx) => {
      // Eliminar seats de las secciones de este piso
      await tx.seat.deleteMany({
        where: { section: { floorId } },
      });
      await tx.section.deleteMany({ where: { floorId } });
      await tx.canvasElement.deleteMany({ where: { floorId } });
      await tx.floor.delete({ where: { id: floorId } });
    });

    await this.invalidateVenueCache(floor.venueId);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  SECTIONS
  // ═══════════════════════════════════════════════════════════

  async createSection(venueId: string, floorId: string, dto: CreateSectionDto) {
    const floor = await this.ensureFloorBelongsToVenue(floorId, venueId);
    try {
      const section = await this.prisma.section.create({
        data: { ...dto, venueId, floorId },
        include: { seats: true },
      });
      await this.invalidateVenueCache(venueId);
      return section;
    } catch (err) {
      this.handlePrismaError(err, 'Section');
    }
  }

  async findAllSections(venueId: string, floorId: string) {
    await this.ensureFloorBelongsToVenue(floorId, venueId);
    return this.prisma.section.findMany({
      where: { floorId, venueId },
      include: { seats: true },
    });
  }

  async findOneSection(sectionId: string) {
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
      include: { seats: true },
    });
    if (!section) throw new NotFoundException(`Section ${sectionId} no existe`);
    return section;
  }

  async updateSection(sectionId: string, dto: UpdateSectionDto) {
    const section = await this.findOneSection(sectionId);
    try {
      const updated = await this.prisma.section.update({
        where: { id: sectionId },
        data: { ...dto },
        include: { seats: true },
      });
      await this.invalidateVenueCache(section.venueId);
      return updated;
    } catch (err) {
      this.handlePrismaError(err, 'Section');
    }
  }

  async removeSection(sectionId: string) {
    const section = await this.findOneSection(sectionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.seat.deleteMany({ where: { sectionId } });
      await tx.section.delete({ where: { id: sectionId } });
    });

    await this.invalidateVenueCache(section.venueId);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  SEATS
  // ═══════════════════════════════════════════════════════════

  async createSeat(venueId: string, floorId: string, sectionId: string, dto: CreateSeatDto) {
    await this.ensureSectionBelongsToChain(sectionId, floorId, venueId);
    try {
      const seat = await this.prisma.seat.create({
        data: { ...dto, sectionId },
      });
      await this.invalidateVenueCache(venueId);
      return seat;
    } catch (err) {
      this.handlePrismaError(err, 'Seat');
    }
  }

  async findAllSeats(venueId: string, floorId: string, sectionId: string) {
    await this.ensureSectionBelongsToChain(sectionId, floorId, venueId);
    return this.prisma.seat.findMany({
      where: { sectionId },
    });
  }

  async findOneSeat(seatId: string) {
    const seat = await this.prisma.seat.findUnique({
      where: { id: seatId },
      include: { section: true },
    });
    if (!seat) throw new NotFoundException(`Seat ${seatId} no existe`);
    return seat;
  }

  async updateSeat(seatId: string, dto: UpdateSeatDto) {
    const seat = await this.findOneSeat(seatId);
    try {
      const updated = await this.prisma.seat.update({
        where: { id: seatId },
        data: dto,
      });
      await this.invalidateVenueCache(seat.section.venueId);
      return updated;
    } catch (err) {
      this.handlePrismaError(err, 'Seat');
    }
  }

  async removeSeat(seatId: string) {
    const seat = await this.findOneSeat(seatId);
    await this.prisma.seat.delete({ where: { id: seatId } });
    await this.invalidateVenueCache(seat.section.venueId);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  CANVAS ELEMENTS
  // ═══════════════════════════════════════════════════════════

  async createCanvasElement(venueId: string, floorId: string, dto: CreateCanvasElementDto) {
    await this.ensureFloorBelongsToVenue(floorId, venueId);
    try {
      const element = await this.prisma.canvasElement.create({
        data: { ...dto, floorId },
      });
      await this.invalidateVenueCache(venueId);
      return element;
    } catch (err) {
      this.handlePrismaError(err, 'CanvasElement');
    }
  }

  async findAllCanvasElements(venueId: string, floorId: string) {
    await this.ensureFloorBelongsToVenue(floorId, venueId);
    return this.prisma.canvasElement.findMany({
      where: { floorId },
    });
  }

  async findOneCanvasElement(elementId: string) {
    const element = await this.prisma.canvasElement.findUnique({
      where: { id: elementId },
      include: { floor: true },
    });
    if (!element) throw new NotFoundException(`CanvasElement ${elementId} no existe`);
    return element;
  }

  async updateCanvasElement(elementId: string, dto: UpdateCanvasElementDto) {
    const element = await this.findOneCanvasElement(elementId);
    try {
      const updated = await this.prisma.canvasElement.update({
        where: { id: elementId },
        data: dto,
      });
      await this.invalidateVenueCache(element.floor.venueId);
      return updated;
    } catch (err) {
      this.handlePrismaError(err, 'CanvasElement');
    }
  }

  async removeCanvasElement(elementId: string) {
    const element = await this.findOneCanvasElement(elementId);
    await this.prisma.canvasElement.delete({ where: { id: elementId } });
    await this.invalidateVenueCache(element.floor.venueId);
    return { deleted: true };
  }

  // ═══════════════════════════════════════════════════════════
  //  HELPERS PRIVADOS
  // ═══════════════════════════════════════════════════════════

  /** Verifica que un venue exista o lanza 404 */
  private async ensureVenueExists(venueId: string) {
    const venue = await this.prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new NotFoundException(`Venue ${venueId} no existe`);
    return venue;
  }

  /** Verifica que un floor exista Y pertenezca al venue indicado */
  private async ensureFloorBelongsToVenue(floorId: string, venueId: string) {
    const floor = await this.prisma.floor.findUnique({ where: { id: floorId } });
    if (!floor) throw new NotFoundException(`Floor ${floorId} no existe`);
    if (floor.venueId !== venueId) {
      throw new BadRequestException(
        `Floor ${floorId} no pertenece al Venue ${venueId}`,
      );
    }
    return floor;
  }

  /** Verifica la cadena completa: section → floor → venue */
  private async ensureSectionBelongsToChain(
    sectionId: string,
    floorId: string,
    venueId: string,
  ) {
    await this.ensureFloorBelongsToVenue(floorId, venueId);
    const section = await this.prisma.section.findUnique({
      where: { id: sectionId },
    });
    if (!section) throw new NotFoundException(`Section ${sectionId} no existe`);
    if (section.floorId !== floorId) {
      throw new BadRequestException(
        `Section ${sectionId} no pertenece al Floor ${floorId}`,
      );
    }
    if (section.venueId !== venueId) {
      throw new BadRequestException(
        `Section ${sectionId} no pertenece al Venue ${venueId}`,
      );
    }
    return section;
  }

  /** Invalida tanto la lista general como el detalle individual */
  private async invalidateVenueCache(venueId?: string) {
    await this.redis.del(VENUES_LIST_KEY);
    if (venueId) {
      await this.redis.del(venueDetailKey(venueId));
    }
  }

  /** Manejo centralizado de errores de Prisma (unique constraint, FK, etc.) */
  private handlePrismaError(err: unknown, entity: string): never {
    if (isPrismaKnownError(err)) {
      // P2002: Unique constraint violation
      if (err.code === 'P2002') {
        const meta = err.meta ?? {};
        const fields = Array.isArray(meta.target)
          ? (meta.target as string[]).join(', ')
          : null;
        const constraint = typeof meta.constraint === 'string'
          ? meta.constraint
          : null;
        const detail = fields ?? constraint ?? 'campos únicos';
        throw new ConflictException(
          `${entity}: ya existe un registro con esos valores (${detail})`,
        );
      }
      // P2003: Foreign key constraint failed
      if (err.code === 'P2003') {
        throw new BadRequestException(
          `${entity}: referencia a un registro que no existe`,
        );
      }
      // P2025: Record not found for update/delete
      if (err.code === 'P2025') {
        throw new NotFoundException(`${entity} no encontrado`);
      }
    }
    throw err;
  }
}
