import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

const LIST_CACHE_KEY = 'tickets:list';

@Injectable()
export class TicketsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async create(dto: CreateTicketDto) {
        const ticket = await this.prisma.ticket.create({ data: dto });
        await this.redis.del(LIST_CACHE_KEY); // la lista cambió → invalida
        return ticket;
    }

    async findAll() {
        // 1) ¿está en caché?
        const cached = await this.redis.get<unknown[]>(LIST_CACHE_KEY);
        if (cached) return cached;

        // 2) no está → base de datos
        const tickets = await this.prisma.ticket.findMany();

        // 3) guarda para la próxima (30 segundos)
        await this.redis.set(LIST_CACHE_KEY, tickets, 30);
        return tickets;
    }

    async findOne(id: string) {
        const ticket = await this.prisma.ticket.findUnique({ where: { id } });
        if (!ticket) throw new NotFoundException(`Ticket ${id} no existe`);
        return ticket;
    }

    async update(id: string, dto: UpdateTicketDto) {
        await this.findOne(id); // 404 si no existe
        const ticket = await this.prisma.ticket.update({ where: { id }, data: dto });
        await this.redis.del(LIST_CACHE_KEY);
        return ticket;
    }

    async remove(id: string) {
        await this.findOne(id);
        await this.prisma.ticket.delete({ where: { id } });
        await this.redis.del(LIST_CACHE_KEY);
        return { deleted: true };
    }
}
