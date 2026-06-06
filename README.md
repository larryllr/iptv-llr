# IPTV LLR

Cloudflare-hosted IPTV channel management with Windows and Android clients.

## Components

- `apps/worker`: Cloudflare Worker API and channel synchronization.
- `apps/admin`: React channel administration site.
- `apps/client`: Flutter Windows and Android player.
- `packages/contracts`: Shared channel schemas.

Video streams connect directly from each client to the source and never pass
through Cloudflare.

## Development

```powershell
npm install
npm test
npm run build
npm run dev -w @iptv/admin
```

The administrator password is configured only as the Worker secret
`ADMIN_PASSWORD`. Never place it in source files or GitHub Actions variables.

## Deployment status

The web administration service is implemented. Cloudflare deployment requires
production KV namespace IDs and an account API token. Client release workflows
are added after the Flutter application is committed.
