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

// SECURITY: identity is established ONLY from a cryptographically verified token
// (Authorization bearer, `metryx_token` cookie, or `?token=` query param). We do
// NOT trust client-supplied `x-user-id` / `x-user-role` headers — doing so let any
// caller impersonate any user (e.g. `x-user-role: super_admin`). Those headers are
// ignored everywhere.
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
  }
  // No verified token → request stays anonymous. Client-supplied x-user-id /
  // x-user-role headers are deliberately NOT honoured (see requireAuth above).

  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !['admin', 'super_admin'].includes(req.user.role)) {
    res.status(403).json({ error: 'FORBIDDEN', message: 'Admin access required.' });
    return;
  }
  next();
}
