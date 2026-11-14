export type DiffLine = {
  type: 'same' | 'removed' | 'added'
  text: string
}

export const diffLines = (original: string, revised: string): DiffLine[] => {
  const before = original.split('\n')
  const after = revised.split('\n')
  let prefix = 0
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1
  }
  let suffix = 0
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1
  }
  return [
    ...before.slice(0, prefix).map((text): DiffLine => ({ type: 'same', text })),
    ...before
      .slice(prefix, before.length - suffix)
      .map((text): DiffLine => ({ type: 'removed', text })),
    ...after
      .slice(prefix, after.length - suffix)
      .map((text): DiffLine => ({ type: 'added', text })),
    ...before.slice(before.length - suffix).map((text): DiffLine => ({ type: 'same', text })),
  ]
}
