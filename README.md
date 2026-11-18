# AutoGate

AutoGate security status, evaluation history inspector, live configuration sync, and session marks extension for [OpenChamber](https://github.com/btriapitsyn/openchamber) (`@openchamber/sdk`, `apiVersion: 1`, requires OpenChamber `>=2.7.1`).

## Features & Surfaces

- **Panel (`panel/index.html` → `panel/main.js`)**:
  - Toggle `Auto Mode` (`autoMode`) and switch the review fallback mode between `ntfy` (remote/mobile) and `native` (terminal prompt).
  - Monitor System 1 health, live runtime count, evaluation stats, and circuit breaker state (`consecutiveBlocks / threshold`) with one-click breaker reset.
  - Filter evaluation history by verdict (`All`, `ALLOW`, `BLOCK`, `UNSURE`), search across tool, command, reasoning, user prompt, and session ID, or scope to the current session.
  - Inspect full evaluation details including command preview, reasoning, user prompt, risk level, authorization level, latency, model, and System 1 / System 2 cascade trace (`winner`, `escalationReason`, `s1LatencyMs`, `s2LatencyMs`, `s2Aborted`, `inScopeScore`, `injectionScore`, `s1Probs`).
  - Polls `GET /api/state` every 2.5 seconds.
- **Work Status (`status/index.html` → `status/main.js`, title `AutoGate`, initial height `180px`)**:
  - Compact status pills for Auto Mode, fallback mode, System 1 status, and circuit breaker reset.
  - Lists up to 5 recent sessions (active in-flight sessions first, then newest activity), resolving session titles via the host `sessions` capability (`host.listProjects` / `host.listSessions`).
  - Clicking a session opens an anchored popover (`surface: "popover"`) when `features.popovers` is supported—or an inline detail drawer otherwise—showing up to 6 recent evaluations, cascade trace, `Jump to session` (for `ses_*` IDs), `Copy session ID`, and `Copy command`.
- **Host Service (`service/main.js`, `runtime: "host"`, `keepRunning: true`)**:
  - Listens on `127.0.0.1:$OPENCHAMBER_SERVICE_PORT` and requires `Authorization: Bearer $OPENCHAMBER_SERVICE_TOKEN` on all routes (including `/health`).
  - Periodically syncs sidebar session marks every 3 seconds via `ServiceHost.setMark` (enabled via `contributes.marks: true`):
    - `shield` (`warning`): action awaiting review (`inFlight[].awaitingReview`)
    - `close-circle` (`error`): latest verdict `BLOCK` within the last 15 minutes
    - `alert` (`warning`): latest verdict `UNSURE` within the last 15 minutes
    - Clears stale (>15 minutes) or `ALLOW`-resolved marks.
  - Normalizes both OpenCode flat JSONL and OMP nested (`action`/`decision`/`inference`/`model`) evaluation logs, reading up to the latest 512 KB / 200 entries.
  - Redacts `ntfyToken` and `systemOne.apiKey` from all API responses and status views (exposing only `hasNtfyToken` and `systemOne.hasApiKey`), and preserves unrelated keys/secrets when updating `config.json`.

## Service Endpoints

All endpoints require `Authorization: Bearer $OPENCHAMBER_SERVICE_TOKEN`:

- `GET /health` — Health check (`{ ok: true }`).
- `GET /status` — Returns a `GuestStatusView` (up to 16 rows) for host status rendering.
- `POST /status` — Handles `GuestStatusActionEvent` payloads (`toggle-automode`, `set-fallback`, `reset-breaker`).
- `GET /api/state` — Returns an `AutoGateStateSnapshot` (supports optional query params `directory`, `sessionId`, `verdict`, and `q`).
- `POST /api/action` — Applies live state mutations and returns `{ ok: true, state }`:
  - `{ "action": "setAutoMode", "enabled": boolean }`
  - `{ "action": "setFallbackMode", "mode": "ntfy" | "native" }`
  - `{ "action": "resetBreaker" }`

## Configuration & Environment Variables

### Config & State Files

`config.json` path resolution order:
1. `$AUTOGATE_CONFIG` (with `configDir` set to its parent directory)
2. `$XDG_CONFIG_HOME/autogate/config.json`
3. `~/.config/autogate/config.json` (default)

Additional files inside `configDir`:
- `runtime/*.json` — Live runtime state files written by AutoGate hooks (filtered by PID liveness via `process.kill(pid, 0)`).
- `control.json` — Stores `resetCircuitBreakerAt` when the circuit breaker is reset.

Evaluation log file resolution order:
1. Active runtime `evalLogFile` (if present)
2. `$AUTOGATE_EVAL_LOG`
3. `evalLogFile` or `omp.evalLogFile` in `config.json`
4. `~/.omp/logs/autogate-evals.jsonl` (default)

### Environment Variable Overrides

| Variable | `config.json` Key | Default |
| --- | --- | --- |
| `AUTOGATE_CONFIG` | — | `~/.config/autogate/config.json` |
| `AUTOGATE_EVAL_LOG` | `evalLogFile` / `omp.evalLogFile` | `~/.omp/logs/autogate-evals.jsonl` |
| `AUTOGATE_AUTO_MODE` / `OPENCODE_AUTO_MODE` | `autoMode` | `true` |
| `AUTOGATE_FALLBACK` | `reviewFallbackMode` / `fallbackMode` / `omp.reviewFallbackMode` | `"ntfy"` (`"ntfy"` or `"native"`) |
| `CLASSIFIER_MODEL` | `classifierModel` | `"google/gemini-3.5-flash-lite"` |
| `CLASSIFIER_TIMEOUT` | `classifierTimeout` | `45000` (ms) |
| `CONSECUTIVE_BLOCK_THRESHOLD` | `consecutiveBlockThreshold` | `3` |
| `AUTOGATE_NOTIFY_ON_VERDICT` | `notifyOnVerdict` | `true` |
| `NTFY_SERVER` | `ntfyServer` | `"https://ntfy.sh"` |
| `AUTOGATE_NTFY_TOPIC` / `NTFY_TOPIC` | `ntfyTopic` | `"autogate"` |
| `NTFY_TOKEN` / `AUTOGATE_NTFY_TOKEN` | `ntfyToken` | — (redacted) |
| `AUTOGATE_SYSTEM_ONE_ENABLED` | `systemOne.enabled` | `false` |
| `AUTOGATE_SYSTEM_ONE_MODE` | `systemOne.executionMode` | `"race"` (`"race"` or `"cascade"`) |
| `AUTOGATE_SYSTEM_ONE_ENDPOINT` | `systemOne.endpoint` | `"http://127.0.0.1:4006/v1/systemone"` |
| `AUTOGATE_SYSTEM_ONE_MODEL` | `systemOne.model` | `"gemini-decision-1"` |
| `AUTOGATE_SYSTEM_ONE_TIMEOUT_MS` | `systemOne.timeoutMs` | `4000` (ms) |
| `AUTOGATE_SYSTEM_ONE_API_KEY` | `systemOne.apiKey` | — (redacted) |

When launched by OpenChamber, the host also injects `OPENCHAMBER_SERVICE_PORT`, `OPENCHAMBER_SERVICE_TOKEN`, and `OPENCHAMBER_HOST_CALLBACK_URL`.

## Development

```bash
bun install
bun run build       # Bundle panel/main.js, status/main.js, and service/main.js
bun run typecheck   # Run tsc --noEmit
bun run check       # Run openchamber-guest-check
bun test            # Run service unit tests and Playwright UI harness tests
```

> Note: `test/ui.playwright.test.ts` launches headless Chromium via Playwright and saves verification screenshots under `/tmp/opencode`.

## License

MIT — see [LICENSE](./LICENSE).
