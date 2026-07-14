import type { ClassifyResponse } from './types'

export async function classifyIfc(file: File): Promise<ClassifyResponse> {
  const form = new FormData()
  form.append('file', file, file.name)

  const res = await fetch('/api/classify', { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.detail ?? `Klasyfikacja nie powiodła się (HTTP ${res.status})`)
  }
  return res.json()
}
