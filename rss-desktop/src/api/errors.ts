import axios from 'axios'

export interface ApiErrorPayload {
  error?: string
  invalid_fields?: string[]
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorPayload | undefined
    if (data?.error && Array.isArray(data.invalid_fields) && data.invalid_fields.length > 0) {
      return `${data.error}: ${data.invalid_fields.join(', ')}`
    }
    if (data?.error) return data.error
    if (err.message) return err.message
  }

  if (err instanceof Error && err.message) return err.message
  return fallback
}
