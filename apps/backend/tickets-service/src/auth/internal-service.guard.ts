import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

const INTERNAL_TOKEN_HEADER = 'x-internal-service-token';

/**
 * Protege endpoints de servicio-a-servicio (no de usuario final): en vez de
 * un JWT de sesión, exige un secreto compartido idéntico entre los
 * microservicios que lo usan — mismo patrón que ya usan con JWT_SECRET
 * idéntico en los 4 servicios, pero para llamadas internas sin usuario.
 */
@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const token = request.headers[INTERNAL_TOKEN_HEADER] as string | undefined;

    const expected = process.env.INTERNAL_SERVICE_TOKEN;
    if (!expected) {
      throw new UnauthorizedException('Internal service token is not configured');
    }
    if (!token || token !== expected) {
      throw new UnauthorizedException('Invalid internal service token');
    }

    return true;
  }
}
