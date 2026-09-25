export function money(n: number): string {
  const v = Math.round(n)
  return v < 0 ? `-¥${Math.abs(v).toLocaleString('en-US')}` : `¥${v.toLocaleString('en-US')}`
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 10_000) return `${(n / 1000).toFixed(1)}k`
  return Math.round(n).toLocaleString('en-US')
}

export function plural(n: number, word: string): string {
  return `${n} ${n === 1 ? word : `${word}s`}`
}
