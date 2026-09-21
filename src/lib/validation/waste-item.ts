/**
 * Waste-item classification and logistics — reused on creation and on
 * POST /receipts (no prior Creation record to source classification from).
 *
 * POP "recommended components" are warnings, not rejections, matching Phase 1.
 */

import { issue } from '../errors'
import type { ValidationIssue } from '../types'
import { requireFields } from './primitives'
import { validateWeight } from './weight'

export function validateCreateWasteItem(item: unknown, key: string, issues: ValidationIssue[]): void {
  if (typeof item !== 'object' || item === null || Array.isArray(item)) {
    issues.push(issue(key, 'InvalidType', 'waste item must be an object'))
    return
  }
  const w = item as Record<string, unknown>
  requireFields(w, ['weight', 'numberOfContainers', 'typeOfContainers', 'physicalForm', 'classification', 'intendedTreatments'], issues, key)
  validateWeight(w.weight, `${key}.weight`, issues)
  const classification = w.classification
  if (classification && typeof classification === 'object' && !Array.isArray(classification)) {
    const c = classification as Record<string, unknown>
    requireFields(c, ['ewcCodes', 'wasteDescription', 'containsPops', 'containsHazardous'], issues, `${key}.classification`)
    if (c.containsPops === true && !c.pops) {
      issues.push(issue(`${key}.classification.pops`, 'NotProvided', 'pops is required when containsPops is true'))
    }
    if (c.containsPops === false && c.pops) {
      issues.push(issue(`${key}.classification.pops`, 'NotAllowed', 'pops must not be provided when containsPops is false'))
    }
    if (c.containsHazardous === true && !c.hazardous) {
      issues.push(issue(`${key}.classification.hazardous`, 'NotProvided', 'hazardous is required when containsHazardous is true'))
    }
    if (c.containsHazardous === false && c.hazardous) {
      issues.push(issue(`${key}.classification.hazardous`, 'NotAllowed', 'hazardous must not be provided when containsHazardous is false'))
    }
  }
  if (!Array.isArray(w.intendedTreatments) || w.intendedTreatments.length < 1) {
    issues.push(issue(`${key}.intendedTreatments`, 'NotProvided', 'At least one intendedTreatment is required'))
  }
}

export function collectWasteItemWarnings(body: Record<string, unknown>): ValidationIssue[] {
  const warnings: ValidationIssue[] = []
  const items = body.wasteItems
  if (!Array.isArray(items)) {
    return warnings
  }
  items.forEach((item, index) => {
    if (typeof item !== 'object' || item === null) {
      return
    }
    const classification = (item as Record<string, unknown>).classification as Record<string, unknown> | undefined
    const pops = classification?.pops as Record<string, unknown> | undefined
    if (pops?.sourceOfComponents === 'PROVIDED_WITH_WASTE') {
      const components = pops.components
      if (!Array.isArray(components) || components.length === 0) {
        warnings.push(
          issue(
            `wasteItems[${index}].classification.pops.components`,
            'NotProvided',
            'POP components are recommended when sourceOfComponents is PROVIDED_WITH_WASTE',
          ),
        )
      }
    }
  })
  return warnings
}

export function movementIsHazardous(payload: Record<string, unknown>): boolean {
  const items = payload.wasteItems
  if (!Array.isArray(items)) {
    return false
  }
  return items.some((item) => {
    if (typeof item !== 'object' || item === null) {
      return false
    }
    const classification = (item as Record<string, unknown>).classification as Record<string, unknown> | undefined
    if (classification?.containsHazardous === true) {
      return true
    }
    const ewc = classification?.ewcCodes
    if (Array.isArray(ewc)) {
      return ewc.some((code) => typeof code === 'string' && code.endsWith('*'))
    }
    const topLevelHaz = (item as Record<string, unknown>).containsHazardous
    return topLevelHaz === true
  })
}
