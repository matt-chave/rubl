/**
 * Year-prefixed sqids — the public identifiers the OpenAPI contract returns.
 *
 * Callers must treat these as opaque (do not parse). We still generate them
 * as short, uppercase, speakable tokens so a driver can read one over the
 * phone: `25HRA0B2`.
 *
 * Uniqueness comes from a DynamoDB atomic counter (see ledger.ts), not from
 * randomness, so we never mint a colliding ID under concurrent load.
 *
 * Phase 1 wasteTrackingId is a different shape (two-letter prefix + six
 * alphanumerics, e.g. YY3F7K2Q). We keep that generator separate so we
 * cannot accidentally return a Phase 2 movementId on a deprecated path.
 */

import Sqids from 'sqids'

// Crockford-ish alphabet: no i/l/o/u lookalikes, uppercase for speakability.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const sqids = new Sqids({
  alphabet: ALPHABET,
  minLength: 6,
})

export function yearPrefix(now: Date = new Date()): string {
  return String(now.getUTCFullYear()).slice(-2)
}

export function mintPublicId(sequence: number, now: Date = new Date()): string {
  return `${yearPrefix(now)}${sqids.encode([sequence]).toUpperCase()}`
}

/**
 * Phase 1 public ID. Pattern in the spec: ^[A-Z]{2}[A-Z0-9]{6}$
 * `WT` = Waste Tracking, then a 6-char sqid.
 */
export function mintWasteTrackingId(sequence: number): string {
  const encoded = sqids.encode([sequence]).toUpperCase().padEnd(6, '0').slice(0, 6)
  return `WT${encoded}`
}
