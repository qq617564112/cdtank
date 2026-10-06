# Web runtime configuration

The web client has its own package and TypeScript configuration in `apps/web`.
Dependencies remain installed in the workspace root with `npm install`.
Client type checking includes `apps/web/src` and `apps/shared`; server sources,
tests, and recovery evidence are outside this TypeScript entrypoint.

From the workspace root:

```sh
npm --prefix apps/web run typecheck
npm --prefix apps/web run dev
npm --prefix apps/web run build
npm --prefix apps/web run preview
```

From another directory, use the absolute package path:

```sh
npm --prefix /workspace/cdtank/apps/web run build
```

The root Vite configuration re-exports the web configuration, so existing root
commands continue to use the same entrypoint. The web root, public directory,
and output directory resolve independently of the command's working directory.

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `CDTANK_WEB_ASSETS` | `recovery/output/web-assets` | Public assets; relative paths resolve against the workspace root. Absolute paths are supported. |
| `CDTANK_GAME_SERVER` | `ws://127.0.0.1:3001` | WebSocket target for Vite's `/game` proxy; the upstream path is `/`. |
| `CDTANK_WEB_PORT` | `5173` | Vite development port. |
| `CDTANK_WEB_PREVIEW_PORT` | `4173` | Vite preview port. |

Set these variables in the command environment. Ports must be integers from
1 through 65535. Vite can choose the next available port if the requested port
is already occupied.

```sh
CDTANK_WEB_PORT=5175 CDTANK_GAME_SERVER=ws://127.0.0.1:3010 npm --prefix apps/web run dev
CDTANK_WEB_ASSETS=/srv/cdtank/web-assets npm --prefix apps/web run build
```

`build` type checks the client, then writes the static site to `dist/web`,
including a copy of the selected public assets. Asset generation is a separate
workspace command; the web build reads the asset directory and does not modify
it. Vite's preview server uses the same `/game` proxy for local verification.

Deploy `dist/web` with a static web server and configure that server to proxy
WebSocket upgrades on `/game` to the game server's `/` endpoint. The browser
connects to `/game` on its own host and uses `wss` on HTTPS pages. Vite's proxy
settings are local server configuration and are not embedded in the static
deployment. These settings contain paths, ports, and service addresses, not
credentials.
