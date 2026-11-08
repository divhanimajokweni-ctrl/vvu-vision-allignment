export type EventType = 'http' | 'console' | 'error' | 'span' | 'metric' | 'custom' | 'system';
export type EventLevel = 'debug' | 'info' | 'warn' | 'error';

export interface CollectorEvent {
  type: EventType;
  level?: EventLevel;
  source: string;
  message: string;
  data?: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  correlationId?: string;
}
