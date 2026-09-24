/**
 * Offline ID reservations — pure helpers.
 *
 * IDs are the same year-prefixed sqids as online mint. A reservation is
 * not a waste event. Unused rows expire; the public string is never
 * recycled (the sequence number is already consumed).
 */

import { issue, ValidationError } from './errors'
import type { ReservationItem, ReservationKind, ValidationIssue } from './types'

/** Unused RESERVED ids per operator (movement plus delivery), not a per-request cap. */
export const MAX_IN_CIRCULATION = 50
export const DEFAULT_RESERVATION_TTL_DAYS = 30

export function reservationTtlDays(): number {
  const raw = process.env.ID_RESERVATION_TTL_DAYS
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_RESERVATION_TTL_DAYS
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RESERVATION_TTL_DAYS
}

export function reservationWindow(
  now: Date = new Date(),
  ttlDays: number = reservationTtlDays(),
): { expiresAt: string; ttl: number } {
  const expires = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000)
  return {
    expiresAt: expires.toISOString(),
    ttl: Math.floor(expires.getTime() / 1000),
  }
}

export function parseReserveCounts(body: Record<string, unknown>): {
  movementCount: number
  deliveryCount: number
} {
  const issues: ValidationIssue[] = []
  const movementCount = asCount(body.movementCount, 'movementCount', issues)
  const deliveryCount = asCount(body.deliveryCount, 'deliveryCount', issues)
  if (issues.length === 0 && movementCount + deliveryCount < 1) {
    issues.push(
      issue('body', 'OutOfRange', 'Ask for at least one movement or delivery ID'),
    )
  }
  if (issues.length > 0) {
    throw new ValidationError(issues)
  }
  return { movementCount, deliveryCount }
}

function asCount(
  value: unknown,
  key: string,
  issues: ValidationIssue[],
): number {
  if (value === undefined || value === null) {
    return 0
  }
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    issues.push(issue(key, 'InvalidType', `${key} must be an integer`))
    return 0
  }
  if (value < 0) {
    issues.push(issue(key, 'OutOfRange', `${key} must be >= 0`))
    return 0
  }
  return value
}

export function reservationPk(publicId: string): string {
  return `ID#${publicId}`
}

export function ownerReservedGsiPk(ownerOperatorId: string): string {
  return `OWNER#${ownerOperatorId}#RESERVED`
}

/**
 * How many new IDs this caller may receive. Circulation is unused
 * RESERVED rows (not yet claimed or expired). Movements are filled first.
 * Asking for 80 with 10 already out yields 40 movement then 0 delivery
 * if they asked for 50+30, or 40 movement if they asked for 50 movement.
 */
export function allocateCirculation(
  requested: { movementCount: number; deliveryCount: number },
  inCirculation: number,
  max: number = MAX_IN_CIRCULATION,
): { movementCount: number; deliveryCount: number } {
  let remaining = Math.max(0, max - inCirculation)
  const movementCount = Math.min(requested.movementCount, remaining)
  remaining -= movementCount
  const deliveryCount = Math.min(requested.deliveryCount, remaining)
  return { movementCount, deliveryCount }
}

export function assertClaimable(
  item: ReservationItem | undefined,
  opts: { kind: ReservationKind; ownerOperatorId: string; now?: Date },
): void {
  const key = opts.kind === 'MOVEMENT' ? 'movementId' : 'deliveryId'
  if (!item) {
    throw new ValidationError([issue(key, 'IdNotReserved', `${key} is not reserved`)])
  }
  if (item.kind !== opts.kind) {
    throw new ValidationError([
      issue(key, 'IdNotReserved', `${key} is reserved as ${item.kind}, not ${opts.kind}`),
    ])
  }
  if (item.status !== 'RESERVED') {
    throw new ValidationError([issue(key, 'IdNotReserved', `${key} has already been consumed`)])
  }
  if (item.ownerOperatorId !== opts.ownerOperatorId) {
    throw new ValidationError([issue(key, 'IdNotReserved', `${key} is reserved by another operator`)])
  }
  const now = opts.now ?? new Date()
  if (Date.parse(item.expiresAt) <= now.getTime()) {
    throw new ValidationError([issue(key, 'IdNotReserved', `${key} reservation has expired`)])
  }
}

/** Reserved delivery IDs apply only to the non-hazardous aggregated delivery. */
export function reservedDeliveryIdToClaim(
  supplied: unknown,
  nonHazardousCount: number,
): string | undefined {
  if (nonHazardousCount === 0) {
    return undefined
  }
  if (typeof supplied === 'string' && supplied.length > 0) {
    return supplied
  }
  return undefined
}
