import { Browser } from '@capacitor/browser'

export async function openUrl(url: string | null | undefined) {
  if (!url) return

  try {
    await Browser.open({
      url,
      toolbarColor: '#f8f7f3',
      presentationStyle: 'fullscreen',
    })
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
