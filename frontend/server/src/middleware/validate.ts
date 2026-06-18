import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: result.error.issues[0]?.message ?? 'Invalid request body.',
        issues: result.error.issues,
      });
      return;
    }
    req.body = result.data;
    next();
  };
}
