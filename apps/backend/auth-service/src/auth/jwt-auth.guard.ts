import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { verify } from 'jsonwebtoken';
import type { AuthenticatedUser } from './current-user.decorator';

/**
 * Archivo compartido: debe ser IDENTICO en los cuatro microservicios.
 * Todos leen el mismo JWT_SECRET, que es el que usa auth-service para firmar.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization as string | undefined;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    let payload: AuthenticatedUser;
    try {
      // algorithms fija HS256: sin esto un token con "alg": "none" pasaria.
      payload = verify(authorization.slice(7), secret, {
        algorithms: ['HS256'],
      }) as AuthenticatedUser;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    if (!payload?.sub || !payload.email || !payload.role) {
      throw new UnauthorizedException('Invalid token payload');
    }

    request.user = payload;
    return true;
  }
}
