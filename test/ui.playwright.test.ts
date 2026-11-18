import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import {
  GUEST_POPOVER_DATA_MAX,
  OPENCHAMBER_SDK_API_VERSION,
  OPENCHAMBER_SDK_CHANNEL,
  type HostTheme,
} from "@openchamber/sdk";
import { GUEST_UI_LOOK_CSS } from "@openchamber/sdk/ui";
import { createAutoGateServiceServer } from "../service/main.ts";

const EXTENSION_ROOT = path.resolve(import.meta.dir, "..");
const SCREENSHOT_DIR = "/tmp/opencode";

const tempDirs: string[] = [];

const makeTempEnv = () => {
  const baseTmp = fs.existsSync("/tmp/opencode") ? "/tmp/opencode" : os.tmpdir();
  const dir = fs.mkdtempSync(path.join(baseTmp, "autogate-ui-test-"));
  tempDirs.push(dir);
  const configPath = path.join(dir, "config.json");
  const runtimeDir = path.join(dir, "runtime");
  const evalLogFile = path.join(dir, "autogate-evals.jsonl");
  return {
    dir,
    configPath,
    runtimeDir,
    evalLogFile,
    env: {
      AUTOGATE_CONFIG: configPath,
      AUTOGATE_EVAL_LOG: evalLogFile,
      OPENCHAMBER_SERVICE_TOKEN: "playwright-autogate-token",
    } as Record<string, string>,
  };
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

const DARK_THEME: HostTheme = {
  mode: "dark",
  tokens: {
    background: "#16181d",
    elevated: "#1e2128",
    elevatedForeground: "#ebedf2",
    mutedSurface: "#121418",
    foreground: "#e6e9ef",
    muted: "#8f96a6",
    subtle: "#687082",
    border: "rgba(255, 255, 255, 0.11)",
    hover: "rgba(255, 255, 255, 0.06)",
    active: "rgba(255, 255, 255, 0.1)",
    selection: "rgba(91, 145, 255, 0.2)",
    selectionForeground: "#f0f4ff",
    focus: "#5b91ff",
    primary: "#5b91ff",
    primaryForeground: "#ffffff",
    primaryText: "#7aa7ff",
    success: "#2fb375",
    successText: "#56d196",
    warning: "#e59934",
    warningText: "#f2b35c",
    error: "#e55353",
    errorText: "#f47c7c",
    info: "#4c9aff",
    infoText: "#7ab6ff",
    font: "Inter, system-ui, -apple-system, sans-serif",
    mono: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace",
    radius: "8px",
  },
};

const LIGHT_THEME: HostTheme = {
  mode: "light",
  tokens: {
    background: "#f5f6f8",
    elevated: "#ffffff",
    elevatedForeground: "#181a1f",
    mutedSurface: "#eceef2",
    foreground: "#1c1f26",
    muted: "#636b78",
    subtle: "#858d9c",
    border: "rgba(15, 23, 42, 0.12)",
    hover: "rgba(15, 23, 42, 0.05)",
    active: "rgba(15, 23, 42, 0.09)",
    selection: "rgba(37, 99, 235, 0.14)",
    selectionForeground: "#1e3a8a",
    focus: "#2563eb",
    primary: "#2563eb",
    primaryForeground: "#ffffff",
    primaryText: "#1d4ed8",
    success: "#16a34a",
    successText: "#15803d",
    warning: "#d97706",
    warningText: "#b45309",
    error: "#dc2626",
    errorText: "#b91c1c",
    info: "#2563eb",
    infoText: "#1d4ed8",
    font: "Inter, system-ui, -apple-system, sans-serif",
    mono: "JetBrains Mono, ui-monospace, SFMono-Regular, monospace",
    radius: "8px",
  },
};

const listenEphemeral = (server: http.Server): Promise<number> =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve((server.address() as AddressInfo).port);
    });
  });

const buildHostHtml = (popoversEnabled: boolean): string => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AutoGate Work Status Harness</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      background: var(--host-chat-bg, #0f1115);
      color: var(--host-fg, #e6e9ef);
    }
    .workspace {
      display: flex;
      width: 100%;
      height: 100%;
      position: relative;
    }
    .chat-pane {
      flex: 1 1 auto;
      padding: 28px 32px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .chat-bubble {
      max-width: 440px;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.45;
      background: var(--host-panel-bg, #16181d);
      border: 1px solid var(--host-border, rgba(255,255,255,0.1));
    }
    .work-status-rail {
      width: 300px;
      flex-shrink: 0;
      background: var(--host-panel-bg, #16181d);
      border-left: 1px solid var(--host-border, rgba(255,255,255,0.1));
      padding: 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .ws-section {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .ws-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .ws-shield {
      width: 14px;
      height: 14px;
      color: var(--host-accent, #5b91ff);
    }
    .ws-body {
      margin: 0 4px;
      overflow: hidden;
      border-radius: 6px;
      height: 180px;
    }
    iframe.guest-frame {
      width: 100%;
      height: 100%;
      border: 0;
      background: transparent;
      display: block;
    }
    .popover-portal {
      position: fixed;
      z-index: 100;
      border-radius: 8px;
      overflow: hidden;
      background: var(--host-elevated, #1e2128);
      border: 1px solid var(--host-border, rgba(255,255,255,0.12));
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.36);
    }
    .popover-portal[hidden] {
      display: none !important;
    }
  </style>
</head>
<body>
  <div class="workspace">
    <div class="chat-pane">
      <div class="chat-bubble">
        AutoGate monitors shell and tool permissions across active sessions. Click a session in Work Status to inspect its classifier history.
      </div>
    </div>
    <aside class="work-status-rail">
      <section class="ws-section">
        <div class="ws-header">
          <svg class="ws-shield" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91c4.59-1.15 8-5.86 8-10.91V5l-8-3z" />
          </svg>
          <span>AutoGate</span>
        </div>
        <div id="status-box" class="ws-body">
          <iframe id="status-frame" class="guest-frame" sandbox="allow-scripts" src="/guest/status/index.html"></iframe>
        </div>
      </section>
    </aside>
    <div id="popover-box" class="popover-portal" hidden></div>
  </div>
  <script>
    const CHANNEL = ${JSON.stringify(OPENCHAMBER_SDK_CHANNEL)};
    const VERSION = ${JSON.stringify(OPENCHAMBER_SDK_API_VERSION)};
    const POPOVERS_ENABLED = ${JSON.stringify(popoversEnabled)};

    window.__hostRecorded = {
      clipboard: [],
      toasts: [],
      openedSessions: [],
      popoverOpens: 0,
      popoverPayloads: [],
      resizes: [],
    };

    let currentTheme = ${JSON.stringify(DARK_THEME)};
    let currentSession = { id: 'ses_live_1', title: 'Deploy production fix', busy: true, agent: 'build' };
    let activePopover = null;

    const PROJECTS = [
      { id: 'proj_1', name: 'autogate', directory: '/tmp/ws' },
    ];
    const SESSIONS = [
      {
        id: 'ses_live_1',
        title: 'Deploy production fix',
        projectId: 'proj_1',
        directory: '/tmp/ws',
        parentId: null,
        createdAt: 1000,
        updatedAt: 9000,
        archivedAt: null,
        worktree: null,
        activity: 'waiting-permission',
        outcome: null,
        items: [],
      },
      {
        id: 'ses_blocked_2',
        title: 'Refactor database layer',
        projectId: 'proj_1',
        directory: '/tmp/ws',
        parentId: null,
        createdAt: 1000,
        updatedAt: 8000,
        archivedAt: null,
        worktree: null,
        activity: 'idle',
        outcome: 'completed',
        items: [],
      },
      {
        id: 'ses_unsure_3',
        title: 'Audit auth middleware',
        projectId: 'proj_1',
        directory: '/tmp/ws',
        parentId: null,
        createdAt: 1000,
        updatedAt: 7000,
        archivedAt: null,
        worktree: null,
        activity: 'idle',
        outcome: 'completed',
        items: [],
      },
      {
        id: 'ses_clean_4',
        title: 'Update README docs',
        projectId: 'proj_1',
        directory: '/tmp/ws',
        parentId: null,
        createdAt: 1000,
        updatedAt: 6000,
        archivedAt: null,
        worktree: null,
        activity: 'idle',
        outcome: 'completed',
        items: [],
      },
    ];

    const applyHostChromeTheme = (theme) => {
      document.documentElement.style.colorScheme = theme.mode;
      const s = document.documentElement.style;
      s.setProperty('--host-chat-bg', theme.mode === 'dark' ? '#0f1115' : '#ffffff');
      s.setProperty('--host-panel-bg', theme.tokens.background);
      s.setProperty('--host-elevated', theme.tokens.elevated);
      s.setProperty('--host-fg', theme.tokens.foreground);
      s.setProperty('--host-border', theme.tokens.border);
      s.setProperty('--host-accent', theme.tokens.primary);
    };
    applyHostChromeTheme(currentTheme);

    const statusBox = document.getElementById('status-box');
    const statusFrame = document.getElementById('status-frame');
    const popoverBox = document.getElementById('popover-box');

    const postToWindow = (win, msg) => {
      if (win) win.postMessage({ channel: CHANNEL, v: VERSION, ...msg }, '*');
    };

    const makeReadyPayload = (surface, popover) => ({
      theme: currentTheme,
      locale: 'en',
      directory: '/tmp/ws',
      session: currentSession,
      surface,
      connection: { connected: false, account: '' },
      settings: {},
      item: null,
      features: { popovers: POPOVERS_ENABLED, statusControls: true },
      ...(popover ? { popover } : {}),
    });

    const closeActivePopover = (reason = 'closed') => {
      if (!activePopover) return;
      const closingId = activePopover.id;
      activePopover = null;
      popoverBox.hidden = true;
      popoverBox.replaceChildren();
      postToWindow(statusFrame.contentWindow, {
        type: 'popover-closed',
        payload: { id: closingId, reason },
      });
    };

    window.addEventListener('message', async (event) => {
      const data = event.data;
      if (!data || data.channel !== CHANNEL || data.v !== VERSION) return;

      const isStatus = event.source === statusFrame.contentWindow;
      const isPopover = activePopover && event.source === activePopover.frame.contentWindow;
      if (!isStatus && !isPopover) return;

      if (data.type === 'hello') {
        if (isStatus) {
          postToWindow(event.source, { type: 'ready', payload: makeReadyPayload('status') });
        } else if (isPopover) {
          postToWindow(event.source, {
            type: 'ready',
            payload: makeReadyPayload('popover', { id: activePopover.id, data: activePopover.data }),
          });
        }
        return;
      }

      if (data.type === 'resize') {
        const rawH = Number(data.payload?.height) || 28;
        if (isStatus) {
          const clamped = Math.max(24, Math.min(320, Math.ceil(rawH)));
          statusBox.style.height = clamped + 'px';
          window.__hostRecorded.resizes.push({ surface: 'status', height: clamped });
        } else if (isPopover) {
          const clamped = Math.max(64, Math.min(460, Math.ceil(rawH) + 2));
          popoverBox.style.height = clamped + 'px';
          window.__hostRecorded.resizes.push({ surface: 'popover', height: clamped });
        }
        postToWindow(event.source, { type: 'result', id: data.id, ok: true });
        return;
      }

      if (data.type === 'service-request') {
        const req = data.payload;
        const qs = req.query ? '?' + new URLSearchParams(req.query).toString() : '';
        const res = await fetch('/proxy' + req.path + qs, {
          method: req.method,
          headers: req.body ? { 'Content-Type': 'application/json' } : undefined,
          body: req.body,
        });
        const body = await res.text();
        postToWindow(event.source, {
          type: 'result',
          id: data.id,
          ok: true,
          payload: { status: res.status, body },
        });
        return;
      }

      if (data.type === 'workspace-read') {
        const q = data.payload;
        if (q?.kind === 'projects') {
          postToWindow(event.source, {
            type: 'result',
            id: data.id,
            ok: true,
            payload: { kind: 'projects', state: 'ready', projects: PROJECTS },
          });
          return;
        }
        if (q?.kind === 'sessions') {
          postToWindow(event.source, {
            type: 'result',
            id: data.id,
            ok: true,
            payload: {
              kind: 'sessions',
              projectId: q.projectId,
              state: 'ready',
              coverage: [{ directory: '/tmp/ws', state: 'ready' }],
              sessions: SESSIONS,
            },
          });
          return;
        }
      }

      if (data.type === 'open-session') {
        window.__hostRecorded.openedSessions.push(data.payload.sessionId);
        postToWindow(event.source, { type: 'result', id: data.id, ok: true });
        return;
      }

      if (data.type === 'popover-open' && isStatus) {
        const p = data.payload;
        closeActivePopover('replaced');
        window.__hostRecorded.popoverOpens += 1;
        window.__hostRecorded.popoverPayloads.push(p.data);

        const statusRect = statusFrame.getBoundingClientRect();
        const left = Math.max(12, statusRect.left + p.anchor.x - p.width - 10);
        const top = Math.max(12, Math.min(window.innerHeight - p.height - 16, statusRect.top + p.anchor.y - 8));

        popoverBox.style.width = p.width + 'px';
        popoverBox.style.height = p.height + 'px';
        popoverBox.style.left = left + 'px';
        popoverBox.style.top = top + 'px';

        const popFrame = document.createElement('iframe');
        popFrame.id = 'popover-frame';
        popFrame.className = 'guest-frame';
        popFrame.setAttribute('sandbox', 'allow-scripts');
        popFrame.src = '/guest/status/index.html';
        popoverBox.replaceChildren(popFrame);
        popoverBox.hidden = false;

        activePopover = { id: p.id, data: p.data, frame: popFrame };
        postToWindow(event.source, { type: 'result', id: data.id, ok: true });
        return;
      }

      if (data.type === 'popover-close') {
        if (activePopover && activePopover.id === data.payload?.id) {
          closeActivePopover(data.payload?.reason || 'closed');
        }
        postToWindow(event.source, { type: 'result', id: data.id, ok: true });
        return;
      }

      if (data.type === 'popover-anchor') {
        postToWindow(event.source, { type: 'result', id: data.id, ok: true });
        return;
      }

      if (data.type === 'clipboard-write') {
        window.__hostRecorded.clipboard.push(data.payload.text);
        postToWindow(event.source, { type: 'result', id: data.id, ok: true });
        return;
      }

      if (data.type === 'toast') {
        window.__hostRecorded.toasts.push(data.payload);
        postToWindow(event.source, { type: 'result', id: data.id, ok: true });
        return;
      }

      if (data.type === 'close') {
        if (isPopover) closeActivePopover('closed');
        postToWindow(event.source, { type: 'result', id: data.id, ok: true });
        return;
      }
    });

    window.__pushTheme = (theme) => {
      currentTheme = theme;
      applyHostChromeTheme(theme);
      postToWindow(statusFrame.contentWindow, {
        type: 'ready',
        payload: makeReadyPayload('status'),
      });
      if (activePopover) {
        postToWindow(activePopover.frame.contentWindow, {
          type: 'ready',
          payload: makeReadyPayload('popover', { id: activePopover.id, data: activePopover.data }),
        });
      }
    };
  </script>
</body>
</html>`;

describe("AutoGate Work Status + Session Popover Browser Verification (Playwright)", () => {
  test("renders status controls, recent sessions, anchored popover details, actions, and light/dark themes", async () => {
    await fsp.mkdir(SCREENSHOT_DIR, { recursive: true });
    const { configPath, runtimeDir, evalLogFile, env } = makeTempEnv();

    const now = Date.now();
    fs.writeFileSync(
      configPath,
      JSON.stringify({
        autoMode: true,
        reviewFallbackMode: "ntfy",
        consecutiveBlockThreshold: 3,
        systemOne: {
          enabled: true,
          executionMode: "race",
          endpoint: "http://127.0.0.1:4006/v1/systemone",
        },
      }),
      "utf8",
    );

    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(
      path.join(runtimeDir, "live.json"),
      JSON.stringify({
        version: 1,
        pid: process.pid,
        workspaceRoot: "/tmp/ws",
        startedAt: now - 60_000,
        updatedAt: now,
        autoMode: true,
        reviewFallbackMode: "ntfy",
        remoteReviewEnabled: true,
        consecutiveBlocks: 1,
        consecutiveBlockThreshold: 3,
        classifierModel: "google/gemini-3.5-flash-lite",
        systemOneEnabled: true,
        systemOneMode: "race",
        evalLogFile,
        inFlight: [
          {
            id: "req_live_1",
            sessionID: "ses_live_1",
            toolName: "shell",
            commandString: "kubectl apply -f deploy/prod.yaml",
            stage: "awaiting-review",
            startedAt: now - 5_000,
          },
        ],
        lastVerdict: null,
      }),
      "utf8",
    );

    const evalEntries = [
      // Oldest -> newest (readRecentEvaluations reverses tail)
      {
        timestamp: now - 300_000,
        sessionID: "ses_unmapped_5_long_session_id",
        toolName: "read",
        commandString: "cat package.json",
        verdict: "ALLOW",
        risk_level: "LOW",
        durationMs: 28,
        cascade: { mode: "race", winner: "system1", s1LatencyMs: 28, inScopeScore: 0.99, injectionScore: 0.01 },
      },
      {
        timestamp: now - 240_000,
        sessionID: "ses_clean_4",
        toolName: "edit",
        commandString: "README.md",
        reasoning: "Documentation update within project workspace.",
        verdict: "ALLOW",
        risk_level: "LOW",
        durationMs: 35,
        cascade: { mode: "race", winner: "system1", s1LatencyMs: 35 },
      },
      {
        timestamp: now - 180_000,
        sessionID: "ses_unsure_3",
        toolName: "shell",
        commandString: "curl -s https://api.example.com/health",
        reasoning: "External network fetch requires user review.",
        verdict: "UNSURE",
        risk_level: "MEDIUM",
        user_authorization: "NONE",
        durationMs: 640,
        cascade: {
          mode: "race",
          winner: "system2",
          escalationReason: "uncertain_s1",
          s1LatencyMs: 42,
          s2LatencyMs: 640,
          inScopeScore: 0.85,
          injectionScore: 0.04,
        },
      },
      {
        timestamp: now - 120_000,
        sessionID: "ses_blocked_2",
        toolName: "shell",
        commandString: "bun test",
        userPrompt: "run unit tests",
        reasoning: "Standard test suite command inside repository.",
        verdict: "ALLOW",
        risk_level: "LOW",
        user_authorization: "HIGH",
        durationMs: 31,
        cascade: { mode: "race", winner: "system1", s1LatencyMs: 31, inScopeScore: 0.98, injectionScore: 0.0 },
      },
      {
        timestamp: now - 60_000,
        sessionID: "ses_blocked_2",
        toolName: "shell",
        commandString: "psql $PROD_DB -c 'DROP TABLE users;'",
        userPrompt: "clean up old staging table",
        reasoning: "Destructive SQL DROP against production database variable without explicit authorization.",
        verdict: "BLOCK",
        risk_level: "CRITICAL",
        user_authorization: "NONE",
        durationMs: 820,
        cascade: {
          mode: "race",
          winner: "system2",
          escalationReason: "high_risk_sql",
          s1LatencyMs: 44,
          s2LatencyMs: 820,
          inScopeScore: 0.42,
          injectionScore: 0.02,
        },
      },
      {
        timestamp: now - 30_000,
        sessionID: "ses_live_1",
        toolName: "shell",
        commandString: "git status",
        reasoning: "Read-only git inspection.",
        verdict: "ALLOW",
        risk_level: "LOW",
        durationMs: 25,
        cascade: { mode: "race", winner: "system1", s1LatencyMs: 25 },
      },
    ];
    fs.writeFileSync(
      evalLogFile,
      evalEntries.map((e) => JSON.stringify(e)).join("\n") + "\n",
      "utf8",
    );

    const statusHtmlRaw = await fsp.readFile(path.join(EXTENSION_ROOT, "status/index.html"), "utf8");
    const statusHtmlWithLook = statusHtmlRaw.replace(
      "</head>",
      `<style data-openchamber-guest-styles>${GUEST_UI_LOOK_CSS}</style></head>`,
    );
    const statusJsRaw = await fsp.readFile(path.join(EXTENSION_ROOT, "status/main.js"), "utf8");

    const serviceServer = createAutoGateServiceServer({
      env,
      enableMarksLoop: false,
      probeSystemOne: async () => ({ reachable: true, statusCode: 200, latencyMs: 6 }),
    });
    const servicePort = await listenEphemeral(serviceServer);

    const harnessServer = http.createServer((req, res) => {
      const u = new URL(req.url ?? "/", "http://127.0.0.1");
      if (u.pathname === "/") {
        const popovers = u.searchParams.get("popovers") !== "0";
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(buildHostHtml(popovers));
        return;
      }
      if (u.pathname === "/guest/status/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(statusHtmlWithLook);
        return;
      }
      if (u.pathname === "/guest/status/main.js") {
        res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" }).end(statusJsRaw);
        return;
      }
      if (u.pathname.startsWith("/proxy/")) {
        const subPath = u.pathname.slice("/proxy".length) + u.search;
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", () => {
          const bodyStr = Buffer.concat(chunks).toString("utf8");
          void fetch(`http://127.0.0.1:${servicePort}${subPath}`, {
            method: req.method,
            headers: {
              Authorization: `Bearer ${env.OPENCHAMBER_SERVICE_TOKEN}`,
              ...(bodyStr ? { "Content-Type": "application/json" } : {}),
            },
            ...(bodyStr ? { body: bodyStr } : {}),
          }).then(async (upstream) => {
            const text = await upstream.text();
            res.writeHead(upstream.status, { "Content-Type": "application/json" }).end(text);
          });
        });
        return;
      }
      res.writeHead(404).end("Not found");
    });

    const harnessPort = await listenEphemeral(harnessServer);
    const browser = await chromium.launch({ headless: true });

    try {
      const page = await browser.newPage({ viewport: { width: 880, height: 560 } });
      const errors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") errors.push(msg.text());
      });
      page.on("pageerror", (err) => {
        errors.push(err.message);
      });

      await page.goto(`http://127.0.0.1:${harnessPort}/`, { waitUntil: "networkidle" });

      const statusFrame = page.frameLocator("#status-frame");
      await statusFrame.locator(".ag-row").first().waitFor({ state: "visible", timeout: 5_000 });

      // Wait for resolved session titles from listProjects/listSessions
      await statusFrame
        .locator(".ag-session-title", { hasText: "Deploy production fix" })
        .waitFor({ state: "visible", timeout: 5_000 });

      // Controls verification
      expect(await statusFrame.locator('[data-control="auto-mode"]').textContent()).toContain("Auto: ON");
      expect(await statusFrame.locator('[data-control="fallback"]').textContent()).toBe("ntfy");
      expect(await statusFrame.locator('[data-control="system1"]').textContent()).toContain("S1 race · up");
      expect(await statusFrame.locator('[data-control="breaker"]').textContent()).toContain("Breaker 1/3");

      // Recent sessions ordering (active inFlight first, then newest)
      const titles = await statusFrame.locator(".ag-session-title").allTextContents();
      expect(titles).toEqual([
        "Deploy production fix",
        "Refactor database layer",
        "Audit auth middleware",
        "Update README docs",
        "ses_unmapped…",
      ]);

      // Zero horizontal overflow in Work Status frame
      const statusOverflow = await statusFrame.locator("html").evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(statusOverflow.scrollWidth).toBeLessThanOrEqual(statusOverflow.clientWidth);

      await page.waitForTimeout(100);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "autogate-status-dark.png") });

      // Click `Refactor database layer` row to open anchored popover
      await statusFrame.locator('.ag-row[data-session-id="ses_blocked_2"]').click();
      await page.locator("#popover-box:not([hidden])").waitFor({ state: "visible", timeout: 4_000 });

      const popFrame = page.frameLocator("#popover-frame");
      await popFrame.locator(".ag-pop-title").waitFor({ state: "visible", timeout: 4_000 });
      expect(await popFrame.locator(".ag-pop-title").textContent()).toBe("Refactor database layer");
      expect(await popFrame.locator(".ag-pop-subtitle").textContent()).toBe("ses_blocked_2");
      expect(await popFrame.locator(".ag-pop-header").textContent()).toContain("Blocked");
      expect(await popFrame.locator(".ag-pop-summary").textContent()).toContain("1 ALLOW");
      expect(await popFrame.locator(".ag-pop-summary").textContent()).toContain("1 BLOCK");
      expect(await popFrame.locator(".ag-code-box").textContent()).toContain("DROP TABLE users");
      expect(await popFrame.locator(".ag-eval-badges").textContent()).toContain("S2 escalated");
      expect(await popFrame.locator(".ag-eval-badges").textContent()).toContain("high_risk_sql");
      expect(await popFrame.locator(".ag-cascade-line").textContent()).toContain("S1 44ms");
      expect(await popFrame.locator(".ag-cascade-line").textContent()).toContain("S2 820ms");

      // Zero horizontal overflow in Popover frame
      const popOverflow = await popFrame.locator("html").evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(popOverflow.scrollWidth).toBeLessThanOrEqual(popOverflow.clientWidth);

      await page.waitForTimeout(120);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "autogate-popover-dark.png") });

      // Select the second evaluation mini-row inside the popover and verify detail updates
      const miniRows = popFrame.locator(".ag-mini-row");
      expect(await miniRows.count()).toBe(2);
      expect(await miniRows.nth(0).locator(".ag-mini-meta").textContent()).toContain("S2 · 820ms");
      expect(await miniRows.nth(1).locator(".ag-mini-meta").textContent()).toContain("S1 · 31ms");
      await miniRows.nth(1).click();
      expect(await popFrame.locator(".ag-code-box").textContent()).toContain("bun test");
      expect(await popFrame.locator(".ag-eval-detail").textContent()).toContain("S1 fast-path");

      // Switch to Light Mode with popover open and capture screenshot
      await page.evaluate((light) => {
        (window as unknown as { __pushTheme: (t: unknown) => void }).__pushTheme(light);
      }, LIGHT_THEME);
      await page.waitForTimeout(120);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "autogate-popover-light.png") });

      // Click Copy session ID, Copy command, and Jump to session inside popover
      await popFrame.getByRole("button", { name: "Copy session ID" }).click();
      await popFrame.getByRole("button", { name: "Copy command" }).click();
      await popFrame.getByRole("button", { name: "Jump to session" }).click();
      await page.locator("#popover-box[hidden]").waitFor({ state: "attached", timeout: 3_000 });

      const recorded = await page.evaluate(() =>
        (window as unknown as {
          __hostRecorded: {
            clipboard: string[];
            openedSessions: string[];
            popoverOpens: number;
            popoverPayloads: unknown[];
            toasts: Array<{ kind: string; message: string }>;
          };
        }).__hostRecorded,
      );
      expect(recorded.popoverOpens).toBe(1);
      expect(JSON.stringify(recorded.popoverPayloads[0]).length).toBeLessThanOrEqual(12_000);
      expect(JSON.stringify(recorded.popoverPayloads[0]).length).toBeLessThan(GUEST_POPOVER_DATA_MAX);
      expect(recorded.clipboard).toEqual(["ses_blocked_2", "bun test"]);
      expect(recorded.openedSessions).toEqual(["ses_blocked_2"]);

      // Test status controls mutation against real service (Auto Mode toggle + Reset breaker)
      await statusFrame.locator('[data-control="auto-mode"]').click();
      await statusFrame
        .locator('[data-control="auto-mode"]', { hasText: "Manual" })
        .waitFor({ state: "visible", timeout: 3_000 });

      await statusFrame.locator('[data-control="reset-breaker"]').click();
      await statusFrame
        .locator('[data-control="breaker"]')
        .waitFor({ state: "hidden", timeout: 3_000 });

      const savedCfg = JSON.parse(fs.readFileSync(configPath, "utf8")) as { autoMode?: boolean };
      expect(savedCfg.autoMode).toBe(false);

      // Verify inline fallback when features.popovers is false
      await page.goto(`http://127.0.0.1:${harnessPort}/?popovers=0`, { waitUntil: "networkidle" });
      await statusFrame.locator('.ag-row[data-session-id="ses_blocked_2"]').waitFor({
        state: "visible",
        timeout: 4_000,
      });
      await statusFrame.locator('.ag-row[data-session-id="ses_blocked_2"]').click();
      await statusFrame.locator(".ag-inline-detail").waitFor({ state: "visible", timeout: 3_000 });
      expect(await statusFrame.locator(".ag-inline-detail .ag-code-box").textContent()).toContain(
        "DROP TABLE users",
      );
      await statusFrame.locator('.ag-row[data-session-id="ses_blocked_2"]').click();
      expect(await statusFrame.locator(".ag-inline-detail").count()).toBe(0);

      expect(errors).toEqual([]);
    } finally {
      await browser.close();
      await new Promise<void>((resolve) => serviceServer.close(() => resolve()));
      await new Promise<void>((resolve) => harnessServer.close(() => resolve()));
    }
  }, 30_000);
});
