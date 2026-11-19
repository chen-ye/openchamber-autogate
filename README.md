# AutoGate extension for OpenChamber

Monitors AutoGate permission evaluations in OpenChamber with a filterable history inspector, live mode and fallback controls, circuit-breaker status, Work Status popovers, and sidebar session marks.

## Setup

### Prerequisites

1. OpenChamber `>= 2.7.1`.
2. An AutoGate-enabled OpenCode or OMP setup writing AutoGate config, runtime state, and evaluation logs.

### Enable in OpenChamber

1. Open **Settings → Extensions** and add the `autogate` folder (or repository URL).
2. Approve the requested permissions (background service, session list access for titles and navigation, and sidebar session marks).

### Config and log files

AutoGate resolves its config directory from `$AUTOGATE_CONFIG` (using its parent directory), `$XDG_CONFIG_HOME/autogate`, or `~/.config/autogate`:

- **`config.json`**: AutoGate settings (`autoMode`, `reviewFallbackMode`, `classifierModel`, `classifierTimeout`, `consecutiveBlockThreshold`, `notifyOnVerdict`, `ntfyServer`, `ntfyTopic`, `ntfyToken`, `evalLogFile`, and `systemOne.*`). Secrets (`ntfyToken` and `systemOne.apiKey`) are redacted from UI state and preserved when OpenChamber updates settings.
- **`runtime/*.json`**: Live per-process runtime state files (active runtimes are filtered by PID liveness).
- **`control.json`**: Stores `resetCircuitBreakerAt` when you reset the circuit breaker from OpenChamber.
- **Evaluation log**: Resolved from an active runtime's `evalLogFile`, `$AUTOGATE_EVAL_LOG`, `evalLogFile` / `omp.evalLogFile` in `config.json`, or `~/.omp/logs/autogate-evals.jsonl` (supports both OpenCode flat JSONL and OMP nested entries; reads up to the latest 512 KB / 200 entries).

| Environment variable | Overrides `config.json` key | Default |
|---|---|---|
| `AUTOGATE_CONFIG` | — | `~/.config/autogate/config.json` |
| `AUTOGATE_EVAL_LOG` | `evalLogFile` / `omp.evalLogFile` | `~/.omp/logs/autogate-evals.jsonl` |
| `AUTOGATE_AUTO_MODE` / `OPENCODE_AUTO_MODE` | `autoMode` | `true` |
| `AUTOGATE_FALLBACK` | `reviewFallbackMode` / `fallbackMode` | `"ntfy"` (`"ntfy"` or `"native"`) |
| `CLASSIFIER_MODEL` | `classifierModel` | `"google/gemini-3.5-flash-lite"` |
| `CLASSIFIER_TIMEOUT` | `classifierTimeout` | `45000` (ms) |
| `CONSECUTIVE_BLOCK_THRESHOLD` | `consecutiveBlockThreshold` | `3` |
| `AUTOGATE_NOTIFY_ON_VERDICT` | `notifyOnVerdict` | `true` |
| `NTFY_SERVER` | `ntfyServer` | `"https://ntfy.sh"` |
| `AUTOGATE_NTFY_TOPIC` / `NTFY_TOPIC` | `ntfyTopic` | `"autogate"` |
| `NTFY_TOKEN` / `AUTOGATE_NTFY_TOKEN` | `ntfyToken` | — |
| `AUTOGATE_SYSTEM_ONE_ENABLED` | `systemOne.enabled` | `false` |
| `AUTOGATE_SYSTEM_ONE_MODE` | `systemOne.executionMode` | `"race"` (`"race"` or `"cascade"`) |
| `AUTOGATE_SYSTEM_ONE_ENDPOINT` | `systemOne.endpoint` | `"http://127.0.0.1:4006/v1/systemone"` |
| `AUTOGATE_SYSTEM_ONE_MODEL` | `systemOne.model` | `"gemini-decision-1"` |
| `AUTOGATE_SYSTEM_ONE_TIMEOUT_MS` | `systemOne.timeoutMs` | `4000` (ms) |
| `AUTOGATE_SYSTEM_ONE_API_KEY` | `systemOne.apiKey` | — |

## Using AutoGate in OpenChamber

### AutoGate panel

Open the **AutoGate** panel (auto-refreshes every 2.5 seconds, or click **Refresh**) to configure and inspect evaluations:

- **Controls card**: Toggle **Auto Mode** (automatic classification vs Manual mode), switch **Fallback** between `ntfy (Remote)` and `native (Terminal)`, check **System 1** health (`disabled`, `reachable`, or `unreachable`), monitor **Breaker** (`consecutiveBlocks/threshold` with **Reset Breaker** when > 0), and view aggregate counts, average latency, and System 1 fast-path percentage.
- **Alert banner**: Surfaces actions currently awaiting review or a tripped circuit breaker with a one-click **Reset Breaker** button.
- **History & Evaluation Detail**: Filter by verdict tab (**All**, **ALLOW**, **BLOCK**, **UNSURE**), search across tool, command, reason, user prompt, and session ID, or toggle **Current session**. Selecting an entry opens **Evaluation Detail** with verdict, risk, authorization, System 1/System 2 badges, command/action text, reasoning, user prompt, and cascade trace metrics (`Cascade Mode`, `Winner`, `Escalation`, `S1 Latency`, `S2 Latency`, `S2 Aborted`, `In-Scope`, `Injection`, `S1 Probs`).

### Work Status section

The **AutoGate** section in Work Status provides:

- **Control pills**: Toggle `Auto: ON` / `Manual`, switch `ntfy` / `native` fallback, inspect System 1 status (`S1 off`, `S1 <mode> · up`, `S1 down`), and **Reset** a non-zero circuit breaker.
- **Summary line**: Aggregate `ALLOW`, `BLOCK`, and `UNSURE` counts plus average latency.
- **Recent Sessions**: Lists up to 5 recent sessions (active in-flight sessions first, using OpenChamber session titles when available). Clicking a session opens a popover (or inline drawer when popovers are unavailable) with session counts, status badge (`Awaiting Review`, `Evaluating`, `Blocked`, `Needs Review`, `Clean`), up to 6 recent evaluations, and **Jump to session** (for `ses_*` sessions), **Copy session ID**, and **Copy command** buttons.

### Sidebar session marks

AutoGate runs a background service loop (every 3 seconds) that badges sessions in the OpenChamber sidebar:

- **Shield (warning)**: `Awaiting AutoGate review` while an in-flight action is waiting on review.
- **Close circle (error)**: `Blocked by AutoGate` when the latest verdict within the last 15 minutes is `BLOCK`.
- **Alert (warning)**: `Flagged UNSURE by AutoGate` when the latest verdict within the last 15 minutes is `UNSURE`.

Marks clear automatically when a session resolves with `ALLOW` or after 15 minutes.

### How the pieces fit together

```text
  config.json + runtime/*.json + evals.jsonl + System 1 /health
        │                                            ▲
        ▼                                            │ writes config.json
  AutoGate background service (3s mark sync) ────────┤ & control.json
        │                                            │
        ├──► AutoGate Panel (controls, filters, detail inspector)
        ├──► Work Status (pills, recent sessions, detail popover)
        └──► Sidebar Session Marks (shield / close-circle / alert)
```

## Development

```bash
bun run build
bun run check
bun run typecheck
bun test
```
