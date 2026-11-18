import { afterEach, describe, expect, it } from "bun:test";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import { guestStatusViewSchema } from "@openchamber/sdk/schemas";
import { GUEST_POPOVER_DATA_MAX, type ServiceHost, type ServiceMark } from "@openchamber/sdk";
import {
  buildRecentSessions,
  buildStatusView,
  collectAutoGateSnapshot,
  computeSessionMarks,
  normalizeEvalLogEntry,
  readRecentEvaluations,
  SystemOneHealthCache,
} from "../service/autogate-store.ts";
import { toBoundedSessionPopoverPayload } from "../status/main.ts";
import { createAutoGateServiceServer } from "../service/main.ts";

const tempDirs: string[] = [];

const makeTempEnv = () => {
  const baseTmp = fs.existsSync("/tmp/opencode") ? "/tmp/opencode" : os.tmpdir();
  const dir = fs.mkdtempSync(path.join(baseTmp, "autogate-ext-test-"));
  tempDirs.push(dir);
  const configPath = path.join(dir, "config.json");
  const evalLogFile = path.join(dir, "autogate-evals.jsonl");
  return {
    dir,
    configPath,
    runtimeDir: path.join(dir, "runtime"),
    controlPath: path.join(dir, "control.json"),
    evalLogFile,
    env: {
      AUTOGATE_CONFIG: configPath,
      AUTOGATE_EVAL_LOG: evalLogFile,
      OPENCHAMBER_SERVICE_TOKEN: "test-secret-token",
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

const startTestServer = async (
  server: ReturnType<typeof createAutoGateServiceServer>,
): Promise<{ baseUrl: string; close: () => Promise<void> }> => {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
};

describe("autogate extension service", () => {
  it("normalizes both OpenCode and OMP eval log formats and reads tail <= 200 entries", () => {
    const { evalLogFile } = makeTempEnv();

    const opencodeEntry = {
      timestamp: 1794560120218,
      sessionID: "ses_oc_1",
      toolName: "shell",
      commandString: JSON.stringify(["bun run typecheck", "bun test"]),
      userPrompt: "run checks",
      reasoning: "Safe local development checks",
      verdict: "ALLOW",
      risk_level: "LOW",
      user_authorization: "MEDIUM",
      durationMs: 420,
      cascade: {
        mode: "race",
        winner: "system1",
        s1LatencyMs: 38,
        s2Aborted: true,
        s1Probs: { ALLOW: 0.97, BLOCK: 0.01, UNSURE: 0.02 },
      },
    };

    const ompEntry = {
      timestamp: "2026-11-13T01:00:00.000Z",
      action: {
        id: "act_omp_1",
        toolName: "bash",
        command: "rm -rf /tmp/foo",
        sessionID: "ses_omp_1",
      },
      model: {
        id: "gemini-3.5-flash-lite",
        provider: "google",
      },
      inference: {
        durationMs: 910,
      },
      decision: {
        verdict: "BLOCK",
        riskLevel: "HIGH",
        userAuthorization: "NONE",
        reason: "Destructive rm without authorization",
      },
    };

    // Write > 512 KB of noise lines followed by our 210 entries to verify tail reading & line skipping
    const lines: string[] = [];
    for (let i = 0; i < 1600; i += 1) {
      lines.push(
        JSON.stringify({
          timestamp: 1700000000000 + i,
          sessionID: "ses_old",
          toolName: "read",
          commandString: "x".repeat(400),
          reasoning: "older log entry padding",
          verdict: "ALLOW",
          durationMs: 12,
        }),
      );
    }
    for (let i = 0; i < 205; i += 1) {
      lines.push(
        JSON.stringify({
          ...opencodeEntry,
          timestamp: opencodeEntry.timestamp + i,
          sessionID: `ses_tail_${i}`,
        }),
      );
    }
    lines.push(JSON.stringify(opencodeEntry));
    lines.push("not-valid-json{{{");
    lines.push(JSON.stringify(ompEntry));
    fs.writeFileSync(evalLogFile, lines.join("\n") + "\n", "utf8");

    const parsed = readRecentEvaluations(evalLogFile);
    expect(parsed.length).toBe(200);
    // Newest first
    expect(parsed[0]?.sourceFormat).toBe("omp");
    expect(parsed[0]?.id).toBe("act_omp_1");
    expect(parsed[0]?.verdict).toBe("BLOCK");
    expect(parsed[0]?.toolName).toBe("bash");
    expect(parsed[0]?.commandPreview).toBe("rm -rf /tmp/foo");
    expect(parsed[0]?.riskLevel).toBe("HIGH");
    expect(parsed[0]?.userAuthorization).toBe("NONE");
    expect(parsed[0]?.durationMs).toBe(910);
    expect(parsed[0]?.model).toBe("google/gemini-3.5-flash-lite");

    expect(parsed[1]?.sourceFormat).toBe("opencode");
    expect(parsed[1]?.verdict).toBe("ALLOW");
    expect(parsed[1]?.commandPreview).toBe("bun run typecheck && bun test");
    expect(parsed[1]?.cascade?.winner).toBe("system1");
    expect(parsed[1]?.cascade?.s1LatencyMs).toBe(38);
  });

  it("handles malformed lines safely in normalizeEvalLogEntry", () => {
    expect(normalizeEvalLogEntry(null, 0)).toBeNull();
    expect(normalizeEvalLogEntry({ toolName: "bash", verdict: "UNKNOWN" }, 0)).toBeNull();
  });

  it("validates GuestStatusView against guestStatusViewSchema and enforces <=16 rows and unique IDs", async () => {
    const { configPath, runtimeDir, evalLogFile, env } = makeTempEnv();

    fs.writeFileSync(
      configPath,
      JSON.stringify({
        autoMode: true,
        reviewFallbackMode: "ntfy",
        ntfyToken: "tk_secret_12345",
        systemOne: {
          enabled: true,
          executionMode: "race",
          endpoint: "http://127.0.0.1:4006/v1/systemone",
          apiKey: "sk_secret_67890",
        },
      }),
      "utf8",
    );

    fs.mkdirSync(runtimeDir, { recursive: true });
    // Live runtime
    fs.writeFileSync(
      path.join(runtimeDir, "live.json"),
      JSON.stringify({
        version: 1,
        pid: process.pid,
        workspaceRoot: "/tmp/ws",
        startedAt: Date.now() - 5000,
        updatedAt: Date.now(),
        autoMode: true,
        reviewFallbackMode: "ntfy",
        remoteReviewEnabled: true,
        consecutiveBlocks: 2,
        consecutiveBlockThreshold: 3,
        classifierModel: "google/gemini-3.5-flash-lite",
        systemOneEnabled: true,
        systemOneMode: "race",
        evalLogFile,
        inFlight: [
          {
            id: "req_1",
            sessionID: "ses_live_1",
            toolName: "shell",
            commandString: "git push --force",
            stage: "awaiting-review",
          },
          {
            id: "req_2",
            sessionID: "ses_live_eval",
            toolName: "shell",
            commandString: "git status",
            stage: "evaluating",
          },
        ],
        lastVerdict: null,
      }),
      "utf8",
    );
    // Dead PID runtime should be ignored
    fs.writeFileSync(
      path.join(runtimeDir, "dead.json"),
      JSON.stringify({
        version: 1,
        pid: 99999999,
        workspaceRoot: "/tmp/dead",
        consecutiveBlocks: 99,
      }),
      "utf8",
    );
    // Malformed runtime file should be ignored
    fs.writeFileSync(path.join(runtimeDir, "broken.json"), "{broken", "utf8");

    const evalLines = Array.from({ length: 8 }, (_, idx) =>
      JSON.stringify({
        timestamp: Date.now() - idx * 1000,
        sessionID: `ses_${idx}`,
        toolName: idx % 2 === 0 ? "shell" : "edit",
        commandString: `cmd-${idx} ${"arg ".repeat(20)}`,
        reasoning: `Reasoning detail ${idx} ${"word ".repeat(30)}`,
        verdict: idx === 0 ? "BLOCK" : idx === 1 ? "UNSURE" : "ALLOW",
        durationMs: 100 + idx,
        cascade: { mode: "race", winner: idx % 2 === 0 ? "system1" : "system2" },
      }),
    );
    fs.writeFileSync(evalLogFile, evalLines.join("\n") + "\n", "utf8");

    let probeCalls = 0;
    const healthCache = new SystemOneHealthCache(async () => {
      probeCalls += 1;
      return { reachable: true, statusCode: 200, latencyMs: 5 };
    });

    const snapshot = await collectAutoGateSnapshot({ env, healthCache });
    expect(snapshot.runtimes.length).toBe(1);
    expect(snapshot.inFlight.length).toBe(2);
    expect(snapshot.inFlight[0]?.awaitingReview).toBe(true);
    expect(snapshot.inFlight[1]?.awaitingReview).toBe(false);
    const liveMarks = computeSessionMarks(snapshot, []);
    expect(liveMarks.get("ses_live_1")).toEqual({
      icon: "shield",
      tone: "warning",
      text: "Awaiting AutoGate review",
    });
    expect(liveMarks.has("ses_live_eval")).toBe(false);
    expect(snapshot.breaker.consecutiveBlocks).toBe(2);
    expect(snapshot.breaker.tripped).toBe(false);
    expect(snapshot.systemOneHealth.reachable).toBe(true);

    // Ensure probe result is cached for 3s
    await collectAutoGateSnapshot({ env, healthCache });
    expect(probeCalls).toBe(1);

    const statusView = buildStatusView(snapshot);
    const parsed = guestStatusViewSchema.parse(statusView);
    expect(parsed.rows.length).toBeLessThanOrEqual(16);
    expect(parsed.rows.map((r) => r.id)).toEqual([
      "mode",
      "fallback",
      "system1",
      "breaker",
      "inflight",
      "stats",
      "eval-0",
      "eval-1",
      "eval-2",
      "eval-3",
    ]);

    // Ensure secrets never appear anywhere in serialized snapshot or status view
    const serialized = JSON.stringify({ snapshot, statusView });
    expect(serialized).not.toContain("tk_secret_12345");
    expect(serialized).not.toContain("sk_secret_67890");
    expect(snapshot.config.hasNtfyToken).toBe(true);
    expect(snapshot.config.systemOne.hasApiKey).toBe(true);
  });

  it("enforces bearer auth on all routes including /health and handles POST /status & /api/action", async () => {
    const { configPath, runtimeDir, controlPath, evalLogFile, env } = makeTempEnv();

    fs.writeFileSync(
      configPath,
      JSON.stringify({
        autoMode: true,
        reviewFallbackMode: "ntfy",
        ntfyToken: "tk_do_not_leak",
        ntfyTopic: "my-topic",
        environment: { trustedPaths: ["~/Projects"] },
        systemOne: {
          enabled: false,
          apiKey: "sk_do_not_leak",
        },
      }),
      "utf8",
    );

    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(
      path.join(runtimeDir, "rt.json"),
      JSON.stringify({
        version: 1,
        pid: process.pid,
        workspaceRoot: "/tmp/project-a",
        startedAt: 1000,
        updatedAt: 2000,
        autoMode: true,
        reviewFallbackMode: "ntfy",
        remoteReviewEnabled: true,
        consecutiveBlocks: 3,
        consecutiveBlockThreshold: 3,
        classifierModel: "google/gemini-3.5-flash-lite",
        systemOneEnabled: false,
        systemOneMode: "race",
        evalLogFile,
        inFlight: [],
        lastVerdict: null,
      }),
      "utf8",
    );

    const server = createAutoGateServiceServer({
      env,
      enableMarksLoop: false,
      probeSystemOne: async () => ({ reachable: false }),
    });
    const { baseUrl, close } = await startTestServer(server);

    try {
      // Unauthenticated requests must get 401 on every route including /health
      const unauthHealth = await fetch(`${baseUrl}/health`);
      expect(unauthHealth.status).toBe(401);
      const unauthStatus = await fetch(`${baseUrl}/status`);
      expect(unauthStatus.status).toBe(401);
      const badAuthState = await fetch(`${baseUrl}/api/state`, {
        headers: { Authorization: "Bearer wrong-token" },
      });
      expect(badAuthState.status).toBe(401);

      const authHeaders = {
        Authorization: `Bearer ${env.OPENCHAMBER_SERVICE_TOKEN}`,
        "Content-Type": "application/json",
      };

      const healthRes = await fetch(`${baseUrl}/health`, { headers: authHeaders });
      expect(healthRes.status).toBe(200);

      // GET /status parses with guestStatusViewSchema
      const statusRes = await fetch(`${baseUrl}/status`, { headers: authHeaders });
      expect(statusRes.status).toBe(200);
      const statusJson = await statusRes.json();
      expect(() => guestStatusViewSchema.parse(statusJson)).not.toThrow();

      // Toggle autoMode off via POST /status
      const toggleRes = await fetch(`${baseUrl}/status`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ id: "toggle-automode", value: "off" }),
      });
      expect(toggleRes.status).toBe(200);

      // Change fallback to native via POST /status
      const fallbackRes = await fetch(`${baseUrl}/status`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ id: "set-fallback", value: "native" }),
      });
      expect(fallbackRes.status).toBe(200);

      // Verify config.json preserved unrelated keys & secrets
      const savedConfig = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<string, unknown>;
      expect(savedConfig.autoMode).toBe(false);
      expect(savedConfig.reviewFallbackMode).toBe("native");
      expect(savedConfig.ntfyToken).toBe("tk_do_not_leak");
      expect(savedConfig.ntfyTopic).toBe("my-topic");
      expect((savedConfig.systemOne as Record<string, unknown>).apiKey).toBe("sk_do_not_leak");

      // Reset breaker via POST /status
      const resetRes = await fetch(`${baseUrl}/status`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ id: "reset-breaker" }),
      });
      expect(resetRes.status).toBe(200);
      const controlJson = JSON.parse(fs.readFileSync(controlPath, "utf8")) as {
        resetCircuitBreakerAt?: number;
      };
      expect(typeof controlJson.resetCircuitBreakerAt).toBe("number");

      // GET /api/state reflects cleared breaker & redacts secrets
      const stateRes = await fetch(`${baseUrl}/api/state`, { headers: authHeaders });
      expect(stateRes.status).toBe(200);
      const stateText = await stateRes.text();
      expect(stateText).not.toContain("tk_do_not_leak");
      expect(stateText).not.toContain("sk_do_not_leak");
      const stateJson = JSON.parse(stateText) as {
        config: { autoMode: boolean; reviewFallbackMode: string };
        breaker: { consecutiveBlocks: number; tripped: boolean };
      };
      expect(stateJson.config.autoMode).toBe(false);
      expect(stateJson.config.reviewFallbackMode).toBe("native");
      expect(stateJson.breaker.consecutiveBlocks).toBe(0);
      expect(stateJson.breaker.tripped).toBe(false);

      // POST /api/action works for panel mutations
      const actionRes = await fetch(`${baseUrl}/api/action`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ action: "setAutoMode", enabled: true }),
      });
      expect(actionRes.status).toBe(200);
      const actionJson = (await actionRes.json()) as {
        ok: boolean;
        state: { config: { autoMode: boolean } };
      };
      expect(actionJson.ok).toBe(true);
      expect(actionJson.state.config.autoMode).toBe(true);
    } finally {
      await close();
    }
  });

  it("computes sidebar marks for awaiting review, recent BLOCK/UNSURE, and clears stale/ALLOW marks", async () => {
    const now = Date.now();
    const snapshot = await collectAutoGateSnapshot({
      env: makeTempEnv().env,
      now,
    });

    snapshot.inFlight = [
      {
        id: "r1",
        sessionID: "ses_review",
        toolName: "shell",
        awaitingReview: true,
      },
    ];
    snapshot.evaluations = [
      {
        id: "e1",
        timestamp: now - 60_000,
        sessionID: "ses_block",
        toolName: "shell",
        commandString: "rm -rf /",
        commandPreview: "rm -rf /",
        verdict: "BLOCK",
        durationMs: 100,
        sourceFormat: "opencode",
      },
      {
        id: "e2",
        timestamp: now - 120_000,
        sessionID: "ses_unsure",
        toolName: "shell",
        commandString: "curl http://example.com",
        commandPreview: "curl http://example.com",
        verdict: "UNSURE",
        durationMs: 200,
        sourceFormat: "opencode",
      },
      {
        id: "e3",
        timestamp: now - 20 * 60_000,
        sessionID: "ses_stale",
        toolName: "shell",
        commandString: "rm foo",
        commandPreview: "rm foo",
        verdict: "BLOCK",
        durationMs: 50,
        sourceFormat: "opencode",
      },
      {
        id: "e4",
        timestamp: now - 30_000,
        sessionID: "ses_resolved",
        toolName: "shell",
        commandString: "ls",
        commandPreview: "ls",
        verdict: "ALLOW",
        durationMs: 20,
        sourceFormat: "opencode",
      },
    ];

    const marks = computeSessionMarks(snapshot, ["ses_stale", "ses_resolved"], now);
    expect(marks.get("ses_review")).toEqual({
      icon: "shield",
      tone: "warning",
      text: "Awaiting AutoGate review",
    });
    expect(marks.get("ses_block")).toEqual({
      icon: "close-circle",
      tone: "error",
      text: "Blocked by AutoGate",
    });
    expect(marks.get("ses_unsure")).toEqual({
      icon: "alert",
      tone: "warning",
      text: "Flagged UNSURE by AutoGate",
    });
    expect(marks.get("ses_stale")).toBeNull();
    expect(marks.get("ses_resolved")).toBeNull();
  });

  it("syncs marks via ServiceHost only on changes", async () => {
    const { configPath, evalLogFile, env } = makeTempEnv();
    fs.writeFileSync(configPath, JSON.stringify({ autoMode: true }), "utf8");
    fs.writeFileSync(
      evalLogFile,
      JSON.stringify({
        timestamp: Date.now(),
        sessionID: "ses_mark_1",
        toolName: "shell",
        commandString: "git reset --hard",
        verdict: "BLOCK",
        durationMs: 50,
      }) + "\n",
      "utf8",
    );

    const calls: Array<{ sessionId: string; mark: ServiceMark | null }> = [];
    const mockHost: Pick<ServiceHost, "setMark"> = {
      setMark: async (target, mark) => {
        if ("sessionId" in target) {
          calls.push({ sessionId: target.sessionId, mark });
        }
        return { saved: true };
      },
    };

    const server = createAutoGateServiceServer({
      env,
      serviceHost: mockHost,
      enableMarksLoop: true,
      marksIntervalMs: 50,
      probeSystemOne: async () => ({ reachable: false }),
    });

    try {
      await new Promise((r) => setTimeout(r, 180));
      // Should have called setMark exactly once despite multiple interval ticks
      expect(calls.length).toBe(1);
      expect(calls[0]).toEqual({
        sessionId: "ses_mark_1",
        mark: {
          icon: "close-circle",
          tone: "error",
          text: "Blocked by AutoGate",
        },
      });
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("aggregates recentSessions sorted by active inFlight first then newest latestAt, capped to 12x8", async () => {
    const { evalLogFile, runtimeDir, env } = makeTempEnv();
    const now = Date.now();

    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(
      path.join(runtimeDir, "live.json"),
      JSON.stringify({
        version: 1,
        pid: process.pid,
        workspaceRoot: "/tmp/ws",
        startedAt: now - 10_000,
        updatedAt: now,
        autoMode: true,
        reviewFallbackMode: "ntfy",
        consecutiveBlocks: 0,
        consecutiveBlockThreshold: 3,
        evalLogFile,
        inFlight: [
          {
            id: "inf_1",
            sessionID: "ses_older_active",
            toolName: "shell",
            commandString: "git push --force",
            stage: "awaiting-review",
            startedAt: now - 50_000,
          },
          ...Array.from({ length: 10 }, (_, idx) => ({
            id: `inf_many_${idx}`,
            sessionID: "ses_many_inflight",
            toolName: "bash",
            commandString: `step ${idx}`,
            stage: "evaluating",
            startedAt: now - 40_000 + idx,
          })),
        ],
      }),
      "utf8",
    );

    const lines: string[] = [];
    // 14 distinct sessions with evaluations, plus 10 evals on ses_older_active
    for (let s = 0; s < 14; s += 1) {
      lines.push(
        JSON.stringify({
          timestamp: now - (s + 1) * 1000,
          sessionID: `ses_eval_${s}`,
          toolName: "bash",
          commandString: `echo ${s}`,
          verdict: s === 0 ? "BLOCK" : s === 1 ? "UNSURE" : "ALLOW",
          durationMs: 100 + s * 10,
          cascade: { winner: s % 2 === 0 ? "system1" : "system2" },
        }),
      );
    }
    for (let i = 0; i < 10; i += 1) {
      lines.push(
        JSON.stringify({
          timestamp: now - 80_000 + i * 1000,
          sessionID: "ses_older_active",
          toolName: "shell",
          commandString: `cmd-${i}`,
          verdict: i === 0 ? "BLOCK" : i === 1 ? "UNSURE" : "ALLOW",
          durationMs: 200,
          cascade: { winner: i < 5 ? "system1" : "system2" },
        }),
      );
    }
    fs.writeFileSync(evalLogFile, lines.join("\n") + "\n", "utf8");

    const snapshot = await collectAutoGateSnapshot({
      env,
      now,
      healthCache: new SystemOneHealthCache(async () => ({ reachable: false })),
    });

    expect(snapshot.recentSessions.length).toBe(12);
    // Active inFlight sessions must come first, ordered by newest latestAt
    expect(snapshot.recentSessions[0]?.sessionID).toBe("ses_many_inflight");
    expect(snapshot.recentSessions[0]?.inFlightCount).toBe(10);
    expect(snapshot.recentSessions[0]?.inFlight.length).toBe(8);

    const activeEvalSession = snapshot.recentSessions[1]!;
    expect(activeEvalSession.sessionID).toBe("ses_older_active");
    expect(activeEvalSession.inFlightCount).toBe(1);
    expect(activeEvalSession.awaitingReviewCount).toBe(1);
    expect(activeEvalSession.totalCount).toBe(10);
    expect(activeEvalSession.allowCount).toBe(8);
    expect(activeEvalSession.blockCount).toBe(1);
    expect(activeEvalSession.unsureCount).toBe(1);
    expect(activeEvalSession.avgLatencyMs).toBe(200);
    expect(activeEvalSession.s1FastPathPct).toBe(50);
    expect(activeEvalSession.recentEvaluations.length).toBe(8);
    expect(activeEvalSession.latestVerdict).toBe("ALLOW");
    expect(activeEvalSession.latestToolName).toBe("shell");
    expect(activeEvalSession.latestCommandPreview).toBe("git push --force");

    // Non-active sessions follow in newest latestAt order
    expect(snapshot.recentSessions[2]?.sessionID).toBe("ses_eval_0");
    expect(snapshot.recentSessions[2]?.latestVerdict).toBe("BLOCK");
    expect(snapshot.recentSessions[3]?.sessionID).toBe("ses_eval_1");
    expect(snapshot.recentSessions[3]?.latestVerdict).toBe("UNSURE");

    // Verify bounded popover payload stays strictly under GUEST_POPOVER_DATA_MAX (16,000)
    const hugeSummary = buildRecentSessions(
      Array.from({ length: 8 }, (_, idx) => ({
        id: `huge-${idx}`,
        timestamp: now - idx * 1000,
        sessionID: "ses_huge",
        toolName: "shell",
        commandString: "A".repeat(4000),
        commandPreview: "B".repeat(500),
        userPrompt: "C".repeat(2000),
        reasoning: "D".repeat(2000),
        verdict: "BLOCK",
        durationMs: 300,
        sourceFormat: "opencode",
      })),
      Array.from({ length: 4 }, (_, idx) => ({
        id: `inf-${idx}`,
        sessionID: "ses_huge",
        toolName: "shell",
        commandString: "E".repeat(2000),
        reason: "F".repeat(2000),
        awaitingReview: true,
        startedAt: now,
      })),
    )[0]!;

    const bounded = toBoundedSessionPopoverPayload(hugeSummary, "Long Title ".repeat(20));
    const serializedLen = JSON.stringify(bounded).length;
    expect(serializedLen).toBeLessThanOrEqual(12_000);
    expect(serializedLen).toBeLessThan(GUEST_POPOVER_DATA_MAX);
  });
});
