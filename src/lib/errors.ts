/**
 * Domain errors mapped onto the OpenAPI validation envelope and 404 body.
 *
 * Handlers throw these; the HTTP adapter turns them into status codes so
 * individual Lambdas never assemble response JSON themselves.
 */

import type { ValidationIssue } from './types'

export class ValidationError extends Error {
  readonly issues: ValidationIssue[]

  constructor(issues: ValidationIssue[]) {
    super(issues.map((i) => i.message).join('; ') || 'Validation failed')
    this.name = 'ValidationError'
    this.issues = issues
  }
}

export class ConflictError extends Error {
  readonly code: 'ALREADY_EXISTS'

  constructor(code: 'ALREADY_EXISTS', message: string) {
    super(message)
    this.name = 'ConflictError'
    this.code = code
  }
}

export class NotFoundError extends Error {
  readonly code:
    | 'MOVEMENT_NOT_FOUND'
    | 'COLLECTION_NOT_RECORDED'
    | 'DELIVERY_NOT_FOUND'
    | 'RECEIPT_NOT_RECORDED'
    | 'NOT_FOUND'

  constructor(
    code:
      | 'MOVEMENT_NOT_FOUND'
      | 'COLLECTION_NOT_RECORDED'
      | 'DELIVERY_NOT_FOUND'
      | 'RECEIPT_NOT_RECORDED'
      | 'NOT_FOUND',
    message: string,
  ) {
    super(message)
    this.name = 'NotFoundError'
    this.code = code
  }
}

export function issue(
  key: string,
  errorType: ValidationIssue['errorType'],
  message: string,
): ValidationIssue {
  return { key, errorType, message }
}
