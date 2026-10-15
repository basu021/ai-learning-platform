import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import type { Role } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as AuthUser | undefined;
    if (data) {
      return user?.[data];
    }
    return user;
  },
);
