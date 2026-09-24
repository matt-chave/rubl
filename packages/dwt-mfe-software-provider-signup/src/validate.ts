import type { FieldIssue, SoftwareProviderSignup } from './types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateSoftwareProviderSlice(
  value: SoftwareProviderSignup | undefined,
): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!value?.productName?.trim()) {
    issues.push({ id: 'productName', message: 'Enter the product name' })
  }
  if (!value?.contactEmail?.trim()) {
    issues.push({ id: 'contactEmail', message: 'Enter the provider contact email' })
  } else if (!EMAIL_RE.test(value.contactEmail.trim())) {
    issues.push({ id: 'contactEmail', message: 'Enter a valid contact email address' })
  }
  return issues
}

export function assembleSoftwareProviderBody(
  value: SoftwareProviderSignup,
): { productName: string; contactEmail: string } {
  return {
    productName: value.productName!.trim(),
    contactEmail: value.contactEmail!.trim(),
  }
}
