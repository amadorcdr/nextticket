import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

    async findAll() {
        // 1) ¿está en caché?
        const cached = await this.redis.get<unknown[]>(LIST_CACHE_KEY);
        if (cached) return cached;

        // 2) no está → base de datos
        const users = await this.prisma.user.findMany();

        // 3) guarda para la próxima (30 segundos)
        await this.redis.set(LIST_CACHE_KEY, users, 30);
        return users;
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
