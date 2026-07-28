import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
    buildPaginatedResponse,
    isCacheablePage,
    toPrismaPagination,
} from '../common/pagination.helper';

const LIST_CACHE_KEY = 'users:list';

@Injectable()
export class UsersService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async create(dto: CreateUserDto) {
        const user = await this.prisma.user.create({ data: dto });
        await this.redis.del(LIST_CACHE_KEY); // la lista cambió → invalida
        return user;
    }

    async findAll(pagination: PaginationQueryDto) {
        // Solo la página por defecto usa caché: es la única que cabe en la
        // llave única que ya invalidan create/update/remove.
        const useCache = isCacheablePage(pagination);

        // 1) ¿está en caché?
        if (useCache) {
            const cached =
                await this.redis.get<PaginatedResponseDto<unknown>>(LIST_CACHE_KEY);
            if (cached) return cached;
        }

        // 2) no está → base de datos
        const { skip, take } = toPrismaPagination(pagination);
        const [users, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                skip,
                take,
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.user.count(),
        ]);

        const response = buildPaginatedResponse(users, total, pagination);

        // 3) guarda para la próxima (30 segundos)
        if (useCache) await this.redis.set(LIST_CACHE_KEY, response, 30);
        return response;
    }

    async findOne(id: string) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) throw new NotFoundException(`User ${id} no existe`);
        return user;
    }

    async update(id: string, dto: UpdateUserDto) {
        await this.findOne(id); // 404 si no existe
        const user = await this.prisma.user.update({ where: { id }, data: dto });
        await this.redis.del(LIST_CACHE_KEY);
        return user;
    }

    async remove(id: string) {
        await this.findOne(id);
        await this.prisma.user.delete({ where: { id } });
        await this.redis.del(LIST_CACHE_KEY);
        return { deleted: true };
    }
}
