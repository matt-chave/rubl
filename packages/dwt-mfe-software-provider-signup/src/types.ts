export type FieldIssue = { id: string; message: string }

export type SoftwareProviderSignup = {
  productName?: string
  contactEmail?: string
}

export const EMPTY_SOFTWARE_PROVIDER: SoftwareProviderSignup = {
  productName: '',
  contactEmail: '',
}
