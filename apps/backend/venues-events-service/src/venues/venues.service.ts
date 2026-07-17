import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateVenueDto } from './dto/create-venue.dto';
import { UpdateVenueDto } from './dto/update-venue.dto';

const LIST_CACHE_KEY = 'venues:list';

@Injectable()
export class VenuesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async create(dto: CreateVenueDto) {
    const venue = await this.prisma.venue.create({
        data: {
        name: dto.name,
        address: dto.address,
        city: dto.city,
        state: dto.state,
        country: dto.country ?? 'Mexico',
        totalCapacity: dto.totalCapacity,
        description: dto.description,
        status: dto.status,
        },
    });

    await this.redis.del(LIST_CACHE_KEY);

    return venue;
    }

    async findAll() {
        // 1) ¿está en caché?
        const cached = await this.redis.get<unknown[]>(LIST_CACHE_KEY);
        if (cached) return cached;

        // 2) no está → base de datos
        const venues = await this.prisma.venue.findMany();

        // 3) guarda para la próxima (30 segundos)
        await this.redis.set(LIST_CACHE_KEY, venues, 30);
        return venues;
    }

    async findOne(id: string) {
        const venue = await this.prisma.venue.findUnique({ where: { id } });
        if (!venue) throw new NotFoundException(`Venue ${id} no existe`);
        return venue;
    }

    async update(id: string, dto: UpdateVenueDto) {
        await this.findOne(id);

        const venue = await this.prisma.venue.update({
            where: { id },
            data: dto,
        });

        await this.redis.del(LIST_CACHE_KEY);

        return venue;
    }

    async remove(id: string) {
        await this.findOne(id);
        await this.prisma.venue.delete({ where: { id } });
        await this.redis.del(LIST_CACHE_KEY);
        return { deleted: true };
    }
}
