import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'BAD_REQUEST', message, details);
export const unauthorized = (message = 'Authentification requise') =>
  new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Action non autorisée') =>
  new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Ressource introuvable') =>
  new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, 'CONFLICT', message, details);

/** Enveloppe un handler async pour propager les rejets au gestionnaire d'erreurs. */
export const wrap =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };

export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: { code: error.code, message: error.message, details: error.details },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Données invalides',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        error: {
          code: 'DUPLICATE',
          message: 'Cette valeur existe déjà.',
          details: error.meta?.target,
        },
      });
      return;
    }
    if (error.code === 'P2003' || error.code === 'P2014') {
      res.status(409).json({
        error: {
          code: 'DEPENDENCY',
          message: 'Suppression impossible : des données liées existent encore.',
        },
      });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Ressource introuvable.' } });
      return;
    }
  }

  // eslint-disable-next-line no-console
  console.error('[atelierpro] erreur non gérée :', error);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Erreur interne du serveur.' },
  });
}
