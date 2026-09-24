/**
 * Shared helpers for software-provider and waste-operator signup.
 *
 * These routes are a registration front door. They are not the movements
 * API. Client secrets and API key values are returned once to the caller
 * and are never written to DynamoDB.
 */

import { randomBytes } from 'node:crypto'
import { issue, ValidationError } from './errors'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function newSoftwareProviderId(): string {
  return `SP-${randomBytes(4).toString('hex').toUpperCase()}`
}

export function newOperatorId(): string {
  return `OP-${randomBytes(4).toString('hex').toUpperCase()}`
}

export function requireTrimmedString(
  body: Record<string, unknown>,
  key: string,
  label: string,
): string {
  const raw = body[key]
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new ValidationError([issue(key, 'NotProvided', `Enter the ${label}`)])
  }
  return raw.trim()
}

export function requireContactEmail(body: Record<string, unknown>, key = 'contactEmail'): string {
  const email = requireTrimmedString(body, key, 'contact email')
  if (!EMAIL_RE.test(email)) {
    throw new ValidationError([issue(key, 'InvalidFormat', 'Enter a valid contact email address')])
  }
  return email
}
