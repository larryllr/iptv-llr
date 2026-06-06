# IPTV Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a Cloudflare channel-management service plus portable Windows and Android IPTV clients, then publish source and release workflows to `larryllr/iptv-llr`.

**Architecture:** A TypeScript Cloudflare Worker serves a React administration UI and JSON API backed by KV. A Flutter application consumes the public API, caches channels locally, and plays streams directly through media_kit/libmpv without routing video through Cloudflare.

**Tech Stack:** TypeScript, Cloudflare Workers, Hono, React, Vite, Vitest, Playwright, Flutter, Riverpod, Dio, Drift/shared_preferences, media_kit, GitHub Actions, Wrangler.

---

## File Structure

- `apps/admin/`: React administration application.
- `apps/worker/`: Worker routes, authentication, synchronization, KV repositories, and tests.
- `apps/client/`: Flutter Windows and Android client.
- `packages/contracts/`: Shared JSON schema and generated TypeScript contracts.
- `.github/workflows/`: verification, Cloudflare deployment, and client release workflows.
- `docs/`: architecture, operations, playlist format, and release documentation.

### Task 1: Initialize the Monorepo

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `README.md`

- [ ] **Step 1: Initialize Git and connect the remote**

Run:

```powershell
git init -b main
git remote add origin https://github.com/larryllr/iptv-llr.git
```

Expected: `git remote -v` lists `origin` for fetch and push.

- [ ] **Step 2: Add workspace configuration**

Define scripts for `lint`, `test`, `build`, and `typecheck`, pin Node 22+, and
ignore generated assets, secrets, Flutter build output, `.wrangler`, and visual
brainstorm files.

- [ ] **Step 3: Install JavaScript dependencies**

Run:

```powershell
corepack enable
pnpm install
```

Expected: lockfile is created without dependency errors.

- [ ] **Step 4: Verify the empty workspace**

Run:

```powershell
pnpm lint
pnpm test
```

Expected: both commands exit successfully with no packages skipped unexpectedly.

- [ ] **Step 5: Commit**

```powershell
git add .gitignore package.json pnpm-workspace.yaml tsconfig.base.json README.md pnpm-lock.yaml docs
git commit -m "chore: initialize IPTV platform workspace"
```

### Task 2: Define Channel Contracts and Validation

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/src/channel.ts`
- Create: `packages/contracts/src/api.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/channel.test.ts`

- [ ] **Step 1: Write failing schema tests**

Cover a valid channel, rejection of an empty source list, allowed schemes
(`http`, `https`, `rtsp`, `rtmp`, `udp`), maximum URL length, override fields,
and public response revision metadata.

- [ ] **Step 2: Run tests and verify failure**

Run: `pnpm --filter @iptv/contracts test`

Expected: FAIL because schemas and inferred types do not exist.

- [ ] **Step 3: Implement Zod contracts**

Create `SourceLine`, `Channel`, `ChannelOverride`, `CustomChannel`,
`PublicChannelResponse`, and `SyncStatus` schemas. Stable IDs are lowercase
SHA-256-derived identifiers represented as 24 hexadecimal characters.

- [ ] **Step 4: Run contract verification**

Run:

```powershell
pnpm --filter @iptv/contracts test
pnpm --filter @iptv/contracts typecheck
```

Expected: all tests pass and TypeScript reports no errors.

- [ ] **Step 5: Commit**

```powershell
git add packages/contracts
git commit -m "feat: define channel API contracts"
```

### Task 3: Implement Upstream Parsing and Effective Channel Merging

**Files:**
- Create: `apps/worker/package.json`
- Create: `apps/worker/src/domain/parse-playlist.ts`
- Create: `apps/worker/src/domain/merge-channels.ts`
- Create: `apps/worker/src/domain/stable-id.ts`
- Create: `apps/worker/test/parse-playlist.test.ts`
- Create: `apps/worker/test/merge-channels.test.ts`
- Create: `apps/worker/test/fixtures/upstream.txt`

- [ ] **Step 1: Write failing parser tests**

Test M3U metadata, comma-separated channel lines, duplicate source aggregation,
category fallback, malformed rows, and deterministic IDs.

- [ ] **Step 2: Verify parser tests fail**

Run: `pnpm --filter @iptv/worker test -- parse-playlist`

Expected: FAIL because parser modules are absent.

- [ ] **Step 3: Implement normalization**

Parse structured M3U attributes and simple `name,url` records, trim BOM and
whitespace, reject invalid schemes, aggregate sources by stable channel identity,
and retain source order.

- [ ] **Step 4: Write and implement merge tests**

Verify disable rules, partial overrides, source replacement, custom-channel
insertion, category ordering, channel ordering, and non-mutation of snapshots.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @iptv/worker test`

Expected: parser and merge suites pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/worker
git commit -m "feat: normalize and merge IPTV channel sources"
```

### Task 4: Implement KV Repositories and Public API

**Files:**
- Create: `apps/worker/wrangler.jsonc`
- Create: `apps/worker/src/env.ts`
- Create: `apps/worker/src/repositories/channel-repository.ts`
- Create: `apps/worker/src/routes/public.ts`
- Create: `apps/worker/src/app.ts`
- Create: `apps/worker/src/index.ts`
- Create: `apps/worker/test/public-api.test.ts`

- [ ] **Step 1: Write failing API tests**

Test `GET /api/v1/revision`, `GET /api/v1/channels`, ETag/304 behavior, empty
snapshot behavior, and effective-list merging.

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @iptv/worker test -- public-api`

Expected: FAIL because the application and repository are absent.

- [ ] **Step 3: Implement repository keys and routes**

Use versioned KV keys for snapshot, overrides, custom channels, disabled IDs,
sync status, and revision. Return cacheable public JSON with no secret fields.

- [ ] **Step 4: Verify API tests**

Run:

```powershell
pnpm --filter @iptv/worker test
pnpm --filter @iptv/worker typecheck
```

Expected: all worker tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/worker
git commit -m "feat: expose public channel synchronization API"
```

### Task 5: Implement Administrator Authentication

**Files:**
- Create: `apps/worker/src/security/password.ts`
- Create: `apps/worker/src/security/session.ts`
- Create: `apps/worker/src/security/rate-limit.ts`
- Create: `apps/worker/src/middleware/admin-auth.ts`
- Create: `apps/worker/src/routes/auth.ts`
- Create: `apps/worker/test/auth.test.ts`

- [ ] **Step 1: Write failing authentication tests**

Test valid and invalid login, rate limiting, random token creation, hashed session
storage, expiry, logout, cookie flags, and rejection of unauthorized mutations.

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @iptv/worker test -- auth`

Expected: FAIL because authentication routes are absent.

- [ ] **Step 3: Implement authentication**

Compare the submitted password against the `ADMIN_PASSWORD` Worker Secret using a
constant-time digest comparison. Store only SHA-256 session-token hashes in KV,
expire sessions after 12 hours, and issue `HttpOnly`, `Secure`, `SameSite=Strict`
cookies.

- [ ] **Step 4: Run security tests**

Run: `pnpm --filter @iptv/worker test`

Expected: authentication and existing suites pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/worker
git commit -m "feat: secure IPTV administration endpoints"
```

### Task 6: Implement Synchronization and Administration API

**Files:**
- Create: `apps/worker/src/services/upstream-sync.ts`
- Create: `apps/worker/src/routes/admin.ts`
- Modify: `apps/worker/src/index.ts`
- Create: `apps/worker/test/upstream-sync.test.ts`
- Create: `apps/worker/test/admin-api.test.ts`

- [ ] **Step 1: Write failing synchronization tests**

Test successful fetch, candidate URL discovery, atomic snapshot replacement,
last-good retention on failure, revision increment, and sync-status updates.

- [ ] **Step 2: Verify failure**

Run: `pnpm --filter @iptv/worker test -- upstream-sync`

Expected: FAIL because synchronization is absent.

- [ ] **Step 3: Implement synchronization**

Fetch the configured upstream result URL, parse it, reject an empty normalized
result, write the complete snapshot, then update revision and status. Register a
daily scheduled handler and an authenticated manual trigger.

- [ ] **Step 4: Add administration CRUD**

Implement authenticated endpoints for custom channels, overrides, disabled IDs,
ordering, status, and effective-list preview. Validate every payload with shared
contracts.

- [ ] **Step 5: Run worker verification**

Run:

```powershell
pnpm --filter @iptv/worker test
pnpm --filter @iptv/worker typecheck
```

Expected: all worker tests pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/worker
git commit -m "feat: add channel synchronization and admin API"
```

### Task 7: Build the React Administration Site

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/index.html`
- Create: `apps/admin/src/main.tsx`
- Create: `apps/admin/src/app/App.tsx`
- Create: `apps/admin/src/api/client.ts`
- Create: `apps/admin/src/features/auth/LoginPage.tsx`
- Create: `apps/admin/src/features/channels/ChannelTable.tsx`
- Create: `apps/admin/src/features/channels/ChannelEditor.tsx`
- Create: `apps/admin/src/features/sync/SyncPanel.tsx`
- Create: `apps/admin/src/styles.css`
- Create: `apps/admin/src/**/*.test.tsx`

- [ ] **Step 1: Generate and approve the full administration-screen concept**

Create a complete desktop and mobile visual concept covering login, channel table,
editor, override state, synchronization status, and navigation. Record tokens,
typography, component variants, and responsive behavior.

- [ ] **Step 2: Write failing component tests**

Test login submission, channel filtering, editor validation, save/delete actions,
sync trigger, error display, and logout.

- [ ] **Step 3: Implement the design system and pages**

Build accessible React components using the approved dark media-console visual
system. Keep table-driven desktop management and a compact mobile list without
inventing unrelated dashboard metrics.

- [ ] **Step 4: Integrate Worker static assets**

Build admin assets into the Worker asset directory and route unknown non-API paths
to `index.html`.

- [ ] **Step 5: Run frontend tests**

Run:

```powershell
pnpm --filter @iptv/admin test
pnpm --filter @iptv/admin build
pnpm --filter @iptv/admin typecheck
```

Expected: component tests pass and production assets build.

- [ ] **Step 6: Browser fidelity verification**

Run the Worker locally, verify login and CRUD at desktop and mobile sizes, capture
screenshots, compare them with the accepted concepts, and repair all material
layout, typography, palette, icon, and responsive differences.

- [ ] **Step 7: Commit**

```powershell
git add apps/admin apps/worker
git commit -m "feat: add channel administration website"
```

### Task 8: Scaffold Flutter Client and Domain Layer

**Files:**
- Create: `apps/client/pubspec.yaml`
- Create: `apps/client/lib/main.dart`
- Create: `apps/client/lib/src/models/channel.dart`
- Create: `apps/client/lib/src/api/channel_api.dart`
- Create: `apps/client/lib/src/repositories/channel_repository.dart`
- Create: `apps/client/lib/src/storage/local_store.dart`
- Create: `apps/client/lib/src/import/m3u_parser.dart`
- Create: `apps/client/test/channel_repository_test.dart`
- Create: `apps/client/test/m3u_parser_test.dart`

- [ ] **Step 1: Install Flutter SDK for local development**

Install the current stable Flutter SDK, enable Windows desktop support, and run
`flutter doctor`. Android toolchain warnings may remain local because CI owns the
release APK build.

- [ ] **Step 2: Create the Flutter project**

Run:

```powershell
flutter create --platforms=windows,android --org net.de5.neycbs apps/client
```

Expected: Windows and Android runners are generated.

- [ ] **Step 3: Write failing repository and parser tests**

Cover API revision checks, valid-cache replacement, stale-cache fallback, failed
download retention, M3U parsing, duplicate aggregation, and URL import.

- [ ] **Step 4: Implement domain and storage**

Use immutable models, Dio for HTTP, Riverpod for dependencies, and local JSON
storage for channel cache plus shared preferences for settings metadata.

- [ ] **Step 5: Run Flutter tests**

Run: `flutter test`

Expected: repository and parser suites pass.

- [ ] **Step 6: Commit**

```powershell
git add apps/client
git commit -m "feat: add Flutter channel synchronization core"
```

### Task 9: Implement Playback and Source Failover

**Files:**
- Create: `apps/client/lib/src/player/player_controller.dart`
- Create: `apps/client/lib/src/player/player_view.dart`
- Create: `apps/client/lib/src/player/playback_diagnostics.dart`
- Create: `apps/client/test/player_controller_test.dart`
- Modify: `apps/client/pubspec.yaml`
- Modify: platform runner files required by `media_kit`

- [ ] **Step 1: Write failing controller tests**

Test preferred-line startup, automatic next-line failover, manual line selection,
stop/dispose behavior, redacted diagnostics, and terminal failure state.

- [ ] **Step 2: Verify failure**

Run: `flutter test test/player_controller_test.dart`

Expected: FAIL because playback controller does not exist.

- [ ] **Step 3: Implement media_kit/libmpv playback**

Wrap media_kit behind a testable adapter, initialize native libraries for Windows
and Android, pass network-cache options conservatively, and ensure URLs flow
directly from device to source.

- [ ] **Step 4: Verify tests and native builds**

Run:

```powershell
flutter test
flutter build windows --debug
```

Expected: tests pass and the Windows debug application builds.

- [ ] **Step 5: Commit**

```powershell
git add apps/client
git commit -m "feat: add direct multi-protocol IPTV playback"
```

### Task 10: Build Layout A, Layout B, and Auto-Hide Controls

**Files:**
- Create: `apps/client/lib/src/settings/player_settings.dart`
- Create: `apps/client/lib/src/ui/layout_a.dart`
- Create: `apps/client/lib/src/ui/layout_b.dart`
- Create: `apps/client/lib/src/ui/player_overlay.dart`
- Create: `apps/client/lib/src/ui/channel_browser.dart`
- Create: `apps/client/lib/src/ui/settings_page.dart`
- Create: `apps/client/lib/src/ui/inactivity_controller.dart`
- Create: `apps/client/test/layout_test.dart`
- Create: `apps/client/test/inactivity_controller_test.dart`

- [ ] **Step 1: Generate and approve client concepts**

Create complete Windows and Android concepts for Layout A and Layout B, including
playing, loading, error, source selection, search, settings, and hidden-overlay
states. Extract a shared design system before implementation.

- [ ] **Step 2: Write failing settings and inactivity tests**

Verify first launch selects Layout A and 3 seconds; allowed delays are exactly
3/5/10 seconds; pointer, touch, click, keyboard, and directional events reveal
controls and restart the timer; paused playback keeps controls visible.

- [ ] **Step 3: Implement shared shell and layouts**

Layout A uses a large player with a horizontal channel rail. Layout B uses a
desktop sidebar that becomes a drawer or bottom sheet on narrow Android screens.
Both layouts share player, channel, settings, and state components.

- [ ] **Step 4: Implement auto-hide**

Start the timer only while playing. Animate overlay opacity and hit testing,
restore immediately on interaction, and honor reduced-motion preferences.

- [ ] **Step 5: Run widget tests**

Run:

```powershell
flutter test
flutter analyze
```

Expected: all tests pass and analyzer reports no issues.

- [ ] **Step 6: Visual verification**

Run Windows at the concept viewport and Android emulator at a representative phone
size. Verify both layouts, settings persistence, hidden controls, no overflow, and
concept fidelity using screenshots.

- [ ] **Step 7: Commit**

```powershell
git add apps/client
git commit -m "feat: add switchable IPTV player layouts"
```

### Task 11: Add Favorites, History, Search, and Diagnostics

**Files:**
- Create: `apps/client/lib/src/storage/user_library.dart`
- Create: `apps/client/lib/src/ui/favorites_page.dart`
- Create: `apps/client/lib/src/ui/history_page.dart`
- Create: `apps/client/lib/src/ui/diagnostics_sheet.dart`
- Create: `apps/client/test/user_library_test.dart`
- Modify: `apps/client/lib/src/ui/channel_browser.dart`

- [ ] **Step 1: Write failing user-library tests**

Test favorite toggling, bounded history, channel deletion cleanup, case-insensitive
search, category filtering, and persistence.

- [ ] **Step 2: Implement user library**

Persist only channel IDs and playback metadata, reconcile them against refreshed
channel data, and cap history at 100 entries.

- [ ] **Step 3: Add diagnostics UI**

Show source protocol, selected line, retry/failover actions, and redacted errors.
Never display URL credentials or query secrets.

- [ ] **Step 4: Run client verification**

Run: `flutter test && flutter analyze`

Expected: all tests pass.

- [ ] **Step 5: Commit**

```powershell
git add apps/client
git commit -m "feat: add IPTV discovery and user library"
```

### Task 12: Add End-to-End Tests and Documentation

**Files:**
- Create: `apps/admin/e2e/admin.spec.ts`
- Create: `apps/client/integration_test/app_test.dart`
- Create: `docs/operations.md`
- Create: `docs/client.md`
- Create: `docs/channel-format.md`
- Create: `LICENSE`

- [ ] **Step 1: Add administration E2E test**

Cover login, manual sync, custom channel creation, override editing, disable,
effective preview, and logout against a local Worker with isolated KV.

- [ ] **Step 2: Add Flutter integration smoke test**

Use a deterministic local HLS fixture and verify channel sync, playback state,
source switch, both layouts, and 3/5/10-second settings without relying on public
live streams.

- [ ] **Step 3: Write operator documentation**

Document Worker secrets, KV provisioning, upstream URL configuration, local
development, password rotation, deployment, client API URL, and troubleshooting.

- [ ] **Step 4: Run full verification**

Run:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
Set-Location apps/client
flutter analyze
flutter test
```

Expected: all checks pass.

- [ ] **Step 5: Commit**

```powershell
git add apps docs LICENSE
git commit -m "test: cover IPTV administration and client flows"
```

### Task 13: Configure CI, Releases, and Cloudflare Deployment

**Files:**
- Create: `.github/workflows/verify.yml`
- Create: `.github/workflows/release-clients.yml`
- Create: `.github/workflows/deploy-worker.yml`
- Create: `scripts/package-windows.ps1`
- Modify: `apps/worker/wrangler.jsonc`
- Modify: `README.md`

- [ ] **Step 1: Add verification workflow**

Run JavaScript checks on Ubuntu and Flutter analyze/tests on Ubuntu. Cache pnpm,
Flutter, and Pub packages.

- [ ] **Step 2: Add client release workflow**

On `v*` tags, build Windows on `windows-latest`, build Android APK on
`ubuntu-latest`, package the complete Windows runner directory into ZIP, and
attach both files to a GitHub Release.

- [ ] **Step 3: Add Worker deployment workflow**

On changes to `main`, build and deploy using `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repository secrets. Keep `ADMIN_PASSWORD` exclusively as
a Worker Secret and never inject it into the build.

- [ ] **Step 4: Validate workflows**

Run action linting and local production builds. Inspect generated artifacts for
accidental secrets using exact-secret and common credential-pattern scans.

- [ ] **Step 5: Commit**

```powershell
git add .github scripts apps/worker/wrangler.jsonc README.md
git commit -m "ci: build clients and deploy Cloudflare service"
```

### Task 14: Publish and Deploy

**Files:**
- No source files required unless deployment reveals a configuration defect.

- [ ] **Step 1: Push the main branch**

Run:

```powershell
git push -u origin main
```

Expected: source appears at `https://github.com/larryllr/iptv-llr`.

- [ ] **Step 2: Provision Cloudflare KV**

Create production and preview KV namespaces and place their IDs into
`wrangler.jsonc`.

- [ ] **Step 3: Store the administrator password**

Run `wrangler secret put ADMIN_PASSWORD` interactively and enter the user-provided
password. Do not echo, log, or place the value in shell history.

- [ ] **Step 4: Deploy the Worker**

Run: `pnpm --filter @iptv/worker deploy`

Expected: Wrangler reports a successful deployment.

- [ ] **Step 5: Attach the custom domain**

Configure `neycbs.de5.net` in the Cloudflare account that controls the relevant
DNS zone. Verify HTTPS, login, sync status, and public API responses.

- [ ] **Step 6: Configure GitHub deployment secrets**

Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in repository Actions
secrets without printing them.

- [ ] **Step 7: Create the first release**

Run:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

Expected: GitHub Actions publishes a Windows portable ZIP and Android APK.

- [ ] **Step 8: Final smoke test**

Install/extract both clients, sync from the production API, play at least one
compatible test channel, switch layouts, switch source lines, and confirm controls
hide at 3, 5, and 10 seconds.
