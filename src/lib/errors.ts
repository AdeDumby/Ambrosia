export function errorMessage(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  const marker = 'Error: '
  const index = text.lastIndexOf(marker)
  const message = (index >= 0 ? text.slice(index + marker.length) : text).trim()
  return message !== '' && message.length < 200 ? message : 'That did not work.'
}
