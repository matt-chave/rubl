/**
 * Party shapes reused across create, collection, delivery and receipt.
 *
 * Creation uses the lighter `intendedCarrier` (transport + name). Collection
 * and delivery use the full Phase 1 `carrier` (registration / Road VRN).
 */

import { issue } from '../errors'
import type { ValidationIssue } from '../types'
import { contactable, requireFields } from './primitives'

export function validateProducer(producer: unknown, issues: ValidationIssue[]): void {
  if (producer === undefined) {
    return
  }
  if (typeof producer !== 'object' || producer === null || Array.isArray(producer)) {
    issues.push(issue('producer', 'InvalidType', 'producer must be an object'))
    return
  }
  const p = producer as Record<string, unknown>
  requireFields(p, ['wasteSource'], issues, 'producer')
  const source = p.wasteSource
  if (source && !['Household', 'Commercial', 'Municipal'].includes(String(source))) {
    issues.push(issue('producer.wasteSource', 'InvalidValue', 'wasteSource must be Household, Commercial or Municipal'))
  }
  if (source === 'Commercial' || source === 'Municipal') {
    requireFields(p, ['organisationName', 'address'], issues, 'producer')
    contactable(p, 'producer', issues)
    if (source === 'Commercial' && !p.sicCode) {
      issues.push(issue('producer.sicCode', 'NotProvided', 'sicCode is required for Commercial producers'))
    }
    if (!p.authorisationNumber && !p.reasonForNoAuthorisationNumber) {
      issues.push(
        issue(
          'producer.authorisationNumber',
          'BusinessRuleViolation',
          'Exactly one of authorisationNumber or reasonForNoAuthorisationNumber is required',
        ),
      )
    }
    if (p.authorisationNumber && p.reasonForNoAuthorisationNumber) {
      issues.push(
        issue(
          'producer.reasonForNoAuthorisationNumber',
          'NotAllowed',
          'reasonForNoAuthorisationNumber must not be supplied with authorisationNumber',
        ),
      )
    }
  }
}

export function validateIntendedCarrier(carrier: Record<string, unknown>, key: string, issues: ValidationIssue[]): void {
  requireFields(carrier, ['meansOfTransport', 'organisationName'], issues, key)
  contactable(carrier, key, issues)
  if (carrier.registrationNumber && carrier.reasonForNoRegistrationNumber) {
    issues.push(
      issue(
        `${key}.reasonForNoRegistrationNumber`,
        'NotAllowed',
        'registrationNumber and reasonForNoRegistrationNumber are mutually exclusive',
      ),
    )
  }
  if (carrier.vehicleRegistration && carrier.meansOfTransport && carrier.meansOfTransport !== 'Road') {
    issues.push(
      issue(
        `${key}.vehicleRegistration`,
        'NotAllowed',
        'vehicleRegistration is only valid when meansOfTransport is Road',
      ),
    )
  }
}

export function validateFullCarrier(carrier: unknown, key: string, issues: ValidationIssue[], required: boolean): void {
  if (carrier === undefined) {
    if (required) {
      issues.push(issue(key, 'NotProvided', `${key} is required`))
    }
    return
  }
  if (typeof carrier !== 'object' || carrier === null || Array.isArray(carrier)) {
    issues.push(issue(key, 'InvalidType', `${key} must be an object`))
    return
  }
  const c = carrier as Record<string, unknown>
  requireFields(c, ['organisationName', 'meansOfTransport'], issues, key)
  contactable(c, key, issues)
  const hasReg = typeof c.registrationNumber === 'string' && c.registrationNumber.length > 0
  if (!hasReg && !c.reasonForNoRegistrationNumber) {
    issues.push(
      issue(
        `${key}.registrationNumber`,
        'BusinessRuleViolation',
        'registrationNumber or reasonForNoRegistrationNumber is required',
      ),
    )
  }
  if (hasReg && c.reasonForNoRegistrationNumber) {
    issues.push(
      issue(
        `${key}.reasonForNoRegistrationNumber`,
        'NotAllowed',
        'reasonForNoRegistrationNumber must not be supplied with registrationNumber',
      ),
    )
  }
  if (c.meansOfTransport === 'Road' && !c.vehicleRegistration) {
    issues.push(issue(`${key}.vehicleRegistration`, 'NotProvided', 'vehicleRegistration is required when meansOfTransport is Road'))
  }
}

export function validateReceiverSite(receiverSite: unknown, issues: ValidationIssue[]): void {
  if (!receiverSite || typeof receiverSite !== 'object' || Array.isArray(receiverSite)) {
    return
  }
  const site = receiverSite as Record<string, unknown>
  requireFields(site, ['siteName', 'authorisationNumber', 'address'], issues, 'receiverSite')
  contactable(site, 'receiverSite', issues)
}

export function validateDeliverySite(deliverySite: unknown, issues: ValidationIssue[]): void {
  if (!deliverySite || typeof deliverySite !== 'object' || Array.isArray(deliverySite)) {
    return
  }
  requireFields(deliverySite as Record<string, unknown>, ['siteName', 'address'], issues, 'deliverySite')
}
