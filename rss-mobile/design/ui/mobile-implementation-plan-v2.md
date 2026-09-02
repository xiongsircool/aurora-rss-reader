# Aurora RSS Reader Mobile Implementation Plan v2

This plan replaces the scaffold-level mobile direction. The target is a real mobile RSS client, not a desktop clone.

## Feasibility Verdict

The v2 mobile UI is feasible with the current project architecture.

The frontend can implement the approved UI with Vue 3, Vite, TypeScript, and Capacitor. The backend already has most of the raw data needed for mobile reading:

- Feed and entry APIs.
- Read, unread, starred state.
- Feed groups and view types.
- Entry summary, HTML content, readability content.
- Feed favicon.
- Entry image URL.
- Enclosure URL, enclosure type, enclosure length, and duration.
- Background article extraction through Mozilla Readability.
- AI summary storage and generation routes.

The main gap is not the UI. The main gap is a stable content parsing and presentation contract for mobile. Today, some media detection is done in the desktop frontend, and the backend returns raw fields instead of a mobile-ready reading model. For mobile, this should move into backend/shared logic so every screen can rely on the same classification.

## Product Shape

Keep one browsing mode:

- Inbox

Use content-aware reader templates after opening an entry:

- Article reader
- Image reader
- Gallery reader
- Video reader

Keep source management simple:

- Paste feed or site URL.
- Backend auto-detects source type.
- Mobile UI does not expose RSS, Atom, JSON Feed, RSSHub, or webpage parsing as manual choices.

Do not include:

- MCP settings.
- Complex AI workflow settings.
- Desktop-style dashboard views.
- Manual subscription type picker.
- Multiple competing feed browsing layouts.

## Backend Work

### 1. Add a Stable Mobile Entry Presentation Layer

Create a backend service that converts raw `Entry` rows into a mobile presentation model.

Suggested file:

- `backend-node/src/services/entryPresentation.ts`

Suggested output fields:

```ts
type EntryContentType = 'article' | 'image' | 'gallery' | 'video' | 'audio';

interface EntryMediaImage {
  url: string;
  alt: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
}

interface EntryVideo {
  url: string;
  platform: 'youtube' | 'vimeo' | 'bilibili' | 'native' | 'unknown';
  thumbnail_url: string | null;
  duration: string | null;
  embed_url: string | null;
}

interface EntryPresentation {
  content_type: EntryContentType;
  preview_text: string | null;
  reader_html: string | null;
  lead_image_url: string | null;
  images: EntryMediaImage[];
  video: EntryVideo | null;
  has_full_content: boolean;
  extraction_status: string;
}
```

This service should prefer:

1. `readability_content`
2. `content`
3. `summary`

### 2. Move Media Detection Out of Desktop-Only Composables

Current desktop logic has useful extraction behavior in:

- `rss-desktop/src/composables/useImageExtractor.ts`
- `rss-desktop/src/composables/useVideoExtractor.ts`

Mobile should not duplicate these as separate frontend regex utilities. Convert the important behavior into backend parsing helpers:

- Extract meaningful image candidates from feed metadata and HTML.
- Resolve relative URLs against `entry.url`, `content_source_url`, or feed URL.
- Filter tracking pixels, logos, avatars, tiny placeholders, and data URIs.
- Extract YouTube, Vimeo, Bilibili, native video, iframe embeds, and video enclosures.
- Prefer `media:thumbnail`, `og:image`, `twitter:image`, and useful article images.

### 3. Add Content Type Classification

Classification should be deterministic and cheap.

Recommended rules:

- `video`: video enclosure, video MIME type, known video URL, iframe video embed, or media content marked video.
- `audio`: audio enclosure or audio MIME type.
- `gallery`: at least 3 meaningful images and the text is not clearly long-form.
- `image`: one strong lead image and short/medium text.
- `article`: default fallback.

Do not use feed `view_type` alone as the final content type. Feed-level `view_type` is useful as a hint, but RSS entries often mix content.

### 4. Add Mobile-Friendly API Endpoints

Keep existing desktop APIs stable. Add mobile-specific endpoints or extend existing output safely.

Recommended endpoints:

```text
GET /api/mobile/entries
GET /api/mobile/entries/:id
GET /api/mobile/sources
POST /api/mobile/sources
PATCH /api/mobile/entries/:id
POST /api/mobile/sync
```

`GET /api/mobile/entries` should return lightweight inbox rows:

- id
- feed id/title/favicon/group
- title
- preview text
- published/inserted time
- read/starred
- content type
- lead image
- video thumbnail/duration when available
- cursor pagination

`GET /api/mobile/entries/:id` should return the full presentation model:

- metadata
- reader HTML
- content type
- images array
- video model
- AI summary if available
- extraction status
- original URL

### 5. Improve Article Extraction Coverage

Current extraction is already useful, but mobile reading needs stricter output quality.

Recommended improvements:

- Store extraction status in API responses so the UI can show fallback states.
- If `readability_content` is missing, use feed HTML immediately and show an unobtrusive `Original` action.
- Queue extraction for article-like entries even if feed `view_type` is imperfect.
- Preserve code blocks, blockquotes, headings, figures, captions, and images.
- Sanitize reader HTML on the frontend before rendering.

### 6. Optional Later Schema Enhancements

Do not block MVP on these, but they would make parsing faster and more reliable:

- `entries.content_type`
- `entries.media_json`
- `entries.reader_text`
- `entries.word_count`
- `entries.reading_time_minutes`

For MVP, content type and media can be computed at response time.

## Frontend Work

### 1. Replace the Vite Starter

Remove the scaffold UI:

- `src/components/HelloWorld.vue`
- starter images and starter CSS if unused

Build a real app shell:

```text
src/
  api/
    client.ts
    mobile.ts
  components/
    app/
    inbox/
    reader/
    sources/
  composables/
    useInbox.ts
    useReader.ts
    useSources.ts
  stores/
    inboxStore.ts
    sourceStore.ts
    settingsStore.ts
  views/
    InboxView.vue
    ReaderView.vue
    SourcesView.vue
    SavedView.vue
    SettingsView.vue
  router/
    index.ts
  types.ts
```

Add dependencies:

- `pinia`
- `vue-router`
- `dompurify`
- icon library, preferably `lucide-vue-next`

### 2. Implement App Navigation

Use bottom tabs:

- Inbox
- Sources
- Saved
- Settings

Mobile should feel like an app, not a web dashboard. Keep navigation shallow.

### 3. Implement Inbox

Match the approved concept:

- Header with Aurora, search, sync.
- Segmented filter: All, Unread, Saved.
- Horizontal group chips.
- Cursor-based infinite list.
- Mixed rows with content type hints.
- Pull-to-refresh or sync button.
- Mark read on open or explicit action, depending on setting.

Inbox row variants:

- Text-first article row.
- Image row with thumbnail.
- Gallery row with image count.
- Video row with thumbnail and play badge.

### 4. Implement Reader Templates

Route all entries through one reader view and switch internal template by `content_type`.

Components:

- `ArticleReader.vue`
- `ImageReader.vue`
- `GalleryReader.vue`
- `VideoReader.vue`
- `ReaderActions.vue`
- `AISummaryPanel.vue`
- `MediaViewer.vue`

Article reader:

- title, metadata, AI summary, reader HTML, bottom actions.

Image reader:

- lead image, intro, image stream/grid, captions, fullscreen viewer.

Gallery reader:

- image-focused grid or vertical stream with minimal text.

Video reader:

- cover/player placeholder, open video fallback, description, AI summary.

### 5. Implement Sources

Keep source management minimal:

- URL input.
- Add button.
- Grouped sources.
- Favicon, title, unread count, last sync, enabled toggle.
- Show `Auto-detected` or `RSSHub` only as subtle metadata.

No subscription type dropdown.

### 6. Styling

Use the design in:

- `rss-mobile/design/ui/README.md`
- `rss-mobile/design/ui/concepts/`

Core tokens:

```css
--color-bg: #f8f7f3;
--color-surface: #ffffff;
--color-text: #202421;
--color-muted: #71746f;
--color-border: #e3e0d8;
--color-primary: #2f8f83;
--color-warning: #c8842c;
--radius-sm: 6px;
--radius-md: 8px;
```

Keep cards and panels at 8px radius or less.

## Development Phases

Recommended order:

1. Build the backend mobile presentation contract first.
2. Replace the mobile scaffold with app shell and API wiring.
3. Implement the inbox and source management.
4. Implement reader templates.
5. Polish Capacitor behavior and package.

### Phase 1: Backend Contract

Goal: make mobile data stable.

- Add `entryPresentation` service.
- Add content type detection.
- Add image and video extraction helpers.
- Add mobile endpoints.
- Add focused tests for classification and media extraction.

Acceptance:

- Mobile inbox can render mixed content without frontend guessing.
- Reader endpoint returns enough data for article, image, gallery, and video templates.

### Phase 2: Mobile App Shell

Goal: replace scaffold with real app structure.

- Add router, Pinia, API client, app shell.
- Add bottom navigation.
- Add Inbox, Sources, Saved, Settings route placeholders.
- Connect to backend base URL via `VITE_API_BASE_URL`.

Acceptance:

- App builds with `pnpm build`.
- App can load feeds and entries from backend.

### Phase 3: Inbox and Source Management

Goal: first usable RSS mobile workflow.

- Implement inbox list, filters, group chips, pagination.
- Implement read/star actions.
- Implement sources list and add-feed flow.
- Implement manual sync.

Acceptance:

- User can add a feed, sync it, browse entries, open an entry, mark read, and save.

### Phase 4: Reader Templates

Goal: match v2 design value.

- Implement article reader.
- Implement image/gallery reader.
- Implement video reader with external fallback.
- Add AI summary panel when available.
- Add original/share/save actions.

Acceptance:

- The same inbox can open text, image, gallery, and video entries into appropriate layouts.

### Phase 5: Polish and Packaging

Goal: mobile app quality.

- Responsive safe-area handling.
- Loading, empty, error, offline-ish states.
- Capacitor status bar and keyboard behavior.
- Android/iOS smoke tests.
- Performance check for long lists and large article HTML.

Acceptance:

- `pnpm typecheck` passes.
- `pnpm build` passes.
- `pnpm cap:sync` succeeds.
- Android/iOS projects open from Capacitor.

## Risk Assessment

### Low Risk

- Vue mobile UI implementation.
- Bottom navigation and route structure.
- Read/star/source management using existing APIs.
- Basic article reader using existing content fields.

### Medium Risk

- Consistent image/gallery detection across RSS sources.
- Video platform detection and thumbnail selection.
- Readability extraction reliability.
- Sanitized rendering of mixed HTML on mobile.

### High Risk

- Embedded video playback inside app webviews across iOS/Android.
- Feeds with malformed HTML or unconventional media tags.
- Large image-heavy articles causing memory or scroll jank.

Mitigation:

- Prefer backend classification with frontend fallback states.
- Do not require embedded playback for MVP; always provide `Open video`.
- Lazy-load images.
- Keep `Original` action visible in reader.
- Treat content classification as a heuristic, not an irreversible data model.

## Final Recommendation

Proceed with the v2 mobile rewrite.

The project already has enough backend foundation to support the proposed UI, but the rewrite should start with the backend presentation layer instead of jumping directly into Vue screens. Once `content_type`, `lead_image`, `images`, `video`, and `reader_html` are stable, the mobile frontend becomes a straightforward implementation of the saved design.

The right architecture is:

> Backend parses and classifies RSS content. Mobile frontend renders simple, fast, content-aware templates.
