import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { ApiError } from '../lib/errors.js';
import { touch } from '../services/users.js';
import type { Store, User } from '../store/types.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: User;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] });
}

export function requireAuth(store: Store) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token');

    let sub: string;
    try {
      sub = String((jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload).sub);
    } catch {
      throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
    }
    const user = await store.users.get(sub);
    if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'User no longer exists');
    req.user = user;
    void touch(store, user);
    next();
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!config.ADMIN_KEY) throw new ApiError(404, 'NOT_FOUND', 'Admin API disabled (set ADMIN_KEY)');
  if (req.headers['x-admin-key'] !== config.ADMIN_KEY) throw new ApiError(401, 'UNAUTHORIZED', 'Bad admin key');
  next();
}
