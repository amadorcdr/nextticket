import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventCategoryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { CreateEventCategoryDto } from './dto/create-event-category.dto';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto';

const CATEGORIES_LIST_CACHE_KEY = 'event-categories:list';

function isPrismaKnownError(
  error: unknown,
): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error
  );
}

@Injectable()
export class EventCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateEventCategoryDto) {
    try {
      const category =
        await this.prisma.eventCategory.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            status:
              dto.status ?? EventCategoryStatus.ACTIVE,
          },
        });

      await this.invalidateCache();

      return category;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async findAll() {
    const cached =
      await this.redis.get<unknown[]>(
        CATEGORIES_LIST_CACHE_KEY,
      );

    if (cached) {
      return cached;
    }

    const categories =
      await this.prisma.eventCategory.findMany({
        orderBy: {
          name: 'asc',
        },
      });

    await this.redis.set(
      CATEGORIES_LIST_CACHE_KEY,
      categories,
      60,
    );

    return categories;
  }

  async findOne(id: string) {
    const category =
      await this.prisma.eventCategory.findUnique({
        where: {
          id,
        },
        include: {
          events: {
            include: {
              event: {
                select: {
                  id: true,
                  name: true,
                  startsAt: true,
                  endsAt: true,
                  status: true,
                },
              },
            },
          },
        },
      });

    if (!category) {
      throw new NotFoundException(
        `EventCategory ${id} no existe`,
      );
    }

    return category;
  }

  async update(
    id: string,
    dto: UpdateEventCategoryDto,
  ) {
    await this.ensureExists(id);

    try {
      const category =
        await this.prisma.eventCategory.update({
          where: {
            id,
          },
          data: {
            name: dto.name,
            slug: dto.slug,
            description: dto.description,
            status: dto.status,
          },
        });

      await this.invalidateCache(id);

      return category;
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async remove(id: string) {
    const category = await this.ensureExists(id);

    const assignmentsCount =
      await this.prisma.eventCategoryAssignment.count({
        where: {
          categoryId: id,
        },
      });

    if (assignmentsCount > 0) {
      throw new ConflictException(
        'No se puede eliminar una categoría asignada a uno o más eventos',
      );
    }

    await this.prisma.eventCategory.delete({
      where: {
        id,
      },
    });

    await this.invalidateCache(id);

    return {
      deleted: true,
      category,
    };
  }

  private async ensureExists(id: string) {
    const category =
      await this.prisma.eventCategory.findUnique({
        where: {
          id,
        },
      });

    if (!category) {
      throw new NotFoundException(
        `EventCategory ${id} no existe`,
      );
    }

    return category;
  }

  private async invalidateCache(id?: string) {
    await this.redis.del(
      CATEGORIES_LIST_CACHE_KEY,
    );

    if (id) {
      await this.redis.del(
        `event-categories:${id}`,
      );
    }

    await this.redis.del('events:list');
    await this.redis.del('catalog:events');
  }

  private handlePrismaError(error: unknown): never {
    if (isPrismaKnownError(error)) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Ya existe una categoría con ese nombre o slug',
        );
      }

      if (error.code === 'P2025') {
        throw new NotFoundException(
          'Categoría no encontrada',
        );
      }
    }

    throw error;
  }
}