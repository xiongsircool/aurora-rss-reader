export function normalizeWhitespace(text: string): string {
    return text.replace(/\s+/g, ' ').trim()
}

export function stripHtml(value?: string | null): string {
    if (!value) return ''
    // Check for document availability (SSR safety)
    if (typeof document === 'undefined') return value || ''

    const temp = document.createElement('div')
    temp.innerHTML = value
    const text = temp.textContent || temp.innerText || ''
    return normalizeWhitespace(text)
}
