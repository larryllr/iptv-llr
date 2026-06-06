# IPTV LLR

Cloudflare-hosted IPTV channel management with Windows and Android clients.

## Components

- `apps/worker`: Cloudflare Worker API and channel synchronization.
- `apps/admin`: React channel administration site.
- `apps/client`: Flutter Windows and Android player.
- `packages/contracts`: Shared channel schemas.

Video streams connect directly from each client to the source and never pass
through Cloudflare.

