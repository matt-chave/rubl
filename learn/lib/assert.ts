export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

export function section(title: string): void {
  console.log(`  • ${title}`)
}
