import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

function contextWith(user?: unknown, headers: Record<string, string> = {}) {
  const request = { headers, user };

  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function requireRoles(roles?: string[]) {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(roles as unknown as string[]);
  }

  afterEach(() => jest.restoreAllMocks());

  it('lets the request through when the route requires no role', () => {
    requireRoles(undefined);

    expect(guard.canActivate(contextWith({ role: 'CLIENT' }))).toBe(true);
  });

  it('returns 403 when the role does not match', () => {
    requireRoles(['ORGANIZER']);

    expect(() => guard.canActivate(contextWith({ role: 'CLIENT' }))).toThrow(
      ForbiddenException,
    );
  });

  it('lets the right role through', () => {
    requireRoles(['ORGANIZER', 'VALIDATOR']);

    expect(guard.canActivate(contextWith({ role: 'VALIDATOR' }))).toBe(true);
  });

  it('returns 401 when there is no user in the request', () => {
    requireRoles(['ORGANIZER']);

    expect(() => guard.canActivate(contextWith(undefined))).toThrow(
      UnauthorizedException,
    );
  });
});

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard();

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  it('returns 401 when the Authorization header is missing', () => {
    expect(() => guard.canActivate(contextWith(undefined, {}))).toThrow(
      UnauthorizedException,
    );
  });

  it('returns 401 when the token is malformed', () => {
    expect(() =>
      guard.canActivate(contextWith(undefined, { authorization: 'Bearer abc' })),
    ).toThrow(UnauthorizedException);
  });
});
