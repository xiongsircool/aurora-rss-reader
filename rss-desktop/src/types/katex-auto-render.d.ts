declare module 'katex/contrib/auto-render' {
  type Delimiter = {
    left: string
    right: string
    display: boolean
  }

  type Options = {
    delimiters?: Delimiter[]
    throwOnError?: boolean
    strict?: boolean | 'ignore' | 'warn' | 'error'
  }

  export default function renderMathInElement(
    element: HTMLElement,
    options?: Options
  ): void
}
