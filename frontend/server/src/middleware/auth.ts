import { Request, Response, NextFunction } from 'express';
import { verifyToken, extractToken } from '../auth/jwt.js';

export interface AuthUser {
  id: string;
  role: string;
  roles: string[];
  email?: string;
  mobile?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.authorization as string)
    ?? req.cookies?.metryx_token
    ?? (req.query?.token as string | undefined);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = {
        id: payload.userId,
        role: payload.role,
        roles: payload.roles,
        mobile: payload.mobile,
        email: payload.email,
      };
      next();
      return;
    }
  }

  const headerUserId = req.headers['x-user-id'] as string | undefined;
  if (headerUserId) {
    req.user = {
      id: headerUserId,
      role: (req.headers['x-user-role'] as string) ?? 'user',
      roles: [(req.headers['x-user-role'] as string) ?? 'user'],
    };
    next();
    return;
  }

  res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Login required.' });
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req.headers.authorization as string)
    ?? req.cookies?.metryx_token
    ?? (req.query?.token as string | undefined);

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      req.user = {
        id: payload.userId,
        role: payload.role,
        roles: payload.roles,
        mobile: payload.mobile,
        email: payload.email,
      };
    }
  } else {
    const headerUserId = req.headers['x-user-id'] as string | undefined;
    if (headerUserId) {
      req.user = {
        id: headerUserId,
        role: (req.headers['x-user-role'] as string) ?? 'user',
        roles: [(req.headers['x-user-role'] as string) ?? 'user'],
      };
    }
  }

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    return;
  }
  next();
}
