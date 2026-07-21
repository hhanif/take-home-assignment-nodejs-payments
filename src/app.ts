import express, {
  type ErrorRequestHandler,
  type Express,
  type RequestHandler,
} from 'express';
import { ApiError, type ErrorResponse } from './http/errors.js';
import {
  parseListCommissionsQuery,
  parsePeriodSummaryQuery,
} from './http/query-validation.js';
import type { ReportingService } from './services/reporting-service.js';

interface AppLogger {
  error(error: unknown): void;
}

interface BuildAppOptions {
  reportingService: ReportingService;
  logger?: AppLogger;
}

export function buildApp(options: BuildAppOptions): Express {
  const app = express();
  const logger = options.logger ?? console;

  app.disable('x-powered-by');
  app.set('query parser', 'simple');

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  const listCommissions: RequestHandler = async (request, response) => {
    const filters = parseListCommissionsQuery(request.query);
    response.json(await options.reportingService.listCommissions(filters));
  };
  app.get('/v1/commissions', listCommissions);

  const getPeriodSummary: RequestHandler = async (request, response) => {
    const filters = parsePeriodSummaryQuery(request.query);
    response.json(await options.reportingService.getPeriodSummary(filters));
  };
  app.get('/v1/reports/period-summary', getPeriodSummary);

  app.use((_request, response) => {
    const body: ErrorResponse = {
      code: 'NOT_FOUND',
      message: 'Route not found',
    };
    response.status(404).json(body);
  });

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof ApiError) {
      response.status(error.statusCode).json(error.toResponse());
      return;
    }

    const statusCode = getClientErrorStatusCode(error);
    if (statusCode !== undefined) {
      const body: ErrorResponse = {
        code: 'BAD_REQUEST',
        message: getErrorMessage(error),
      };
      response.status(statusCode).json(body);
      return;
    }

    logger.error(error);
    const body: ErrorResponse = {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };
    response.status(500).json(body);
  };
  app.use(errorHandler);

  return app;
}

function getClientErrorStatusCode(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) {
    return undefined;
  }

  const statusCode = error.statusCode;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : undefined;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be processed';
}
