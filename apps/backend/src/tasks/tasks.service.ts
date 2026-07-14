import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

const LIST_CACHE_KEY = 'tasks:list';

@Injectable()
export class TasksService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) { }

    async create(dto: CreateTaskDto) {
        const task = await this.prisma.task.create({ data: dto });
        await this.redis.del(LIST_CACHE_KEY); // la lista cambió → invalida
        return task;
    }

    async findAll() {
        // 1) ¿está en caché?
        const cached = await this.redis.get<unknown[]>(LIST_CACHE_KEY);
        if (cached) return cached;

        // 2) no está → base de datos
        const tasks = await this.prisma.task.findMany({
            orderBy: { createdAt: 'desc' },
        });

        // 3) guarda para la próxima (30 segundos)
        await this.redis.set(LIST_CACHE_KEY, tasks, 30);
        return tasks;
    }

    async findOne(id: string) {
        const task = await this.prisma.task.findUnique({ where: { id } });
        if (!task) throw new NotFoundException(`Task ${id} no existe`);
        return task;
    }

    async update(id: string, dto: UpdateTaskDto) {
        await this.findOne(id); // 404 si no existe
        const task = await this.prisma.task.update({ where: { id }, data: dto });
        await this.redis.del(LIST_CACHE_KEY);
        return task;
    }

    async remove(id: string) {
        await this.findOne(id);
        await this.prisma.task.delete({ where: { id } });
        await this.redis.del(LIST_CACHE_KEY);
        return { deleted: true };
    }
}