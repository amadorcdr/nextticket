import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';

const LIST_CACHE_KEY = 'purchases:list';

@Injectable()
export class PurchasesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async create(dto: CreatePurchaseDto) {
        const purchase = await this.prisma.purchase.create({ data: dto });
        await this.redis.del(LIST_CACHE_KEY); // la lista cambió → invalida
        return purchase;
    }

    async findAll() {
        // 1) ¿está en caché?
        const cached = await this.redis.get<unknown[]>(LIST_CACHE_KEY);
        if (cached) return cached;

        // 2) no está → base de datos
        const purchases = await this.prisma.purchase.findMany();

        // 3) guarda para la próxima (30 segundos)
        await this.redis.set(LIST_CACHE_KEY, purchases, 30);
        return purchases;
    }

    async findOne(id: string) {
        const purchase = await this.prisma.purchase.findUnique({ where: { id } });
        if (!purchase) throw new NotFoundException(`Purchase ${id} no existe`);
        return purchase;
    }

    async update(id: string, dto: UpdatePurchaseDto) {
        await this.findOne(id); // 404 si no existe
        const purchase = await this.prisma.purchase.update({ where: { id }, data: dto });
        await this.redis.del(LIST_CACHE_KEY);
        return purchase;
    }

    async remove(id: string) {
        await this.findOne(id);
        await this.prisma.purchase.delete({ where: { id } });
        await this.redis.del(LIST_CACHE_KEY);
        return { deleted: true };
    }
}
