/**
 * Shared field helpers used by every payload composer.
 *
 * These map missing/wrong values onto the OpenAPI validationResult
 * errorTypes (NotProvided, InvalidFormat, …) so vendors see one vocabulary.
 */

import { issue } from '../errors'
import type { ValidationIssue } from '../types'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): boolean {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isIsoDateTime(value: unknown): boolean {
  if (typeof value !== 'string' || value.length < 10) {
    return false
  }
  const ms = Date.parse(value)
  return !Number.isNaN(ms)
}

export function requireFields(
  body: Record<string, unknown>,
  fields: string[],
  issues: ValidationIssue[],
  prefix = '',
): void {
  for (const field of fields) {
    const value = body[field]
    if (value === undefined || value === null || value === '') {
      issues.push(
        issue(
          prefix ? `${prefix}.${field}` : field,
          'NotProvided',
          `${field} is required`,
        ),
      )
    }
  }
}

export function requireUuid(body: Record<string, unknown>, field: string, issues: ValidationIssue[]): void {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    return
  }
  if (!isUuid(body[field])) {
    issues.push(issue(field, 'InvalidFormat', `${field} must be a UUID`))
  }
}

export function requireDateTime(body: Record<string, unknown>, field: string, issues: ValidationIssue[]): void {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    return
  }
  if (!isIsoDateTime(body[field])) {
    issues.push(issue(field, 'InvalidFormat', `${field} must be an ISO-8601 date-time`))
  }
}

export function requireArray(body: Record<string, unknown>, field: string, minItems: number, issues: ValidationIssue[]): void {
  const value = body[field]
  if (value === undefined) {
    return
  }
  if (!Array.isArray(value)) {
    issues.push(issue(field, 'InvalidType', `${field} must be an array`))
    return
  }
  if (value.length < minItems) {
    issues.push(issue(field, 'OutOfRange', `${field} must contain at least ${minItems} item(s)`))
  }
}

/** Spec rule reused on producer, carrier, broker and receiver: at least one contact channel. */
export function contactable(
  obj: Record<string, unknown> | undefined,
  key: string,
  issues: ValidationIssue[],
): void {
  if (!obj) {
    return
  }
  if (!obj.emailAddress && !obj.phoneNumber) {
    issues.push(
      issue(
        key,
        'BusinessRuleViolation',
        'At least one of emailAddress or phoneNumber must be provided',
      ),
    )
  }
}
