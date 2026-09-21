/**
 * Weight value object — shared by creation waste items and treatments.
 */

import { issue } from '../errors'
import type { ValidationIssue } from '../types'
import { requireFields } from './primitives'

export function validateWeight(weight: unknown, key: string, issues: ValidationIssue[]): void {
  if (weight === undefined || weight === null) {
    issues.push(issue(key, 'NotProvided', 'weight is required'))
    return
  }
  if (typeof weight !== 'object' || Array.isArray(weight)) {
    issues.push(issue(key, 'InvalidType', 'weight must be an object'))
    return
  }
  const w = weight as Record<string, unknown>
  requireFields(w, ['metric', 'amount', 'isEstimate'], issues, key)
  if (w.metric !== undefined && !['Grams', 'Kilograms', 'Tonnes'].includes(String(w.metric))) {
    issues.push(issue(`${key}.metric`, 'InvalidValue', 'metric must be Grams, Kilograms or Tonnes'))
  }
  if (typeof w.amount === 'number' && w.amount <= 0) {
    issues.push(issue(`${key}.amount`, 'OutOfRange', 'weight.amount must be greater than 0'))
  }
}
