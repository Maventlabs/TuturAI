// Fixed band colors: these carry white text in both light and dark themes, so
// they cannot use theme tokens (--primary lightens in dark mode and would drop
// below the 4.5:1 contrast that white body text needs).
const CLASS_BANDS = ['#1d4ed8', '#0b6bcb', '#1a7a4c', '#5b48c4'] as const

export function classBandColor(id: string) {
  let hash = 0
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) % 9973
  }
  return CLASS_BANDS[hash % CLASS_BANDS.length]
}

export function classInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 'TR'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}
