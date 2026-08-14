import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ActivationService } from '../activation/activation.service';
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
  accountStatus: true,
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
    private readonly activation: ActivationService,
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

    await this.prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: {
        id: '44444444-4444-4444-8444-444444444444',
        name: 'ADMIN',
        description: 'Administrador',
      },
    });
  }

  /**
   * Alta administrativa: crea al usuario como PENDING (sin contraseña) y
   * dispara el correo de activación. Es el mismo camino que usa el
   * autorregistro de Cliente (ver AuthService.register) — la única
   * diferencia entre roles es quién llama a este método.
   */
  async create(dto: CreateUserDto, createdBy?: string | null) {
    const user = await this.createLocalUser(dto, createdBy);
    await this.activation.issueAndSendActivation(user);
    return user;
  }

  /** Crea la cuenta local en estado PENDING; nunca recibe ni guarda contraseña. */
  async createLocalUser(
    dto: { name: string; email: string; roleId?: string },
    createdBy?: string | null,
  ) {
    const role = await this.resolveRole(dto.roleId);

    let user: PublicUser;
    try {
      user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: null,
          accountStatus: 'PENDING',
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

  /**
   * Cierra el flujo de activación: hashea la contraseña que eligió el
   * propio usuario y pasa la cuenta de PENDING a ACTIVE. El token que
   * autoriza esta llamada ya se validó y consumió en ActivationService.
   */
  async setPasswordAndActivate(id: string, password: string) {
    const hashed = await hash(password, 10);

    const user = await this.prisma.user.update({
      where: { id },
      data: { password: hashed, accountStatus: 'ACTIVE' },
      select: USER_PUBLIC_SELECT,
    });

    await this.redis.del(LIST_CACHE_KEY);
    return user;
  }

  /**
   * Cambia la contraseña de una cuenta ya ACTIVE (recuperación de
   * contraseña). A diferencia de setPasswordAndActivate, no toca
   * accountStatus: activar una cuenta y recuperar su contraseña son
   * procesos distintos aunque ambos terminen hasheando una contraseña.
   */
  async setPassword(id: string, password: string) {
    const hashed = await hash(password, 10);

    const user = await this.prisma.user.update({
      where: { id },
      data: { password: hashed },
      select: USER_PUBLIC_SELECT,
    });

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
            // Iniciar sesión con Google ya prueba que el correo es suyo:
            // no tiene sentido dejarlo colgado en PENDING sin poder activarse.
            accountStatus: 'ACTIVE',
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

  async update(id: string, dto: UpdateUserDto, updatedBy?: string | null) {
    await this.findPublicById(id);

    const data: Record<string, unknown> = {
      name: dto.name,
      email: dto.email,
      status: dto.status,
      lastModifiedBy: updatedBy ?? null,
    };

    if (dto.password) {
      data.password = await hash(dto.password, 10);
      // Si alguien le pone contraseña a una cuenta PENDING por esta vía,
      // ya puede iniciar sesión: no debe quedar marcada como pendiente.
      data.accountStatus = 'ACTIVE';
    }

    const user = await this.prisma.user.update({
      where: { id },
      data,
      select: USER_PUBLIC_SELECT,
    });

    await this.redis.del(LIST_CACHE_KEY);
    return user;
  }

  /** Reservado a ADMIN: es el único camino para cambiar de rol. */
  async updateRole(id: string, roleId: string, updatedBy?: string | null) {
    await this.findPublicById(id);
    const role = await this.resolveRole(roleId);

    const user = await this.prisma.user.update({
      where: { id },
      data: { roleId: role.id, lastModifiedBy: updatedBy ?? null },
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