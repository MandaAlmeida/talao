import { Request } from 'express';
import { Role } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    papel: Role;
  };
}
