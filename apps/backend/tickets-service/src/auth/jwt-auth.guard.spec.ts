import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { JwtAuthGuard } from './jwt-auth.guard';

const SECRET = 'test-secret';

/** Reproduce el formato HS256 que emite auth-service con jsonwebtoken. */
function signToken(
  payload: Record<string, unknown>,
  secret: string = SECRET,
): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');

  const head = encode({ alg: 'HS256', typ: 'JWT' });
  const body = encode(payload);
  const signature = createHmac('sha256', secret)
    .update(`${head}.${body}`)
    .digest('base64url');

  return `${head}.${body}.${signature}`;
}

function contextWith(authorization?: string) {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: authorization ? { authorization } : {},
  };

  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext,
  };
}

describe('JwtAuthGuard', () => {
  const guard = new JwtAuthGuard();
  const validPayload = {
    sub: '550e8400-e29b-41d4-a716-446655440000',
    email: 'validator@nextticket.mx',
    role: 'VALIDATOR',
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('accepts a token signed with the shared secret and exposes the user', () => {
    const { context, request } = contextWith(`Bearer ${signToken(validPayload)}`);

    expect(guard.canActivate(context)).toBe(true);
    expect(request.user).toEqual(expect.objectContaining({ sub: validPayload.sub }));
  });

  it('rejects a request without an Authorization header', () => {
    const { context } = contextWith();

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a token signed with a different secret', () => {
    const { context } = contextWith(
      `Bearer ${signToken(validPayload, 'otro-secreto')}`,
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a token whose payload was tampered with', () => {
    const token = signToken(validPayload);
    const [head, , signature] = token.split('.');
    const forgedBody = Buffer.from(
      JSON.stringify({ ...validPayload, role: 'ADMIN' }),
    ).toString('base64url');

    const { context } = contextWith(`Bearer ${head}.${forgedBody}.${signature}`);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects an unsigned "alg: none" token', () => {
    const head = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    const body = Buffer.from(JSON.stringify(validPayload)).toString('base64url');

    const { context } = contextWith(`Bearer ${head}.${body}.`);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects an expired token', () => {
    const { context } = contextWith(
      `Bearer ${signToken({
        ...validPayload,
        exp: Math.floor(Date.now() / 1000) - 10,
      })}`,
    );

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects a token without sub, email or role', () => {
    const { context } = contextWith(`Bearer ${signToken({ foo: 'bar' })}`);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('rejects every request when JWT_SECRET is not configured', () => {
    delete process.env.JWT_SECRET;
    const { context } = contextWith(`Bearer ${signToken(validPayload)}`);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
