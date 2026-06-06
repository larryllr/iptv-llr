# IPTV Platform Design

## Goal

Build a maintainable IPTV platform consisting of:

- A Cloudflare-hosted channel management website and synchronization API.
- A Flutter client distributed as a Windows portable package and an Android APK.
- Direct client-side playback so video traffic does not pass through Cloudflare.

The public hostname is `neycbs.de5.net`.

## Product Scope

### Management Website

The website is an administration surface, not the primary player. It provides:

- Administrator login with one shared password.
- Automatic synchronization of channels derived from the `imzyb/iptv-api` project.
- CRUD operations for custom channels.
- Override and disable rules for automatically synchronized channels.
- Category, ordering, logo, source line, and visibility management.
- A preview of the effective channel list exposed to clients.
- Manual synchronization and synchronization status.

The initial administrator password is provided during deployment as a Cloudflare
Secret. It must never be committed to source control, stored in public KV data, or
embedded in either client package.

### Windows and Android Client

The client uses one Flutter codebase and ships as:

- A portable Windows ZIP containing the executable and runtime files.
- An Android APK for side loading.

The client provides:

- Channel categories, search, favorites, history, and source-line selection.
- Direct playback through a libmpv-based playback layer.
- Support for protocols and formats available through the bundled mpv/FFmpeg
  runtime, including common HTTP, HLS, RTSP, RTMP, and UDP sources.
- Synchronization from the Cloudflare API with an offline local cache.
- Manual playlist import for M3U/M3U8 and compatible text URLs.
- Two selectable layouts:
  - Layout A: cinema-style player with a horizontal channel rail.
  - Layout B: television-style player with a channel sidebar.
- Layout A as the default.
- Automatic playback UI hiding after 3, 5, or 10 seconds of inactivity, with
  3 seconds as the default.
- Immediate UI restoration on mouse movement, keyboard navigation, click, touch,
  or remote-style directional input.

## Architecture

### Cloudflare Worker

A single Worker serves:

- The static React administration application.
- Public read-only client configuration and channel endpoints.
- Authenticated administration endpoints.
- Synchronization logic for the upstream channel result.

The Worker does not proxy, relay, cache, or transcode video traffic.

### Cloudflare KV

KV stores:

- Custom channel records.
- Overrides keyed by stable upstream channel identity.
- Disabled channel identities.
- Category and ordering metadata.
- The last successfully normalized upstream snapshot.
- Synchronization status and revision metadata.
- Short-lived administrator sessions.

Writes are infrequent and administrator-driven, which fits KV's consistency model.
Clients use a published revision value to determine whether a cached list is stale.

### Flutter Client

The client is divided into focused modules:

- API and local-cache repository.
- Channel normalization and playlist import.
- Playback controller and platform mpv adapters.
- Favorites and history storage.
- Layout A and Layout B presentation shells.
- Shared overlay controls and inactivity controller.
- Settings and diagnostics.

The UI remains responsive while player lifecycle and network work run outside the
main rendering path.

## Data Model

Each effective channel contains:

- Stable ID.
- Name and optional aliases.
- Category.
- Optional logo URL.
- Ordered source lines.
- Source protocol and optional quality label.
- Origin: upstream or custom.
- Enabled state and display order.
- Last update timestamp.

An override may replace name, category, logo, source lines, enabled state, or
display order without mutating the cached upstream snapshot.

The effective client list is produced by applying disable rules and overrides to
the upstream snapshot, then merging custom channels and sorting the result.

## Data Flow

1. An administrator triggers synchronization or the scheduled Worker job runs.
2. The Worker retrieves the latest published upstream channel result.
3. The Worker parses and normalizes the source into stable channel records.
4. The normalized snapshot and synchronization metadata are stored in KV.
5. Public API responses merge the snapshot with administrator overrides and custom
   channels.
6. A client requests the revision, downloads changed data, and writes an offline
   cache.
7. Playback connects directly from the client device to the selected source URL.

If synchronization fails, the last valid snapshot remains active and the
administration UI displays the failure.

## Authentication and Security

- The administrator password is stored as a Cloudflare Secret.
- Login compares a derived password value server-side and returns a random,
  short-lived session token.
- Session tokens are stored as hashed values with expiry metadata in KV.
- Mutating endpoints require the session token and same-origin checks.
- Login attempts are rate limited.
- Channel URL input is validated by scheme and length.
- Secrets are excluded from logs and API responses.
- Public client endpoints expose channel configuration only.

## Player Behavior

- Selecting a channel starts its preferred source line.
- A playback failure can advance to the next source line, with a visible status.
- The user can manually select any available source line.
- Unsupported or failed sources show actionable diagnostics rather than an endless
  loading state.
- Overlay inactivity begins only during playback.
- Pointer, touch, click, keyboard, and directional input reset the inactivity
  timer.
- When hidden, only video remains visible; input restores controls immediately.
- Accessibility settings and reduced-motion preferences are respected.

## Error and Offline Handling

- Clients start from local cache when the API is unavailable.
- A stale-data indicator is shown without blocking playback.
- Failed channel updates never replace a valid local cache.
- Upstream synchronization is atomic from the client's perspective.
- Invalid custom records are rejected with field-level errors.
- Playback diagnostics include protocol, selected line, mpv error summary, and
  retry actions without exposing credentials embedded in URLs.

## Deployment

- Cloudflare Worker and KV are deployed with Wrangler.
- `neycbs.de5.net` is attached as a custom domain or route after DNS ownership is
  available in the selected Cloudflare account.
- The administrator password is added with `wrangler secret put`.
- GitHub Actions builds the Worker, Windows portable artifact, and Android APK.
- Release tags publish the Windows ZIP and Android APK as GitHub release assets.

## Testing and Acceptance

### Worker and Website

- Unit tests cover upstream normalization, override merging, authentication,
  validation, and stale-snapshot behavior.
- Administration browser tests cover login, synchronization, custom channel CRUD,
  override editing, and logout.
- No video request is routed through the Worker.

### Client

- Unit tests cover caching, merging, settings, source failover, and inactivity
  timing.
- Widget tests cover both layouts and responsive behavior.
- Windows and Android smoke tests cover synchronization, playback startup,
  source switching, layout switching, and UI auto-hide at 3/5/10 seconds.
- Layout A is selected on first launch.

### Delivery

- The Worker deploys successfully.
- The custom domain serves the administration site over HTTPS.
- GitHub Actions produces a Windows portable ZIP and Android APK.
- No administrator secret exists in the repository or generated client artifacts.

## Deferred Work

- Store distribution through Microsoft Store or Google Play.
- Server-side transcoding.
- Multi-administrator accounts and role-based access.
- Electronic program guide enrichment beyond data already present in channel
  sources.
