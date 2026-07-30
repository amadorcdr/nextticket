import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
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
const CLIENT_ROLE_NAME = 'CLIENT';

const USER_PUBLIC_SELECT = {
  id: true,
  createdAt: true,
  createdBy: true,
  lastModifiedBy: true,
  status: true,
  updatedAt: true,
  name: true,
  email: true,
  roleId: true,
  provider: true,
  providerId: true,
  role: {
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
    },
  },
} as const;

type PublicUser = Awaited<ReturnType<UsersService['findPublicById']>>;

/** P2002 es la violacion de indice unico de Prisma. */
function isUniqueConstraintError(error: unknown, field: string) {
  const known = error as { code?: string; meta?: { target?: unknown } };
  if (known?.code !== 'P2002') return false;

  const target = known.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  return typeof target === 'string' ? target.includes(field) : true;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async ensureDefaultRoles() {
    await this.prisma.role.upsert({
      where: { name: CLIENT_ROLE_NAME },
      update: {},
      create: {
        id: '11111111-1111-4111-8111-111111111111',
        name: CLIENT_ROLE_NAME,
        description: 'Cliente',
      },
    });

    await this.prisma.role.upsert({
      where: { name: 'ORGANIZER' },
      update: {},
      create: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'ORGANIZER',
        description: 'Organizador',
      },
    });

    await this.prisma.role.upsert({
      where: { name: 'VALIDATOR' },
      update: {},
      create: {
        id: '33333333-3333-4333-8333-333333333333',
        name: 'VALIDATOR',
        description: 'Validador',
      },
    });
  }

  async create(dto: CreateUserDto) {
    return this.createLocalUser(dto);
  }

  async createLocalUser(dto: CreateUserDto, createdBy?: string | null) {
    const role = await this.resolveRole(dto.roleId);
    const password = await hash(dto.password, 10);

    let user: PublicUser;
    try {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password,
          roleId: role.id,
          provider: 'LOCAL',
          providerId: null,
          createdBy: createdBy ?? null,
          lastModifiedBy: createdBy ?? null,
        },
        select: USER_PUBLIC_SELECT,
      });
    } catch (error) {
      // Sin esto, registrar un correo repetido devuelve un 500 de Prisma.
      if (isUniqueConstraintError(error, 'email')) {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }

    await this.redis.del(LIST_CACHE_KEY);
    return user;
  }

  async upsertOAuthUser(input: {
    name: string;
    email: string;
    provider: string;
    providerId: string;
    createdBy?: string | null;
  }) {
    const role = await this.resolveRole();
    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    const user = existingByEmail
      ? await this.prisma.user.update({
          where: { email: input.email },
          data: {
            provider: input.provider,
            providerId: input.providerId,
            lastModifiedBy: input.createdBy ?? null,
            roleId: existingByEmail.roleId ?? role.id,
          },
          select: USER_PUBLIC_SELECT,
        })
      : await this.prisma.user.create({
          data: {
            name: input.name,
            email: input.email,
            password: null,
            roleId: role.id,
            provider: input.provider,
            providerId: input.providerId,
            createdBy: input.createdBy ?? null,
            lastModifiedBy: input.createdBy ?? null,
          },
          select: USER_PUBLIC_SELECT,
        });

    await this.redis.del(LIST_CACHE_KEY);
    return user;
  }

  async findByEmailForAuth(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: { role: true },
    });
  }

  async findByProviderForAuth(provider: string, providerId: string) {
    return this.prisma.user.findFirst({
      where: { provider, providerId },
      include: { role: true },
    });
  }

  async findPublicById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_PUBLIC_SELECT,
    });
    if (!user) throw new NotFoundException(`User ${id} no existe`);
    return user;
  }

  async findAll(pagination: PaginationQueryDto) {
    const useCache = isCacheablePage(pagination);

    if (useCache) {
      const cached = await this.redis.get<PaginatedResponseDto<PublicUser>>(LIST_CACHE_KEY);
      if (cached) return cached;
    }

    const { skip, take } = toPrismaPagination(pagination);
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: USER_PUBLIC_SELECT,
      }),
      this.prisma.user.count(),
    ]);

    const response = buildPaginatedResponse(users, total, pagination);

    if (useCache) await this.redis.set(LIST_CACHE_KEY, response, 30);
    return response;
  }

  async findOne(id: string) {
    return this.findPublicById(id);
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findPublicById(id);

    const data: Record<string, unknown> = {
      name: dto.name,
      email: dto.email,
      roleId: dto.roleId,
    };

    if (dto.password) {
      data.password = await hash(dto.password, 10);
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_PUBLIC_SELECT,
    });

    await this.redis.del(LIST_CACHE_KEY);
    return user;
  }

  async remove(id: string) {
    await this.findPublicById(id);
    await this.prisma.user.delete({ where: { id } });
    await this.redis.del(LIST_CACHE_KEY);
    return { deleted: true };
  }

  private async resolveRole(roleId?: string) {
    if (roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: roleId } });
      if (!role) {
        throw new NotFoundException(`Role ${roleId} no existe`);
      }

      return role;
    }

    const role = await this.prisma.role.findUnique({
      where: { name: CLIENT_ROLE_NAME },
    });

    if (!role) {
      throw new NotFoundException('Default client role does not exist');
    }

    return role;
  }
}