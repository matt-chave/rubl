/**
 * HTTP adapter for API Gateway REST (v1) Lambda proxy integration.
 *
 * Why a shared adapter: every endpoint must return the same validation
 * envelope (`validation.errors` / `validation.warnings`) and the same 404
 * `{ code, message }` body. Putting that in one place keeps 18 Lambdas thin.
 *
 * Auth never happens here — Cognito JWT + API key are enforced at the
 * gateway so this code stays a domain function.
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda'
import { NotFoundError, ValidationError } from './errors'
import type { ValidationIssue } from './types'

export interface HandlerResult {
  statusCode: number
  body: unknown
}

export type DomainHandler = (
  event: APIGatewayProxyEvent,
  body: Record<string, unknown>,
) => Promise<HandlerResult>

export function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
    body: JSON.stringify(body),
  }
}

export function validationEnvelope(warnings: ValidationIssue[] = []): { validation: { warnings: ValidationIssue[] } } {
  return { validation: { warnings } }
}

export function parseJsonBody(event: APIGatewayProxyEvent): Record<string, unknown> {
  if (!event.body) {
    return {}
  }
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new ValidationError([
        {
          key: 'body',
          errorType: 'InvalidType',
          message: 'Request body must be a JSON object',
        },
      ])
    }
    return parsed as Record<string, unknown>
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err
    }
    throw new ValidationError([
      {
        key: 'body',
        errorType: 'InvalidFormat',
        message: 'Request body is not valid JSON',
      },
    ])
  }
}

export function pathParam(event: APIGatewayProxyEvent, name: string): string {
  const value = event.pathParameters?.[name]
  if (!value) {
    throw new ValidationError([
      {
        key: name,
        errorType: 'NotProvided',
        message: `Path parameter ${name} is required`,
      },
    ])
  }
  return decodeURIComponent(value)
}

export function apiHandler(handler: DomainHandler) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    try {
      const method = event.httpMethod?.toUpperCase() ?? 'GET'
      const body = method === 'GET' || method === 'HEAD' ? {} : parseJsonBody(event)
      const result = await handler(event, body)
      return json(result.statusCode, result.body)
    } catch (err) {
      if (err instanceof ValidationError) {
        return json(400, { validation: { errors: err.issues } })
      }
      if (err instanceof NotFoundError) {
        return json(404, { code: err.code, message: err.message })
      }
      console.error('unhandled', err)
      return json(500, {
        message: 'An unexpected error occurred',
      })
    }
  }
}
