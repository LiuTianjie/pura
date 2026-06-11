# Contributing to pura

Thanks for helping improve pura. The project is intentionally small: a Hub for designers to view devices, and a developer Agent/CLI that talks to local Android devices through ADB.

## Local development

```bash
npm install
npm run dev
```

Useful commands:

```bash
npm run check
npm run build
npm audit --omit=dev
```

## Hub and Agent locally

Start a Hub:

```bash
npm run build
ROLE=hub PORT=8787 node server/dist/index.js
```

Start an Agent in another terminal:

```bash
ROLE=agent HUB_URL=http://127.0.0.1:8787 PORT=8788 PUBLIC_URL=http://127.0.0.1:8788 node server/dist/index.js
```

## Pull requests

- Keep changes focused and small.
- Update README when changing user-facing commands, ports, or deployment behavior.
- Run `npm run check` and `npm run build` before opening a PR.
- Do not add authentication or public-network exposure by default; pura is currently designed for trusted LAN use.

## Release checklist

1. Update `version` in `package.json`.
2. Run `npm run check`, `npm run build`, and `npm pack --dry-run`.
3. Create a tag like `v0.1.0`.
4. Push the tag. GitHub Actions publishes `pura-cli` to npm and `ghcr.io/<owner>/<repo>` to GHCR.
