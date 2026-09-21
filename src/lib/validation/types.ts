import type { ValidationIssue } from '../types'

export interface ValidatedBody {
  body: Record<string, unknown>
  warnings: ValidationIssue[]
}
