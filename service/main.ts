import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createServiceHost,
  type GuestStatusActionEvent,
  type ServiceHost,
  type ServiceMark,
} from "@openchamber/sdk";
import type {
  AutoGateActionRequest,
  AutoGateActionResponse,
  ReviewFallbackMode,
} from "../shared/types.ts";
import {
  buildStatusView,
  collectAutoGateSnapshot,
  computeSessionMarks,
  loadSanitizedConfig,
  SystemOneHealthCache,
  updateConfigFile,
  writeControlReset,
  type AutoGateEnv,
  type SystemOneProbeFn,
} from "./autogate-store.ts";

export interface AutoGateServiceOptions {
  env?: AutoGateEnv;
  serviceHost?: Pick<ServiceHost, "setMark">;
  probeSystemOne?: SystemOneProbeFn;
  pidChecker?: (pid: unknown) => boolean;
  enableMarksLoop?: boolean;
  marksIntervalMs?: number;
}

const sendJson = (res: http.ServerResponse, status: number, payload: unknown): void => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const readRequestBody = (req: http.IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > 1024 * 1024) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const serializeMark = (mark: ServiceMark | null): string =>
  mark === null
    ? "null"
    : JSON.stringify({
        icon: mark.icon,
        tone: mark.tone,
        text: mark.text,
        ...(mark.url ? { url: mark.url } : {}),
      });

export const createAutoGateServiceServer = (options: AutoGateServiceOptions = {}): http.Server => {
  const env = options.env ?? process.env;
  const token = env.OPENCHAMBER_SERVICE_TOKEN ?? "";
  const healthCache = new SystemOneHealthCache(options.probeSystemOne);

  let lazyServiceHost: Pick<ServiceHost, "setMark"> | null = options.serviceHost ?? null;
  const getServiceHost = (): Pick<ServiceHost, "setMark"> | null => {
    if (lazyServiceHost) return lazyServiceHost;
    try {
      lazyServiceHost = createServiceHost({ env });
      return lazyServiceHost;
    } catch {
      return null;
    }
  };

  const lastMarksBySession = new Map<string, string>();
  let marksSyncInFlight = false;

  const syncSessionMarks = async (): Promise<void> => {
    if (marksSyncInFlight) return;
    if (!env.OPENCHAMBER_HOST_CALLBACK_URL && !options.serviceHost) return;
    const host = getServiceHost();
    if (!host) return;

    marksSyncInFlight = true;
    try {
      const snapshot = await collectAutoGateSnapshot({
        env,
        healthCache,
        pidChecker: options.pidChecker,
      });
      const desired = computeSessionMarks(snapshot, lastMarksBySession.keys());
      for (const [sessionId, mark] of desired.entries()) {
        const encoded = serializeMark(mark);
        const prevEncoded = lastMarksBySession.get(sessionId);
        if (encoded === prevEncoded) continue;

        try {
          await host.setMark({ sessionId }, mark);
          if (mark === null) {
            lastMarksBySession.delete(sessionId);
          } else {
            lastMarksBySession.set(sessionId, encoded);
          }
        } catch {
          // Host callback unavailable or marks capability not yet granted; retry on next tick
        }
      }
    } catch {
      // Never crash the service loop on transient read errors
    } finally {
      marksSyncInFlight = false;
    }
  };

  const handleStatusPost = (event: GuestStatusActionEvent): { status: number; body: unknown } => {
    if (!event || typeof event.id !== "string") {
      return { status: 400, body: { message: "Missing control id." } };
    }

    if (event.id === "toggle-automode") {
      const current = loadSanitizedConfig(env);
      let nextAutoMode: boolean;
      if (event.value === "on") {
        nextAutoMode = true;
      } else if (event.value === "off") {
        nextAutoMode = false;
      } else {
        nextAutoMode = !current.autoMode;
      }
      const updated = updateConfigFile(env, { autoMode: nextAutoMode });
      return { status: 200, body: { ok: true, autoMode: updated.autoMode } };
    }

    if (event.id === "set-fallback") {
      if (event.value !== "native" && event.value !== "ntfy") {
        return {
          status: 400,
          body: { message: `Invalid fallback mode: ${String(event.value ?? "")}` },
        };
      }
      const updated = updateConfigFile(env, { reviewFallbackMode: event.value });
      return {
        status: 200,
        body: { ok: true, reviewFallbackMode: updated.reviewFallbackMode },
      };
    }

    if (event.id === "reset-breaker") {
      const resetCircuitBreakerAt = writeControlReset(env);
      return { status: 200, body: { ok: true, resetCircuitBreakerAt } };
    }

    return { status: 404, body: { message: `Unknown AutoGate control: ${event.id}` } };
  };

  const handleApiAction = async (
    reqBody: AutoGateActionRequest,
    directory: string | null,
  ): Promise<{ status: number; body: unknown }> => {
    if (!reqBody || typeof reqBody !== "object" || typeof reqBody.action !== "string") {
      return { status: 400, body: { message: "Invalid action payload." } };
    }

    if (reqBody.action === "setAutoMode") {
      if (typeof reqBody.enabled !== "boolean") {
        return { status: 400, body: { message: "enabled must be a boolean." } };
      }
      updateConfigFile(env, { autoMode: reqBody.enabled });
    } else if (reqBody.action === "setFallbackMode") {
      const mode: ReviewFallbackMode = reqBody.mode;
      if (mode !== "native" && mode !== "ntfy") {
        return { status: 400, body: { message: "mode must be 'native' or 'ntfy'." } };
      }
      updateConfigFile(env, { reviewFallbackMode: mode });
    } else if (reqBody.action === "resetBreaker") {
      writeControlReset(env);
    } else {
      return { status: 404, body: { message: "Unknown action." } };
    }

    const state = await collectAutoGateSnapshot({
      env,
      directory,
      healthCache,
      pidChecker: options.pidChecker,
    });
    const response: AutoGateActionResponse = { ok: true, state };
    return { status: 200, body: response };
  };

  const server = http.createServer((req, res) => {
    if (!token || req.headers.authorization !== `Bearer ${token}`) {
      sendJson(res, 401, { message: "Unauthorized" });
      return;
    }

    const parsedUrl = new URL(req.url ?? "/", "http://127.0.0.1");
    const pathname = parsedUrl.pathname;
    const method = (req.method ?? "GET").toUpperCase();
    const directory = parsedUrl.searchParams.get("directory");

    void (async () => {
      try {
        if (method === "GET" && pathname === "/health") {
          sendJson(res, 200, { ok: true });
          return;
        }

        if (pathname === "/status") {
          if (method === "GET") {
            const snapshot = await collectAutoGateSnapshot({
              env,
              directory,
              healthCache,
              pidChecker: options.pidChecker,
            });
            sendJson(res, 200, buildStatusView(snapshot));
            return;
          }

          if (method === "POST") {
            const rawBody = await readRequestBody(req);
            let event: GuestStatusActionEvent;
            try {
              event = JSON.parse(rawBody || "{}") as GuestStatusActionEvent;
            } catch {
              sendJson(res, 400, { message: "Invalid JSON body." });
              return;
            }
            const result = handleStatusPost(event);
            sendJson(res, result.status, result.body);
            return;
          }

          sendJson(res, 405, { message: "Method not allowed" });
          return;
        }

        if (method === "GET" && pathname === "/api/state") {
          const snapshot = await collectAutoGateSnapshot({
            env,
            directory,
            sessionId: parsedUrl.searchParams.get("sessionId"),
            verdict: parsedUrl.searchParams.get("verdict"),
            query: parsedUrl.searchParams.get("q"),
            healthCache,
            pidChecker: options.pidChecker,
          });
          sendJson(res, 200, snapshot);
          return;
        }

        if (method === "POST" && pathname === "/api/action") {
          const rawBody = await readRequestBody(req);
          let payload: AutoGateActionRequest;
          try {
            payload = JSON.parse(rawBody || "{}") as AutoGateActionRequest;
          } catch {
            sendJson(res, 400, { message: "Invalid JSON body." });
            return;
          }
          const result = await handleApiAction(payload, directory);
          sendJson(res, result.status, result.body);
          return;
        }

        sendJson(res, 404, { message: `Not found: ${pathname}` });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal AutoGate service error.";
        if (!res.headersSent) {
          sendJson(res, 500, { message });
        }
      }
    })();
  });

  if (options.enableMarksLoop !== false) {
    const intervalMs = options.marksIntervalMs ?? 3000;
    const timer = setInterval(() => {
      void syncSessionMarks();
    }, intervalMs);
    timer.unref?.();
    server.on("close", () => {
      clearInterval(timer);
    });
    void syncSessionMarks();
  }

  return server;
};

const isMainEntry = (): boolean => {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return path.resolve(fileURLToPath(import.meta.url)) === path.resolve(entry);
  } catch {
    return true;
  }
};

if (process.env.OPENCHAMBER_SERVICE_PORT && isMainEntry()) {
  const port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
  const server = createAutoGateServiceServer({ env: process.env });
  server.listen(port, "127.0.0.1");
}
