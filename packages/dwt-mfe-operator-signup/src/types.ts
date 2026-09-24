export type FieldIssue = { id: string; message: string }

export type OperatorSignup = {
  organisationName?: string
  address?: string
  contactEmail?: string
}

export const EMPTY_OPERATOR: OperatorSignup = {
  organisationName: '',
  address: '',
  contactEmail: '',
}
