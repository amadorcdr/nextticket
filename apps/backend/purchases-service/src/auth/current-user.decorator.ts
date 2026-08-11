import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Archivo compartido: debe ser IDENTICO en los cuatro microservicios.
 * Es la forma del payload que firma auth-service.
 */
export type AuthenticatedUser = {
  sub: string;
  email: string;
  role: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
