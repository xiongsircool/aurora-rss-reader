# Aurora RSS Reader Mobile UI Design

This folder stores the approved mobile UI direction for `rss-mobile`.

The mobile app should not copy the desktop product. Its core product shape is:

> One RSS inbox for browsing, multiple content-aware reader templates for reading.

## Reference Images

- `concepts/01-inbox-mixed-feed.png` - main RSS inbox with mixed article, image, and video entries
- `concepts/02-reader-blog-longform.png` - long-form blog/article reader
- `concepts/03-reader-image-gallery.png` - image-rich article and gallery reader
- `concepts/04-reader-video.png` - video RSS entry reader
- `concepts/05-sources-management.png` - feed source management

## Product Direction

Keep the mobile product focused on fast RSS reading:

- Browse one unified feed inbox.
- Filter by all, unread, saved, and lightweight source groups.
- Open entries into content-aware reader templates.
- Add and manage feed sources with minimal controls.
- Keep AI assistance lightweight and contextual, mainly summary in reader screens.

Avoid turning mobile into a desktop settings console:

- No MCP configuration in the mobile UI.
- No complex AI workflow panels.
- No manual subscription type selector.
- No dashboard-heavy analytics views.
- No multiple browsing modes that compete with the main inbox.

## Navigation

Use a bottom tab bar:

- Inbox
- Sources
- Saved
- Settings

The default first screen is `Inbox`.

## Screens

### Inbox

The inbox is the only main browsing mode.

Required elements:

- App header with search and sync actions.
- Segmented filters: All, Unread, Saved.
- Source/group chips: Tech, Design, Video, Images, or user groups.
- Mixed RSS entry list.
- Entry rows adapt to content type with small visual hints.

Entry row content:

- Source name
- Title
- Short preview
- Publish time
- Unread marker
- Optional thumbnail for image and video entries
- Optional type hint: Article, Image, Gallery, Video

### Blog Reader

For normal RSS articles, blogs, newsletters, and long-form posts.

Required elements:

- Back navigation
- Source, publish time, reading time
- Title
- Optional compact AI Summary
- Clean article body
- Code block, quote, heading, list, and image styles
- Bottom actions: Summary, Save, Share, Original

### Image Reader

For image-rich posts, photo essays, comics, design inspiration, and tutorials.

Required elements:

- Title and source metadata
- Large lead image when available
- Body intro
- Image grid or vertical image stream
- Captions when available
- Fullscreen image viewer entry point
- Actions: Save, Share, Original

Filter out tiny tracking pixels, logos, and avatar-only images when choosing lead media.

### Video Reader

For RSS entries with video enclosures, `media:content`, iframe embeds, or known video links.

Required elements:

- Large video cover
- Play/open-video action
- Duration badge when known
- Title and source metadata
- Description
- Optional compact AI Summary
- Fallback actions: Open video, Read transcript, Original

Do not autoplay videos. If embedded playback is unreliable, prefer opening the original video.

### Sources

For adding and managing RSS subscriptions.

Required elements:

- Paste feed or site URL input
- Add action
- Source groups
- Source rows with favicon, name, unread count, last sync, enabled toggle
- Sync status

Subscription type should be auto-detected by the backend. The UI can show a subtle label such as `RSSHub` or `Auto-detected`, but should not ask users to choose RSS, Atom, JSON Feed, RSSHub, or web page parsing manually.

## Visual Style

- Background: off-white or very light warm gray.
- Text: charcoal, not pure black.
- Primary accent: muted teal.
- Secondary accent: restrained amber for unread/saved/status markers.
- Borders: thin, low-contrast dividers.
- Radius: 8px or less for cards and panels.
- Density: compact enough for mobile scanning, but not cramped.
- Typography: reader-first, stable sizes, no viewport-scaled fonts.

Avoid:

- Decorative gradient blobs.
- Large marketing hero sections.
- Nested cards.
- Purple-dominant palettes.
- Desktop dashboard layouts.
- Large empty visual padding that slows scanning.

## Implementation Notes

Recommended content type detection can be derived from parsed feed entry data:

- `video`: video enclosure, `media:content` video type, known video URL, or iframe video embed.
- `gallery`: multiple meaningful images.
- `image`: one meaningful lead image with short text.
- `article`: default fallback for text-first entries.

The detection result should guide rendering. It should not become a separate browsing mode.
