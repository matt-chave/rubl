import type { FieldIssue, OperatorSignup } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateOperatorSlice(value: OperatorSignup | undefined): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!value?.organisationName?.trim()) {
    issues.push({ id: 'organisationName', message: 'Enter the organisation name' })
  }
  if (!value?.address?.trim()) {
    issues.push({ id: 'address', message: 'Enter the organisation address' })
  }
  if (!value?.contactEmail?.trim()) {
    issues.push({ id: 'contactEmail', message: 'Enter the contact email' })
  } else if (!EMAIL_RE.test(value.contactEmail.trim())) {
    issues.push({ id: 'contactEmail', message: 'Enter a valid contact email address' })
  }
  return issues
}

export function assembleOperatorBody(value: OperatorSignup): {
  organisationName: string
  address: string
  contactEmail: string
} {
  return {
    organisationName: value.organisationName!.trim(),
    address: value.address!.trim(),
    contactEmail: value.contactEmail!.trim(),
  }
}
