# pura

![pura social preview](assets/pura-social-preview.png)

pura is a LAN Android device mirror for product and design teams. A central Hub shows all online Android devices, while each developer runs a local Agent that talks to their own USB-connected phone through ADB.

No login, no cloud, no public tunnel. It is meant for trusted office networks.

## Quickstart

Start the Hub with Docker Compose:

```bash
docker compose up -d
```

Open the Hub:

```text
http://<hub-lan-ip>:8787
```

On each developer machine, connect an Agent:

```bash
npx pura-cli connect <hub-lan-ip>:8787 --name "Zhang San"
```

On macOS, keep the Agent connected after login or terminal close. Install the CLI globally first so the background service has a stable executable path:

```bash
npm install -g pura-cli
pura-cli auto-connect --install
```

Publish the local Android device:

```bash
npx pura-cli connect device --name "Zhang San Pixel 8" --owner "Zhang San" --note "login branch"
```

Designers can now pick the published machine on the Hub homepage, open the live screen, and click on it with a mouse.

## Project Site

The GitHub Pages site lives in `site/` and is deployed by `.github/workflows/pages.yml`.

After publishing the repository, enable GitHub Pages with GitHub Actions as the source. The public URL will be:

```text
https://<owner>.github.io/pura/
```

## Requirements

- Node.js 20+ for developer Agents
- Android platform-tools: `adb`
- Android USB debugging enabled and authorized on each developer machine
- Docker and Docker Compose for Hub deployment
- Hub can reach every Agent over the LAN
- A modern browser

## Installation

Developers can use pura without installing it permanently:

```bash
npx pura-cli --help
```

Or install globally:

```bash
npm install -g pura-cli
pura-cli --help
```

For repository development:

```bash
npm install
npm run build
npm link
```

## Hub Deployment

Recommended Docker Compose deployment:

```bash
docker compose up -d
```

The included compose file builds the local image by default. To use a published GHCR image:

```bash
PURA_IMAGE=ghcr.io/<owner>/pura:latest docker compose up -d
```

Equivalent Node.js deployment:

```bash
pura-cli hub --host 0.0.0.0 --port 8787
```

## Developer Agent

Each developer connects their local Agent to the Hub:

```bash
pura-cli connect 192.168.100.128:8787 --name "Zhang San"
```

The Agent listens on `8788` by default and continuously reports local ADB devices to the Hub.

If the Hub cannot reach the auto-detected Agent URL, specify it:

```bash
pura-cli connect 192.168.100.128:8787 --name "Zhang San" --public-url http://192.168.100.45:8788
```

The Agent heartbeat automatically recovers after Wi-Fi or Hub restarts as long as the Agent process is still running. On macOS, install the saved Agent connection as a LaunchAgent so it starts at login and restarts if the terminal is closed:

```bash
pura-cli auto-connect --install
```

Check or remove the background service:

```bash
pura-cli auto-connect --status
pura-cli auto-connect --uninstall
```

## Publish Device

Connect a phone over USB and confirm it is authorized:

```bash
adb devices -l
```

Then publish it:

```bash
pura-cli connect device --name "Zhang San Pixel 8" --owner "Zhang San" --note "login branch"
```

If multiple Android devices are connected:

```bash
pura-cli connect device --serial RFCY10DHQ3P --name "Samsung S25" --owner "Li Si"
```

## Runtime Model

- Hub maintains online Agents and devices, serves the web UI, and proxies video WebSocket/tap requests.
- Agent runs on each developer machine and owns ADB, screen capture, tap execution, and device metadata.
- CLI commands:
  - `pura-cli hub`
  - `pura-cli connect <hub>`
  - `pura-cli auto-connect`
  - `pura-cli connect device`
  - `pura-cli devices`

## API

Hub:

- `POST /api/agents/heartbeat`
- `GET /api/devices`
- `POST /api/devices/:deviceId/session`
- `POST /api/devices/:deviceId/tap`
- `PUT /api/devices/:deviceId/publication`
- `DELETE /api/devices/:deviceId/publication`
- `DELETE /api/sessions/:id`
- `WS /ws/sessions/:id/video`

Agent:

- `GET /api/devices`
- `POST /api/devices/:serial/session`
- `POST /api/devices/:serial/tap`
- `PUT /api/devices/:serial/publication`
- `DELETE /api/devices/:serial/publication`
- `DELETE /api/sessions/:id`
- `WS /ws/sessions/:id/video`

## Environment

- `ROLE=hub|agent|standalone`
- `HOST=0.0.0.0`
- `PORT=8787`
- `HUB_URL=http://<hub-ip>:8787`
- `AGENT_ID`
- `AGENT_NAME`
- `PUBLIC_URL=http://<agent-ip>:8788`
- `ADB_PATH=adb`
- `STREAM_SIZE=1280x720`
- `STREAM_BITRATE=1500000`
- `STREAM_TIME_LIMIT_SECONDS=180`
- `INCLUDE_TCP_DEVICES=true`
- `DATA_DIR=data-agent`

## Publishing

The npm package name is `pura-cli` because `pura` is already taken on npm.

Release flow:

1. Update `version` in `package.json`.
2. Run `npm run check`, `npm run build`, and `npm pack --dry-run`.
3. Push a tag like `v0.1.0`.
4. GitHub Actions publishes `pura-cli` to npm and `ghcr.io/<owner>/<repo>` to GHCR.

The release workflow requires an `NPM_TOKEN` repository secret.

## Notes

- The current video path uses Android `screenrecord` H.264 output. No Android app or root is required.
- Mouse control currently supports tap only.
- Do not expose Hub or Agent ports directly to the public internet.
- Agent Docker is intentionally not the default because local USB/ADB access is much smoother with native `pura-cli`.
- Some Android builds enforce `screenrecord` time limits; the Agent restarts the stream automatically when it exits.
