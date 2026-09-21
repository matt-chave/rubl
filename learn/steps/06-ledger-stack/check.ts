import { assert, section } from '../../lib/assert'
import { awsJson, requireAws } from '../../lib/aws'

requireAws()
section('DwtLedger stack')
const stacks = awsJson(['cloudformation', 'describe-stacks', '--stack-name', 'DwtLedger']) as {
  Stacks: { StackStatus: string; Outputs?: { OutputKey: string; OutputValue: string }[] }[]
}
const stack = stacks.Stacks[0]
assert(stack.StackStatus.includes('COMPLETE'), `DwtLedger status is ${stack.StackStatus}`)
const table = stack.Outputs?.find((o) => o.OutputKey === 'MovementsTableName')?.OutputValue
assert(table, 'MovementsTableName output missing')

section(`Describe table ${table}`)
const desc = awsJson(['dynamodb', 'describe-table', '--table-name', table]) as {
  Table: { StreamSpecification?: { StreamEnabled?: boolean } }
}
assert(desc.Table.StreamSpecification?.StreamEnabled, 'Movements table must have a stream')

console.log('Step 06 automated checks passed.')
