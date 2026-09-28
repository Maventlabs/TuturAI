import { randomUUID } from 'node:crypto'

export interface ApiFailureEvent {
  requestId: string
  route: string
  status: number
  errorCode: string
  provider: string
  durationMs: number
  providerErrorCode?: string | null
  configField?: string | null
  projectId?: string | null
}

export function getRequestId(request: Request) {
  const supplied = request.headers.get('x-request-id')?.trim() ?? ''
  return /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(supplied) ? supplied : randomUUID()
}

export function logApiFailure(event: ApiFailureEvent, sink: (line: string) => void = console.error) {
  const safeFields = {
    event: 'api_failure',
    requestId: event.requestId,
    route: event.route,
    status: event.status,
    errorCode: event.errorCode,
    provider: event.provider,
    durationMs: Math.max(0, Math.round(event.durationMs)),
    ...(event.providerErrorCode && /^(auth|app)\/[a-z0-9-]{1,80}$/i.test(event.providerErrorCode)
      ? { providerErrorCode: event.providerErrorCode }
      : {}),
    ...(event.configField && /^[A-Z0-9_]{1,100}$/.test(event.configField) ? { configField: event.configField } : {}),
    ...(event.projectId && /^[a-z0-9-]{1,63}$/.test(event.projectId) ? { projectId: event.projectId } : {}),
  }
  sink(JSON.stringify(safeFields))
}
