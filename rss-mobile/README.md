# Aurora RSS Reader Mobile

Mobile client for Aurora RSS Reader, built with Vue 3, TypeScript, Vite, and Capacitor.

The current product direction is stored in:

- `design/ui/README.md`
- `design/ui/mobile-implementation-plan-v2.md`
- `design/ui/concepts/`

The approved mobile design direction is:

> One RSS inbox for browsing, multiple content-aware reader templates for reading.

## Design References

- `design/ui/concepts/01-inbox-mixed-feed.png`
- `design/ui/concepts/02-reader-blog-longform.png`
- `design/ui/concepts/03-reader-image-gallery.png`
- `design/ui/concepts/04-reader-video.png`
- `design/ui/concepts/05-sources-management.png`

## Development

```bash
pnpm dev
```

## Build

```bash
pnpm build
```

## Capacitor

```bash
pnpm cap:sync
pnpm ios:open
pnpm android:open
```
