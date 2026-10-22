import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z, ZodError } from 'zod';
import { ApiError } from '../lib/errors.js';

/** Validate input with zod; failures become 400 VALIDATION_ERROR with field details. */
export function parse<S extends z.ZodType>(schema: S, data: unknown): z.infer<S> {
  const res = schema.safeParse(data);
  if (!res.success) throw res.error;
  return res.data;
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route ${req.method} ${req.path}` } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        // First problem in plain words (e.g. "Enter a valid email address"), so apps can show it as is.
        message: err.issues[0]?.message ?? 'Invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }
  if (err instanceof multer.MulterError) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: err.message } });
    return;
  }
  const e = err as { type?: string; status?: number; message?: string };
  if (e?.type === 'entity.too.large' || e?.type === 'entity.parse.failed') {
    res.status(e.status ?? 400).json({ error: { code: 'BAD_REQUEST', message: e.message } });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Try again.' } });
}
