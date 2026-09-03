import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const startedAt = process.hrtime.bigint();
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const record = (): void => {
      const durationSec = Number(process.hrtime.bigint() - startedAt) / 1e9;
      // req.route.path pakai pola (":id", bukan UUID mentah) -- kalau
      // tidak ketemu (mis. 404 sebelum routing selesai) jatuh ke url.
      const route = (request as { route?: { path?: string } }).route?.path ?? request.url;

      this.metrics.httpRequestDuration.observe(
        { method: request.method, route, status_code: response.statusCode },
        durationSec,
      );
    };

    return next.handle().pipe(tap({ next: record, error: record }));
  }
}
