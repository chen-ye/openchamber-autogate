// service/main.ts
import http from "node:http";
import path2 from "node:path";
import { fileURLToPath } from "node:url";
// node_modules/@openchamber/sdk/dist/scrollbar-style.js
var GUEST_SCROLLING_ATTRIBUTE = "data-oc-scrolling";
var GUEST_SCROLLBAR_CSS = `
:root {
  /* Quiet at rest like the app's own thumbs; hover gives a clear grab target. */
  --oc-scrollbar-thumb: color-mix(in srgb, var(--oc-muted, currentColor) 18%, transparent);
  --oc-scrollbar-thumb-hover: color-mix(in srgb, var(--oc-muted, currentColor) 36%, transparent);
  scrollbar-gutter: stable;
}
* {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}
:hover, [${GUEST_SCROLLING_ATTRIBUTE}] {
  scrollbar-color: var(--oc-scrollbar-thumb) transparent;
}
/* Chromium's standard scrollbar properties otherwise override its pseudo-elements. */
@supports selector(::-webkit-scrollbar) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-width: auto; scrollbar-color: auto; }
  ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
    min-width: 24px;
    min-height: 24px;
  }
  :hover::-webkit-scrollbar-thumb, [${GUEST_SCROLLING_ATTRIBUTE}]::-webkit-scrollbar-thumb { background: var(--oc-scrollbar-thumb); }
  ::-webkit-scrollbar-thumb:hover { background: var(--oc-scrollbar-thumb-hover); }
  ::-webkit-scrollbar-corner { background: transparent; }
  ::-webkit-scrollbar-button { display: none; width: 0; height: 0; }
}
@media (forced-colors: active) {
  *, :hover, [${GUEST_SCROLLING_ATTRIBUTE}] { scrollbar-color: auto; }
  ::-webkit-scrollbar-thumb, ::-webkit-scrollbar-thumb:hover { background: CanvasText; }
}
`;
function installGuestScrollbarActivity(doc) {
  const root = doc.documentElement;
  if (root.hasAttribute("data-oc-scrollbar-activity"))
    return;
  root.setAttribute("data-oc-scrollbar-activity", "");
  const timers = new WeakMap;
  doc.addEventListener("scroll", (event) => {
    const target = event.target === doc ? root : event.target;
    if (!(target instanceof Element))
      return;
    if (!target.hasAttribute("data-oc-scrolling"))
      target.setAttribute("data-oc-scrolling", "");
    const pending = timers.get(target);
    if (pending !== undefined)
      clearTimeout(pending);
    timers.set(target, setTimeout(() => {
      timers.delete(target);
      target.removeAttribute("data-oc-scrolling");
    }, 1000));
  }, { capture: true, passive: true });
}
var GUEST_SCROLLBAR_SCRIPT = `(${installGuestScrollbarActivity.toString()})(document);`;
// node_modules/@openchamber/sdk/dist/manifest.js
var GUEST_PROVIDER_LOGO_BYTES_MAX = 1024 * 1024;
var TRACKER_URL_TOKENS = ["{id}", "{segment}", "{segments+}"];
var TRACKER_URL_TOKEN_SET = new Set(TRACKER_URL_TOKENS);
// node_modules/@openchamber/sdk/dist/session-events.js
var GUEST_SESSION_EVENT_TYPES = [
  "turn-finished",
  "turn-failed",
  "permission-asked",
  "question-asked",
  "turn-started",
  "session-created",
  "session-archived",
  "session-deleted"
];
var SESSION_EVENTS_IDLE_MS = 10 * 60000;
var EVENT_TYPES = new Set(GUEST_SESSION_EVENT_TYPES);
// node_modules/@openchamber/sdk/dist/service-host.js
var SERVICE_HOST_PATH = "/service/call";
var OPENCHAMBER_HOST_CALLBACK_URL_ENV = "OPENCHAMBER_HOST_CALLBACK_URL";
var SERVICE_HOST_TIMEOUT_MS = 30000;
var SERVICE_SCHEDULE_IDLE_MS = 10 * 60000;
var MENTIONS_IDLE_MS = 10 * 60000;
class ServiceHostError extends Error {
  code;
  status;
  constructor(message, code, status) {
    super(message);
    this.name = "ServiceHostError";
    this.code = code;
    this.status = status;
  }
}
var createServiceHost = ({ env }) => {
  const call = async (method, input) => {
    const base = env[OPENCHAMBER_HOST_CALLBACK_URL_ENV];
    const token = env.OPENCHAMBER_SERVICE_TOKEN;
    if (!base || !token)
      throw new ServiceHostError("This service was not started by OpenChamber.", "HOST_UNAVAILABLE", 0);
    let response;
    try {
      response = await fetch(`${base.replace(/\/+$/, "")}${SERVICE_HOST_PATH}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ method, input }),
        signal: AbortSignal.timeout(SERVICE_HOST_TIMEOUT_MS)
      });
    } catch {
      throw new ServiceHostError("OpenChamber did not answer.", "HOST_UNAVAILABLE", 0);
    }
    const body = await response.json().catch(() => null);
    if (response.ok && body?.result !== undefined)
      return body.result;
    throw new ServiceHostError(body?.error?.message ?? `OpenChamber answered HTTP ${response.status}.`, body?.error?.code ?? "HOST_UNAVAILABLE", response.status);
  };
  return {
    sessions: {
      start: (input) => call("sessions.start", input),
      send: (sessionId, prompt) => call("sessions.send", { sessionId, prompt }),
      retry: (sessionId) => call("sessions.retry", { sessionId }),
      status: (sessionId) => call("sessions.status", { sessionId }),
      lastReply: (sessionId) => call("sessions.lastReply", { sessionId }),
      stop: (sessionId) => call("sessions.stop", { sessionId }),
      answerPermission: (sessionId, requestId, answer) => call("sessions.answerPermission", { sessionId, requestId, ...answer }),
      answerForm: (sessionId, formId, values, message) => call("sessions.answerForm", { sessionId, formId, values, ...message === undefined ? {} : { message } })
    },
    setInstructions: (directory, text) => call("instructions.set", { directory, text }),
    emit: (topic, data) => call("panels.emit", { topic, data }),
    readSettings: () => call("settings.read", {}).then(({ settings }) => settings),
    needsConfiguration: (message) => call("status.set", { needsConfiguration: message }),
    setMark: (target, mark) => call("marks.set", { target, mark })
  };
};
// node_modules/@openchamber/sdk/dist/file-editor.js
var patternExpressions = new Map;
// node_modules/@openchamber/sdk/dist/contract.js
var GUEST_FILE_STAT_KINDS = ["file", "directory", "other", "missing"];
var GUEST_GENERATE_LATE_KEEP_MS = 60 * 60000;
var HOST_REQUEST_ERROR_CODES = [
  "HOST_UNAVAILABLE",
  "HOST_TIMEOUT",
  "HOST_REJECTED",
  "DISCONNECTED",
  "DISABLED",
  "BAD_PATH",
  "NO_INTEGRATION",
  "NO_SERVICE",
  "SERVICE_FAILED",
  "REQUEST_FAILED",
  "RESPONSE_TOO_LARGE",
  "NO_SESSION",
  "SESSION_BUSY",
  "NOT_GRANTED",
  "NO_DIRECTORY",
  "NOT_FOUND",
  "FILE_TOO_LARGE",
  "DENIED",
  "NO_MODEL",
  "MODEL_FAILED",
  "UNSUPPORTED"
];
var SERVICE_STATUS_VALUES = ["stopped", "starting", "ready", "failed"];
var hostRequestErrorCodeSet = new Set(HOST_REQUEST_ERROR_CODES);
var serviceStatusSet = new Set(SERVICE_STATUS_VALUES);
var fileStatKindSet = new Set(GUEST_FILE_STAT_KINDS);
var HOST_PUSH_TYPES = new Set([
  "workspace",
  "shells",
  "ready",
  "directory",
  "session",
  "connection",
  "settings",
  "session-lifecycle",
  "item",
  "resolve",
  "action",
  "service-event",
  "status-control-event",
  "popover-closed",
  "file-open",
  "file-snapshot",
  "file-saved",
  "generate-late"
]);
// node_modules/@openchamber/sdk/dist/service-providers.js
var BROWSER_CONTROL_ACTIONS = [
  "browser.open",
  "browser.snapshot",
  "browser.click",
  "browser.type",
  "browser.select",
  "browser.scroll",
  "browser.back",
  "browser.forward",
  "browser.inspect",
  "browser.capture",
  "browser.resize",
  "browser.close"
];
var BROWSER_PROVIDER_IDLE_MS = 10 * 60000;
var CONTROL_ACTIONS = new Set(BROWSER_CONTROL_ACTIONS);
var SOURCE_CONTROL_PROVIDER_IDLE_MS = 10 * 60000;
var NOTIFICATIONS_PROVIDER_IDLE_MS = 10 * 60000;
var TRACKER_PROVIDER_IDLE_MS = 10 * 60000;
var QUOTA_PROVIDER_IDLE_MS = 10 * 60000;
// node_modules/@openchamber/sdk/dist/service-surface.js
var SURFACE_CONTROLLERS = ["none", "agent", "user"];
var CONTROLLERS = new Set(SURFACE_CONTROLLERS);
// service/autogate-store.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
var DEFAULT_SYSTEM_ONE_ENDPOINT = "http://127.0.0.1:4006/v1/systemone";
var DEFAULT_SYSTEM_ONE_MODEL = "gemini-decision-1";
var DEFAULT_SYSTEM_ONE_TIMEOUT_MS = 4000;
var DEFAULT_CLASSIFIER_MODEL = "google/gemini-3.5-flash-lite";
var DEFAULT_CLASSIFIER_TIMEOUT_MS = 45000;
var DEFAULT_CONSECUTIVE_BLOCK_THRESHOLD = 3;
var EVAL_TAIL_MAX_BYTES = 512 * 1024;
var EVAL_MAX_ENTRIES = 200;
var SYSTEM_ONE_HEALTH_TIMEOUT_MS = 800;
var SYSTEM_ONE_HEALTH_CACHE_TTL_MS = 3000;
var MARK_STALE_WINDOW_MS = 15 * 60 * 1000;
var isRecord = (val) => typeof val === "object" && val !== null && !Array.isArray(val);
var getHomeDir = (env) => {
  const envHome = env.HOME?.trim();
  return envHome && envHome.length > 0 ? envHome : os.homedir();
};
var expandHomePath = (inputPath, env = process.env) => {
  if (inputPath.startsWith("~/")) {
    return path.join(getHomeDir(env), inputPath.slice(2));
  }
  if (inputPath === "~") {
    return getHomeDir(env);
  }
  return inputPath;
};
var resolveConfigPaths = (env = process.env) => {
  const explicitConfig = env.AUTOGATE_CONFIG?.trim();
  let configPath;
  let configDir;
  if (explicitConfig && explicitConfig.length > 0) {
    configPath = path.resolve(expandHomePath(explicitConfig, env));
    configDir = path.dirname(configPath);
  } else {
    const xdgConfigHome = env.XDG_CONFIG_HOME?.trim();
    if (xdgConfigHome && xdgConfigHome.length > 0) {
      configDir = path.resolve(expandHomePath(path.join(xdgConfigHome, "autogate"), env));
    } else {
      configDir = path.join(getHomeDir(env), ".config", "autogate");
    }
    configPath = path.join(configDir, "config.json");
  }
  return {
    configPath,
    configDir,
    runtimeDir: path.join(configDir, "runtime"),
    controlPath: path.join(configDir, "control.json")
  };
};
var parseBooleanLike = (val) => {
  if (typeof val === "boolean")
    return val;
  if (typeof val === "string") {
    const lower = val.toLowerCase().trim();
    if (lower === "true" || lower === "1" || lower === "on")
      return true;
    if (lower === "false" || lower === "0" || lower === "off")
      return false;
  }
  return;
};
var parsePositiveNum = (val, fallback) => {
  if (typeof val === "number" && Number.isFinite(val) && val > 0)
    return val;
  if (typeof val === "string" && val.trim().length > 0) {
    const parsed = Number(val.trim());
    if (Number.isFinite(parsed) && parsed > 0)
      return parsed;
  }
  return fallback;
};
var normalizeFallbackMode = (val) => {
  if (typeof val !== "string")
    return;
  const lower = val.toLowerCase().trim();
  if (lower === "native" || lower === "terminal" || lower === "desk")
    return "native";
  if (lower === "ntfy" || lower === "mobile" || lower === "remote")
    return "ntfy";
  return;
};
var normalizeExecutionMode = (val) => val === "cascade" ? "cascade" : "race";
var normalizeVerdict = (val) => {
  if (typeof val !== "string")
    return null;
  const upper = val.toUpperCase().trim();
  if (upper === "ALLOW" || upper === "BLOCK" || upper === "UNSURE") {
    return upper;
  }
  return null;
};
var truncateText = (text, maxLen) => {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLen)
    return singleLine;
  if (maxLen <= 1)
    return singleLine.slice(0, maxLen);
  return `${singleLine.slice(0, maxLen - 1)}…`;
};
var readJsonObjectSafe = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) {
      return { exists: false, data: {} };
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return { exists: true, data: isRecord(parsed) ? parsed : {} };
  } catch {
    return { exists: false, data: {} };
  }
};
var loadSanitizedConfig = (env = process.env) => {
  const paths = resolveConfigPaths(env);
  const { exists, data: raw } = readJsonObjectSafe(paths.configPath);
  const autoMode = parseBooleanLike(env.AUTOGATE_AUTO_MODE) ?? parseBooleanLike(env.OPENCODE_AUTO_MODE) ?? parseBooleanLike(raw.autoMode) ?? true;
  const ompObj = isRecord(raw.omp) ? raw.omp : {};
  const reviewFallbackMode = normalizeFallbackMode(env.AUTOGATE_FALLBACK) ?? normalizeFallbackMode(raw.reviewFallbackMode) ?? normalizeFallbackMode(raw.fallbackMode) ?? normalizeFallbackMode(ompObj.reviewFallbackMode) ?? "ntfy";
  const classifierModel = typeof env.CLASSIFIER_MODEL === "string" && env.CLASSIFIER_MODEL.trim() || typeof raw.classifierModel === "string" && raw.classifierModel.trim() || DEFAULT_CLASSIFIER_MODEL;
  const classifierTimeout = parsePositiveNum(env.CLASSIFIER_TIMEOUT ?? raw.classifierTimeout, DEFAULT_CLASSIFIER_TIMEOUT_MS);
  const consecutiveBlockThreshold = Math.max(1, Math.floor(parsePositiveNum(env.CONSECUTIVE_BLOCK_THRESHOLD ?? raw.consecutiveBlockThreshold, DEFAULT_CONSECUTIVE_BLOCK_THRESHOLD)));
  const notifyOnVerdict = parseBooleanLike(env.AUTOGATE_NOTIFY_ON_VERDICT) ?? parseBooleanLike(raw.notifyOnVerdict) ?? true;
  const rawNtfyServer = typeof env.NTFY_SERVER === "string" && env.NTFY_SERVER.trim() || typeof raw.ntfyServer === "string" && raw.ntfyServer.trim() || "https://ntfy.sh";
  let ntfyServer = "https://ntfy.sh";
  try {
    ntfyServer = new URL(rawNtfyServer).toString().replace(/\/$/, "");
  } catch {
    ntfyServer = "https://ntfy.sh";
  }
  const ntfyTopic = typeof env.AUTOGATE_NTFY_TOPIC === "string" && env.AUTOGATE_NTFY_TOPIC.trim() || typeof env.NTFY_TOPIC === "string" && env.NTFY_TOPIC.trim() || typeof raw.ntfyTopic === "string" && raw.ntfyTopic.trim() || "autogate";
  const hasNtfyToken = Boolean(typeof env.NTFY_TOKEN === "string" && env.NTFY_TOKEN.trim() || typeof env.AUTOGATE_NTFY_TOKEN === "string" && env.AUTOGATE_NTFY_TOKEN.trim() || typeof raw.ntfyToken === "string" && raw.ntfyToken.trim());
  const rawEvalLog = typeof env.AUTOGATE_EVAL_LOG === "string" && env.AUTOGATE_EVAL_LOG.trim() || typeof raw.evalLogFile === "string" && raw.evalLogFile.trim() || typeof ompObj.evalLogFile === "string" && ompObj.evalLogFile.trim() || "";
  const evalLogFile = rawEvalLog ? path.resolve(expandHomePath(rawEvalLog, env)) : path.join(getHomeDir(env), ".omp", "logs", "autogate-evals.jsonl");
  const rawS1 = isRecord(raw.systemOne) ? raw.systemOne : {};
  const s1Enabled = parseBooleanLike(env.AUTOGATE_SYSTEM_ONE_ENABLED) ?? parseBooleanLike(rawS1.enabled) ?? false;
  const s1Mode = normalizeExecutionMode(env.AUTOGATE_SYSTEM_ONE_MODE ?? rawS1.executionMode);
  const s1Endpoint = typeof env.AUTOGATE_SYSTEM_ONE_ENDPOINT === "string" && env.AUTOGATE_SYSTEM_ONE_ENDPOINT.trim() || typeof rawS1.endpoint === "string" && rawS1.endpoint.trim() || DEFAULT_SYSTEM_ONE_ENDPOINT;
  const s1Model = typeof env.AUTOGATE_SYSTEM_ONE_MODEL === "string" && env.AUTOGATE_SYSTEM_ONE_MODEL.trim() || typeof rawS1.model === "string" && rawS1.model.trim() || DEFAULT_SYSTEM_ONE_MODEL;
  const s1Timeout = parsePositiveNum(env.AUTOGATE_SYSTEM_ONE_TIMEOUT_MS ?? rawS1.timeoutMs, DEFAULT_SYSTEM_ONE_TIMEOUT_MS);
  const hasApiKey = Boolean(typeof env.AUTOGATE_SYSTEM_ONE_API_KEY === "string" && env.AUTOGATE_SYSTEM_ONE_API_KEY.trim() || typeof rawS1.apiKey === "string" && rawS1.apiKey.trim());
  return {
    configPath: paths.configPath,
    configDir: paths.configDir,
    configExists: exists,
    autoMode,
    reviewFallbackMode,
    classifierModel,
    classifierTimeout,
    consecutiveBlockThreshold,
    notifyOnVerdict,
    ntfyServer,
    ntfyTopic,
    hasNtfyToken,
    evalLogFile,
    systemOne: {
      enabled: s1Enabled,
      executionMode: s1Mode,
      endpoint: s1Endpoint,
      model: s1Model,
      timeoutMs: s1Timeout,
      hasApiKey
    }
  };
};
var atomicWriteJson = (filePath, payload) => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2) + `
`, "utf8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {}
    throw err;
  }
};
var updateConfigFile = (env, patch) => {
  const paths = resolveConfigPaths(env);
  let existing = {};
  if (fs.existsSync(paths.configPath)) {
    const rawText = fs.readFileSync(paths.configPath, "utf8").trim();
    if (rawText.length > 0) {
      const parsed = JSON.parse(rawText);
      if (!isRecord(parsed)) {
        throw new Error("Existing AutoGate config.json is not a JSON object.");
      }
      existing = { ...parsed };
    }
  }
  if (typeof patch.autoMode === "boolean") {
    existing.autoMode = patch.autoMode;
  }
  if (patch.reviewFallbackMode === "native" || patch.reviewFallbackMode === "ntfy") {
    existing.reviewFallbackMode = patch.reviewFallbackMode;
  }
  atomicWriteJson(paths.configPath, existing);
  return loadSanitizedConfig(env);
};
var readControlResetAt = (env = process.env) => {
  const paths = resolveConfigPaths(env);
  const { exists, data } = readJsonObjectSafe(paths.controlPath);
  if (!exists)
    return null;
  const ts = data.resetCircuitBreakerAt;
  return typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? ts : null;
};
var writeControlReset = (env = process.env, timestamp = Date.now()) => {
  const paths = resolveConfigPaths(env);
  const { exists, data } = readJsonObjectSafe(paths.controlPath);
  const next = exists ? { ...data } : {};
  next.resetCircuitBreakerAt = timestamp;
  atomicWriteJson(paths.controlPath, next);
  return timestamp;
};
var isPidAlive = (pid) => {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = err?.code;
    return code === "EPERM";
  }
};
var normalizeInFlightItem = (raw, idx, defaultWorkspaceRoot) => {
  if (!isRecord(raw))
    return null;
  const id = typeof raw.id === "string" && raw.id.trim() || typeof raw.requestID === "string" && raw.requestID.trim() || `inflight-${idx}`;
  const sessionID = typeof raw.sessionID === "string" && raw.sessionID.trim() || typeof raw.sessionId === "string" && raw.sessionId.trim() || "";
  const toolName = typeof raw.toolName === "string" && raw.toolName.trim() || typeof raw.action === "string" && raw.action.trim() || "permission";
  const commandString = typeof raw.commandString === "string" && raw.commandString.trim() ? raw.commandString.trim() : typeof raw.command === "string" && raw.command.trim() ? raw.command.trim() : undefined;
  const workspaceRoot = typeof raw.workspaceRoot === "string" && raw.workspaceRoot.trim() ? raw.workspaceRoot.trim() : typeof raw.directory === "string" && raw.directory.trim() ? raw.directory.trim() : defaultWorkspaceRoot;
  const reason = typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim() : undefined;
  const stage = typeof raw.stage === "string" && raw.stage.trim() ? raw.stage.trim() : undefined;
  const status = (typeof raw.status === "string" && raw.status.trim() ? raw.status.trim() : undefined) ?? stage;
  const awaitingReview = typeof raw.awaitingReview === "boolean" ? raw.awaitingReview : stage === "evaluating" || status === "evaluating" || status === "classifying" ? false : true;
  const startedAt = typeof raw.startedAt === "number" && Number.isFinite(raw.startedAt) ? raw.startedAt : undefined;
  return {
    id,
    sessionID,
    toolName,
    ...commandString ? { commandString } : {},
    ...workspaceRoot ? { workspaceRoot } : {},
    ...reason ? { reason } : {},
    awaitingReview,
    ...status ? { status } : {},
    ...startedAt !== undefined ? { startedAt } : {}
  };
};
var normalizeRuntimeLastVerdict = (raw) => {
  if (!isRecord(raw))
    return null;
  const verdict = normalizeVerdict(raw.verdict);
  if (!verdict)
    return null;
  const timestamp = typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp) ? raw.timestamp : typeof raw.timestamp === "string" && Number.isFinite(Date.parse(raw.timestamp)) ? Date.parse(raw.timestamp) : Date.now();
  return {
    timestamp,
    ...typeof raw.sessionID === "string" && raw.sessionID.trim() ? { sessionID: raw.sessionID.trim() } : {},
    ...typeof raw.toolName === "string" && raw.toolName.trim() ? { toolName: raw.toolName.trim() } : {},
    ...typeof raw.commandString === "string" && raw.commandString.trim() ? { commandString: raw.commandString.trim() } : {},
    verdict,
    ...typeof raw.reason === "string" && raw.reason.trim() ? { reason: raw.reason.trim() } : {},
    ...typeof raw.riskLevel === "string" && raw.riskLevel.trim() ? { riskLevel: raw.riskLevel.trim() } : typeof raw.risk_level === "string" && raw.risk_level.trim() ? { riskLevel: raw.risk_level.trim() } : {},
    ...typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs) ? { durationMs: raw.durationMs } : {}
  };
};
var loadLiveRuntimes = (env = process.env, pidChecker = isPidAlive) => {
  const paths = resolveConfigPaths(env);
  if (!fs.existsSync(paths.runtimeDir))
    return [];
  let entries;
  try {
    entries = fs.readdirSync(paths.runtimeDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const runtimes = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json"))
      continue;
    const filePath = path.join(paths.runtimeDir, entry.name);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }
    if (!isRecord(parsed) || !pidChecker(parsed.pid))
      continue;
    const pid = parsed.pid;
    const workspaceRoot = typeof parsed.workspaceRoot === "string" ? parsed.workspaceRoot.trim() : "";
    const inFlightRaw = Array.isArray(parsed.inFlight) ? parsed.inFlight : [];
    const inFlight = [];
    for (let i = 0;i < inFlightRaw.length; i += 1) {
      const item = normalizeInFlightItem(inFlightRaw[i], i, workspaceRoot);
      if (item)
        inFlight.push(item);
    }
    const consecutiveBlocks = typeof parsed.consecutiveBlocks === "number" && Number.isFinite(parsed.consecutiveBlocks) && parsed.consecutiveBlocks >= 0 ? Math.floor(parsed.consecutiveBlocks) : 0;
    const consecutiveBlockThreshold = Math.max(1, Math.floor(parsePositiveNum(parsed.consecutiveBlockThreshold, DEFAULT_CONSECUTIVE_BLOCK_THRESHOLD)));
    runtimes.push({
      version: typeof parsed.version === "number" ? parsed.version : 1,
      pid,
      workspaceRoot,
      startedAt: typeof parsed.startedAt === "number" && Number.isFinite(parsed.startedAt) ? parsed.startedAt : 0,
      updatedAt: typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
      autoMode: typeof parsed.autoMode === "boolean" ? parsed.autoMode : true,
      reviewFallbackMode: normalizeFallbackMode(parsed.reviewFallbackMode) ?? "ntfy",
      remoteReviewEnabled: typeof parsed.remoteReviewEnabled === "boolean" ? parsed.remoteReviewEnabled : true,
      consecutiveBlocks,
      consecutiveBlockThreshold,
      classifierModel: typeof parsed.classifierModel === "string" && parsed.classifierModel.trim() ? parsed.classifierModel.trim() : DEFAULT_CLASSIFIER_MODEL,
      systemOneEnabled: typeof parsed.systemOneEnabled === "boolean" ? parsed.systemOneEnabled : false,
      systemOneMode: normalizeExecutionMode(parsed.systemOneMode),
      evalLogFile: typeof parsed.evalLogFile === "string" && parsed.evalLogFile.trim() ? path.resolve(expandHomePath(parsed.evalLogFile.trim(), env)) : "",
      inFlight,
      lastVerdict: normalizeRuntimeLastVerdict(parsed.lastVerdict)
    });
  }
  runtimes.sort((a, b) => b.updatedAt - a.updatedAt);
  return runtimes;
};
var formatCommandPreview = (rawCommand) => {
  const trimmed = rawCommand.trim();
  if (!trimmed)
    return "";
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const parts = parsed.filter((item) => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
        if (parts.length > 0) {
          return parts.join(" && ").replace(/\s+/g, " ");
        }
      }
    } catch {}
  }
  return trimmed.replace(/\s+/g, " ");
};
var normalizeCascadeTrace = (raw) => {
  if (!isRecord(raw))
    return;
  const trace = {};
  if (typeof raw.mode === "string" && raw.mode.trim())
    trace.mode = raw.mode.trim();
  if (raw.winner === "system1" || raw.winner === "system2")
    trace.winner = raw.winner;
  if (typeof raw.escalationReason === "string" && raw.escalationReason.trim()) {
    trace.escalationReason = raw.escalationReason.trim();
  }
  if (typeof raw.s1LatencyMs === "number" && Number.isFinite(raw.s1LatencyMs)) {
    trace.s1LatencyMs = raw.s1LatencyMs;
  }
  if (typeof raw.s2LatencyMs === "number" && Number.isFinite(raw.s2LatencyMs)) {
    trace.s2LatencyMs = raw.s2LatencyMs;
  }
  if (typeof raw.s2Aborted === "boolean")
    trace.s2Aborted = raw.s2Aborted;
  if (isRecord(raw.s1Probs)) {
    const probs = {};
    for (const [k, v] of Object.entries(raw.s1Probs)) {
      if (typeof v === "number" && Number.isFinite(v))
        probs[k] = v;
    }
    if (Object.keys(probs).length > 0)
      trace.s1Probs = probs;
  }
  if (typeof raw.inScopeScore === "number" && Number.isFinite(raw.inScopeScore)) {
    trace.inScopeScore = raw.inScopeScore;
  }
  if (typeof raw.injectionScore === "number" && Number.isFinite(raw.injectionScore)) {
    trace.injectionScore = raw.injectionScore;
  }
  return Object.keys(trace).length > 0 ? trace : undefined;
};
var parseTimestampMs = (raw) => {
  if (typeof raw === "number" && Number.isFinite(raw))
    return raw;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const num = Number(raw.trim());
    if (Number.isFinite(num) && num > 0)
      return num;
    const parsed = Date.parse(raw.trim());
    if (Number.isFinite(parsed))
      return parsed;
  }
  return null;
};
var normalizeEvalLogEntry = (raw, index) => {
  if (!isRecord(raw))
    return null;
  const isOmp = isRecord(raw.action) || isRecord(raw.decision);
  const timestamp = parseTimestampMs(raw.timestamp) ?? 0;
  if (isOmp) {
    const action = isRecord(raw.action) ? raw.action : {};
    const decision = isRecord(raw.decision) ? raw.decision : {};
    const inference = isRecord(raw.inference) ? raw.inference : {};
    const modelObj = isRecord(raw.model) ? raw.model : {};
    const verdict = normalizeVerdict(decision.verdict ?? raw.verdict);
    if (!verdict)
      return null;
    const toolName = typeof action.toolName === "string" && action.toolName.trim() || typeof raw.toolName === "string" && raw.toolName.trim() || "tool";
    const commandRaw = typeof action.command === "string" && action.command || typeof action.targetPath === "string" && action.targetPath || typeof raw.commandString === "string" && raw.commandString || "";
    const sessionID = typeof action.sessionID === "string" && action.sessionID.trim() || typeof raw.sessionID === "string" && raw.sessionID.trim() || "";
    const reasoning = typeof decision.reason === "string" && decision.reason.trim() || typeof inference.thinking === "string" && inference.thinking.trim() || typeof raw.error === "string" && raw.error.trim() || undefined;
    const riskLevel = typeof decision.riskLevel === "string" && decision.riskLevel.trim() || typeof decision.risk_level === "string" && decision.risk_level.trim() || undefined;
    const userAuthorization = typeof decision.userAuthorization === "string" && decision.userAuthorization.trim() || typeof decision.user_authorization === "string" && decision.user_authorization.trim() || undefined;
    const durationMs = typeof inference.durationMs === "number" && Number.isFinite(inference.durationMs) ? Math.max(0, Math.round(inference.durationMs)) : 0;
    const modelId = typeof modelObj.id === "string" ? modelObj.id.trim() : "";
    const modelProvider = typeof modelObj.provider === "string" ? modelObj.provider.trim() : "";
    const model = modelId ? modelProvider ? `${modelProvider}/${modelId}` : modelId : undefined;
    const id = typeof action.id === "string" && action.id.trim() || `omp-${timestamp}-${index}`;
    return {
      id,
      timestamp,
      sessionID,
      toolName,
      commandString: commandRaw,
      commandPreview: formatCommandPreview(commandRaw),
      ...typeof raw.userPrompt === "string" && raw.userPrompt.trim() ? { userPrompt: raw.userPrompt.trim() } : {},
      ...reasoning ? { reasoning } : {},
      verdict,
      ...riskLevel ? { riskLevel } : {},
      ...userAuthorization ? { userAuthorization } : {},
      durationMs,
      sourceFormat: "omp",
      ...model ? { model } : {},
      ...normalizeCascadeTrace(raw.cascade) ? { cascade: normalizeCascadeTrace(raw.cascade) } : {}
    };
  }
  const verdict = normalizeVerdict(raw.verdict);
  if (!verdict)
    return null;
  const toolName = typeof raw.toolName === "string" && raw.toolName.trim() || "permission";
  const commandRaw = typeof raw.commandString === "string" ? raw.commandString : raw.commandString !== undefined ? JSON.stringify(raw.commandString) : "";
  const sessionID = typeof raw.sessionID === "string" ? raw.sessionID.trim() : "";
  const reasoning = typeof raw.reasoning === "string" && raw.reasoning.trim() || typeof raw.reason === "string" && raw.reason.trim() || undefined;
  const userPrompt = typeof raw.userPrompt === "string" && raw.userPrompt.trim() ? raw.userPrompt.trim() : undefined;
  const riskLevel = typeof raw.risk_level === "string" && raw.risk_level.trim() || typeof raw.riskLevel === "string" && raw.riskLevel.trim() || undefined;
  const userAuthorization = typeof raw.user_authorization === "string" && raw.user_authorization.trim() || typeof raw.userAuthorization === "string" && raw.userAuthorization.trim() || undefined;
  const durationMs = typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs) ? Math.max(0, Math.round(raw.durationMs)) : 0;
  const cascade = normalizeCascadeTrace(raw.cascade);
  return {
    id: `oc-${timestamp}-${index}`,
    timestamp,
    sessionID,
    toolName,
    commandString: commandRaw,
    commandPreview: formatCommandPreview(commandRaw),
    ...userPrompt ? { userPrompt } : {},
    ...reasoning ? { reasoning } : {},
    verdict,
    ...riskLevel ? { riskLevel } : {},
    ...userAuthorization ? { userAuthorization } : {},
    durationMs,
    sourceFormat: "opencode",
    ...cascade ? { cascade } : {}
  };
};
var readRecentEvaluations = (logFilePath, maxBytes = EVAL_TAIL_MAX_BYTES, maxEntries = EVAL_MAX_ENTRIES) => {
  if (!logFilePath || !fs.existsSync(logFilePath))
    return [];
  let fd = null;
  try {
    const stat = fs.statSync(logFilePath);
    if (!stat.isFile() || stat.size <= 0)
      return [];
    const readBytes = Math.min(stat.size, maxBytes);
    const startOffset = stat.size - readBytes;
    const buffer = Buffer.allocUnsafe(readBytes);
    fd = fs.openSync(logFilePath, "r");
    let bytesReadTotal = 0;
    while (bytesReadTotal < readBytes) {
      const n = fs.readSync(fd, buffer, bytesReadTotal, readBytes - bytesReadTotal, startOffset + bytesReadTotal);
      if (n <= 0)
        break;
      bytesReadTotal += n;
    }
    let text = buffer.subarray(0, bytesReadTotal).toString("utf8");
    if (startOffset > 0) {
      const firstNewline = text.indexOf(`
`);
      if (firstNewline === -1)
        return [];
      text = text.slice(firstNewline + 1);
    }
    const lines = text.split(/\r?\n/);
    const normalized = [];
    for (let i = 0;i < lines.length; i += 1) {
      const line = lines[i]?.trim();
      if (!line)
        continue;
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const entry = normalizeEvalLogEntry(parsed, i);
      if (entry)
        normalized.push(entry);
    }
    const sliced = normalized.slice(-maxEntries);
    sliced.reverse();
    return sliced;
  } catch {
    return [];
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
};
var resolveSystemOneHealthUrl = (endpoint) => {
  try {
    return new URL("/health", endpoint).toString();
  } catch {
    return "http://127.0.0.1:4006/health";
  }
};
var defaultSystemOneProbe = async (healthUrl, timeoutMs) => {
  const started = Date.now();
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs)
    });
    const latencyMs = Math.max(0, Date.now() - started);
    return {
      reachable: res.ok,
      statusCode: res.status,
      latencyMs,
      ...!res.ok ? { error: `HTTP ${res.status}` } : {}
    };
  } catch (err) {
    return {
      reachable: false,
      latencyMs: Math.max(0, Date.now() - started),
      error: err instanceof Error ? err.message : String(err)
    };
  }
};

class SystemOneHealthCache {
  probeFn;
  ttlMs;
  timeoutMs;
  cache = new Map;
  constructor(probeFn = defaultSystemOneProbe, ttlMs = SYSTEM_ONE_HEALTH_CACHE_TTL_MS, timeoutMs = SYSTEM_ONE_HEALTH_TIMEOUT_MS) {
    this.probeFn = probeFn;
    this.ttlMs = ttlMs;
    this.timeoutMs = timeoutMs;
  }
  async check(enabled, mode, endpoint, now = Date.now()) {
    const healthUrl = resolveSystemOneHealthUrl(endpoint);
    if (!enabled) {
      return {
        enabled: false,
        mode,
        endpoint,
        healthUrl,
        reachable: false,
        checkedAt: now
      };
    }
    const cached = this.cache.get(healthUrl);
    if (cached && now < cached.expiresAt) {
      return {
        ...cached.state,
        enabled,
        mode,
        endpoint
      };
    }
    const result = await this.probeFn(healthUrl, this.timeoutMs);
    const checkedAt = Date.now();
    const state = {
      enabled,
      mode,
      endpoint,
      healthUrl,
      reachable: result.reachable,
      checkedAt,
      ...result.latencyMs !== undefined ? { latencyMs: result.latencyMs } : {},
      ...result.statusCode !== undefined ? { statusCode: result.statusCode } : {},
      ...result.error ? { error: result.error } : {}
    };
    this.cache.set(healthUrl, { state, expiresAt: checkedAt + this.ttlMs });
    return state;
  }
  clear() {
    this.cache.clear();
  }
}
var computeEvalStats = (entries) => {
  let allow = 0;
  let block = 0;
  let unsure = 0;
  let latencySum = 0;
  let s1FastPathCount = 0;
  for (const entry of entries) {
    if (entry.verdict === "ALLOW")
      allow += 1;
    else if (entry.verdict === "BLOCK")
      block += 1;
    else
      unsure += 1;
    latencySum += entry.durationMs;
    if (entry.cascade?.winner === "system1") {
      s1FastPathCount += 1;
    }
  }
  const total = entries.length;
  const avgLatencyMs = total > 0 ? Math.round(latencySum / total) : 0;
  const s1FastPathPct = total > 0 ? Math.round(s1FastPathCount / total * 100) : 0;
  return {
    total,
    allow,
    block,
    unsure,
    avgLatencyMs,
    s1FastPathCount,
    s1FastPathPct
  };
};
var RECENT_SESSIONS_MAX = 12;
var SESSION_ITEMS_MAX = 8;
var buildRecentSessions = (evaluations, inFlight) => {
  const bySession = new Map;
  const ensureBucket = (sessionID) => {
    let bucket = bySession.get(sessionID);
    if (!bucket) {
      bucket = { evals: [], inFlight: [] };
      bySession.set(sessionID, bucket);
    }
    return bucket;
  };
  for (const entry of evaluations) {
    const sid = entry.sessionID.trim();
    if (!sid)
      continue;
    ensureBucket(sid).evals.push(entry);
  }
  for (const item of inFlight) {
    const sid = item.sessionID.trim();
    if (!sid)
      continue;
    ensureBucket(sid).inFlight.push(item);
  }
  const summaries = [];
  for (const [sessionID, bucket] of bySession.entries()) {
    const sortedEvals = [...bucket.evals].sort((a, b) => b.timestamp - a.timestamp);
    const sortedInFlight = [...bucket.inFlight].sort((a, b) => {
      if (a.awaitingReview !== b.awaitingReview) {
        return a.awaitingReview ? -1 : 1;
      }
      return (b.startedAt ?? 0) - (a.startedAt ?? 0);
    });
    const stats = computeEvalStats(sortedEvals);
    const newestEval = sortedEvals[0];
    const newestInFlight = sortedInFlight[0];
    let maxInFlightAt = 0;
    for (const item of sortedInFlight) {
      if (typeof item.startedAt === "number" && item.startedAt > maxInFlightAt) {
        maxInFlightAt = item.startedAt;
      }
    }
    const latestAt = Math.max(newestEval?.timestamp ?? 0, maxInFlightAt);
    let latestToolName = "permission";
    let latestCommandPreview = "";
    if (newestInFlight && (!newestEval || (newestInFlight.startedAt ?? Number.MAX_SAFE_INTEGER) >= newestEval.timestamp)) {
      latestToolName = newestInFlight.toolName;
      latestCommandPreview = formatCommandPreview(newestInFlight.commandString ?? "") || newestInFlight.toolName;
    } else if (newestEval) {
      latestToolName = newestEval.toolName;
      latestCommandPreview = newestEval.commandPreview || formatCommandPreview(newestEval.commandString) || newestEval.toolName;
    }
    summaries.push({
      sessionID,
      latestAt,
      totalCount: stats.total,
      allowCount: stats.allow,
      blockCount: stats.block,
      unsureCount: stats.unsure,
      avgLatencyMs: stats.avgLatencyMs,
      s1FastPathPct: stats.s1FastPathPct,
      latestVerdict: newestEval?.verdict ?? null,
      latestToolName,
      latestCommandPreview,
      inFlightCount: sortedInFlight.length,
      awaitingReviewCount: sortedInFlight.filter((item) => item.awaitingReview).length,
      inFlight: sortedInFlight.slice(0, SESSION_ITEMS_MAX),
      recentEvaluations: sortedEvals.slice(0, SESSION_ITEMS_MAX)
    });
  }
  summaries.sort((a, b) => {
    const aActive = a.inFlightCount > 0 ? 1 : 0;
    const bActive = b.inFlightCount > 0 ? 1 : 0;
    if (aActive !== bActive)
      return bActive - aActive;
    if (b.latestAt !== a.latestAt)
      return b.latestAt - a.latestAt;
    return a.sessionID.localeCompare(b.sessionID);
  });
  return summaries.slice(0, RECENT_SESSIONS_MAX);
};
var selectMatchingRuntimes = (runtimes, directory) => {
  if (!directory || !directory.trim())
    return [...runtimes];
  const resolvedDir = path.resolve(directory.trim());
  const matched = runtimes.filter((rt) => {
    if (!rt.workspaceRoot)
      return false;
    const rtRoot = path.resolve(rt.workspaceRoot);
    return resolvedDir === rtRoot || resolvedDir.startsWith(rtRoot + path.sep);
  });
  return matched.length > 0 ? matched : [...runtimes];
};
var collectAutoGateSnapshot = async (options = {}) => {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const config = loadSanitizedConfig(env);
  const allRuntimes = loadLiveRuntimes(env, options.pidChecker);
  const relevantRuntimes = selectMatchingRuntimes(allRuntimes, options.directory ?? null);
  const resetAt = readControlResetAt(env);
  const effectiveEvalLogFile = relevantRuntimes.find((rt) => rt.evalLogFile)?.evalLogFile || config.evalLogFile;
  const allEvaluations = readRecentEvaluations(effectiveEvalLogFile);
  const stats = computeEvalStats(allEvaluations);
  const s1Enabled = config.systemOne.enabled || relevantRuntimes.some((rt) => rt.systemOneEnabled);
  const s1Mode = relevantRuntimes.find((rt) => rt.systemOneEnabled)?.systemOneMode ?? config.systemOne.executionMode;
  const healthCache = options.healthCache ?? new SystemOneHealthCache;
  const systemOneHealth = await healthCache.check(s1Enabled, s1Mode, config.systemOne.endpoint, now);
  let consecutiveBlocks = 0;
  let threshold = config.consecutiveBlockThreshold;
  for (const rt of relevantRuntimes) {
    threshold = rt.consecutiveBlockThreshold || threshold;
    const clearedByControl = resetAt !== null && rt.updatedAt > 0 && resetAt >= rt.updatedAt;
    const rtBlocks = clearedByControl ? 0 : rt.consecutiveBlocks;
    if (rtBlocks > consecutiveBlocks)
      consecutiveBlocks = rtBlocks;
  }
  const breaker = {
    consecutiveBlocks,
    threshold,
    tripped: consecutiveBlocks >= threshold,
    resetCircuitBreakerAt: resetAt
  };
  const inFlight = [];
  for (const rt of relevantRuntimes) {
    for (const item of rt.inFlight) {
      inFlight.push(item);
    }
  }
  let filtered = allEvaluations;
  const sessionFilter = options.sessionId?.trim();
  if (sessionFilter) {
    filtered = filtered.filter((e) => e.sessionID === sessionFilter);
  }
  const verdictFilter = options.verdict ? normalizeVerdict(options.verdict) : null;
  if (verdictFilter) {
    filtered = filtered.filter((e) => e.verdict === verdictFilter);
  }
  const q = options.query?.trim().toLowerCase();
  if (q) {
    filtered = filtered.filter((e) => e.toolName.toLowerCase().includes(q) || e.commandPreview.toLowerCase().includes(q) || e.commandString.toLowerCase().includes(q) || (e.reasoning?.toLowerCase().includes(q) ?? false) || (e.userPrompt?.toLowerCase().includes(q) ?? false) || e.sessionID.toLowerCase().includes(q));
  }
  const recentSessions = buildRecentSessions(allEvaluations, inFlight);
  return {
    generatedAt: now,
    config,
    runtimes: relevantRuntimes,
    breaker,
    systemOneHealth,
    inFlight,
    stats,
    evaluations: filtered,
    recentSessions
  };
};
var verdictTone = (verdict) => {
  if (verdict === "ALLOW")
    return "success";
  if (verdict === "BLOCK")
    return "error";
  return "warning";
};
var buildStatusView = (snapshot) => {
  const { config, runtimes, breaker, systemOneHealth, inFlight, stats, evaluations } = snapshot;
  const autoMode = config.autoMode;
  const fallbackMode = config.reviewFallbackMode;
  const liveCount = runtimes.length;
  const rows = [];
  rows.push({
    kind: "line",
    id: "mode",
    label: "Auto Mode",
    dot: autoMode ? "success" : "warning",
    value: autoMode ? "Active" : "Manual",
    valueTone: autoMode ? "success" : "warning",
    badge: {
      label: liveCount > 0 ? `${liveCount} live` : "Config",
      tone: liveCount > 0 ? "info" : "muted"
    },
    actions: [
      {
        kind: "switch",
        id: "toggle-automode",
        label: "Auto Mode",
        checked: autoMode
      }
    ]
  });
  rows.push({
    kind: "line",
    id: "fallback",
    label: "Fallback",
    content: {
      kind: "segmented",
      id: "set-fallback",
      label: "Fallback mode",
      value: fallbackMode,
      options: [
        { value: "ntfy", label: "ntfy" },
        { value: "native", label: "native" }
      ]
    }
  });
  const s1Dot = !systemOneHealth.enabled ? "muted" : systemOneHealth.reachable ? "success" : "error";
  const s1Value = !systemOneHealth.enabled ? "disabled" : systemOneHealth.reachable ? `${systemOneHealth.mode} · reachable` : "unreachable";
  rows.push({
    kind: "line",
    id: "system1",
    label: "System 1",
    dot: s1Dot,
    value: truncateText(s1Value, 80),
    valueTone: s1Dot,
    tooltip: truncateText(systemOneHealth.enabled ? `${systemOneHealth.endpoint} (${systemOneHealth.mode})${systemOneHealth.latencyMs !== undefined ? ` · ${systemOneHealth.latencyMs}ms` : ""}` : `System 1 disabled (${systemOneHealth.endpoint})`, 200)
  });
  const breakerDot = breaker.tripped ? "error" : breaker.consecutiveBlocks > 0 ? "warning" : "success";
  rows.push({
    kind: "line",
    id: "breaker",
    label: "Breaker",
    dot: breakerDot,
    value: `${breaker.consecutiveBlocks}/${breaker.threshold}`,
    valueTone: breaker.consecutiveBlocks > 0 ? breakerDot : "muted",
    ...breaker.consecutiveBlocks > 0 ? {
      actions: [
        {
          kind: "button",
          id: "reset-breaker",
          label: "Reset",
          variant: "outline"
        }
      ]
    } : {}
  });
  if (inFlight.length > 0) {
    const awaitingCount = inFlight.filter((item) => item.awaitingReview).length;
    const firstItem = inFlight[0];
    const summaryText = firstItem ? truncateText(`${firstItem.toolName}${firstItem.commandString ? `: ${firstItem.commandString}` : ""}`, 200) : `${inFlight.length} active`;
    rows.push({
      kind: "line",
      id: "inflight",
      label: "In Flight",
      dot: "warning",
      content: {
        kind: "text",
        text: summaryText || "Awaiting review",
        tone: "warning"
      },
      value: truncateText(awaitingCount > 0 ? `${awaitingCount} awaiting` : `${inFlight.length} active`, 80),
      valueTone: "warning"
    });
  }
  rows.push({
    kind: "line",
    id: "stats",
    label: "Recent",
    ...stats.total > 0 ? {
      content: {
        kind: "text",
        text: truncateText(`avg ${stats.avgLatencyMs}ms · S1 ${stats.s1FastPathPct}%`, 200),
        tone: "muted"
      },
      value: truncateText(`${stats.allow}A · ${stats.block}B · ${stats.unsure}U`, 80),
      valueTone: stats.block > 0 ? "warning" : "muted",
      tooltip: truncateText(`${stats.total} evaluations · ${stats.allow} ALLOW, ${stats.block} BLOCK, ${stats.unsure} UNSURE · ${stats.s1FastPathCount} via System 1`, 200)
    } : {
      value: "No evals",
      valueTone: "muted"
    }
  });
  const recentSlice = evaluations.slice(0, 4);
  for (let i = 0;i < recentSlice.length; i += 1) {
    const item = recentSlice[i];
    if (!item)
      continue;
    const preview = item.commandPreview ? `: ${item.commandPreview}` : "";
    const rowLabel = truncateText(`${item.toolName}${preview}`, 60) || "eval";
    const rowTooltip = item.reasoning ? truncateText(item.reasoning, 200) : "";
    rows.push({
      kind: "line",
      id: `eval-${i}`,
      label: rowLabel,
      dot: verdictTone(item.verdict),
      value: item.durationMs > 0 ? `${item.durationMs}ms` : "<1ms",
      valueTone: item.verdict === "ALLOW" ? "muted" : verdictTone(item.verdict),
      ...rowTooltip ? { tooltip: rowTooltip } : {}
    });
  }
  return {
    rows: rows.slice(0, 16)
  };
};
var computeSessionMarks = (snapshot, previouslyMarkedSessionIds, now = Date.now()) => {
  const prevSet = new Set(previouslyMarkedSessionIds);
  const result = new Map;
  const awaitingSessions = new Set;
  for (const item of snapshot.inFlight) {
    if (item.sessionID && item.awaitingReview) {
      awaitingSessions.add(item.sessionID);
    }
  }
  const latestBySession = new Map;
  const considerVerdict = (sessionID, timestamp, verdict) => {
    if (!sessionID)
      return;
    const prev = latestBySession.get(sessionID);
    if (!prev || timestamp >= prev.timestamp) {
      latestBySession.set(sessionID, { timestamp, verdict });
    }
  };
  for (const entry of snapshot.evaluations) {
    if (entry.sessionID) {
      considerVerdict(entry.sessionID, entry.timestamp, entry.verdict);
    }
  }
  for (const rt of snapshot.runtimes) {
    if (rt.lastVerdict?.sessionID) {
      considerVerdict(rt.lastVerdict.sessionID, rt.lastVerdict.timestamp, rt.lastVerdict.verdict);
    }
  }
  const candidateSessionIds = new Set([
    ...previouslyMarkedSessionIds,
    ...awaitingSessions,
    ...latestBySession.keys()
  ]);
  for (const sessionID of candidateSessionIds) {
    if (!sessionID || sessionID === "default-session")
      continue;
    if (awaitingSessions.has(sessionID)) {
      result.set(sessionID, {
        icon: "shield",
        tone: "warning",
        text: "Awaiting AutoGate review"
      });
      continue;
    }
    const latest = latestBySession.get(sessionID);
    if (latest && now - latest.timestamp <= MARK_STALE_WINDOW_MS) {
      if (latest.verdict === "BLOCK") {
        result.set(sessionID, {
          icon: "close-circle",
          tone: "error",
          text: "Blocked by AutoGate"
        });
        continue;
      }
      if (latest.verdict === "UNSURE") {
        result.set(sessionID, {
          icon: "alert",
          tone: "warning",
          text: "Flagged UNSURE by AutoGate"
        });
        continue;
      }
    }
    if (prevSet.has(sessionID)) {
      result.set(sessionID, null);
    }
  }
  return result;
};

// service/main.ts
var sendJson = (res, status, payload) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};
var readRequestBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  let total = 0;
  req.on("data", (chunk) => {
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
var serializeMark = (mark) => mark === null ? "null" : JSON.stringify({
  icon: mark.icon,
  tone: mark.tone,
  text: mark.text,
  ...mark.url ? { url: mark.url } : {}
});
var createAutoGateServiceServer = (options = {}) => {
  const env = options.env ?? process.env;
  const token = env.OPENCHAMBER_SERVICE_TOKEN ?? "";
  const healthCache = new SystemOneHealthCache(options.probeSystemOne);
  let lazyServiceHost = options.serviceHost ?? null;
  const getServiceHost = () => {
    if (lazyServiceHost)
      return lazyServiceHost;
    try {
      lazyServiceHost = createServiceHost({ env });
      return lazyServiceHost;
    } catch {
      return null;
    }
  };
  const lastMarksBySession = new Map;
  let marksSyncInFlight = false;
  const syncSessionMarks = async () => {
    if (marksSyncInFlight)
      return;
    if (!env.OPENCHAMBER_HOST_CALLBACK_URL && !options.serviceHost)
      return;
    const host = getServiceHost();
    if (!host)
      return;
    marksSyncInFlight = true;
    try {
      const snapshot = await collectAutoGateSnapshot({
        env,
        healthCache,
        pidChecker: options.pidChecker
      });
      const desired = computeSessionMarks(snapshot, lastMarksBySession.keys());
      for (const [sessionId, mark] of desired.entries()) {
        const encoded = serializeMark(mark);
        const prevEncoded = lastMarksBySession.get(sessionId);
        if (encoded === prevEncoded)
          continue;
        try {
          await host.setMark({ sessionId }, mark);
          if (mark === null) {
            lastMarksBySession.delete(sessionId);
          } else {
            lastMarksBySession.set(sessionId, encoded);
          }
        } catch {}
      }
    } catch {} finally {
      marksSyncInFlight = false;
    }
  };
  const handleStatusPost = (event) => {
    if (!event || typeof event.id !== "string") {
      return { status: 400, body: { message: "Missing control id." } };
    }
    if (event.id === "toggle-automode") {
      const current = loadSanitizedConfig(env);
      let nextAutoMode;
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
          body: { message: `Invalid fallback mode: ${String(event.value ?? "")}` }
        };
      }
      const updated = updateConfigFile(env, { reviewFallbackMode: event.value });
      return {
        status: 200,
        body: { ok: true, reviewFallbackMode: updated.reviewFallbackMode }
      };
    }
    if (event.id === "reset-breaker") {
      const resetCircuitBreakerAt = writeControlReset(env);
      return { status: 200, body: { ok: true, resetCircuitBreakerAt } };
    }
    return { status: 404, body: { message: `Unknown AutoGate control: ${event.id}` } };
  };
  const handleApiAction = async (reqBody, directory) => {
    if (!reqBody || typeof reqBody !== "object" || typeof reqBody.action !== "string") {
      return { status: 400, body: { message: "Invalid action payload." } };
    }
    if (reqBody.action === "setAutoMode") {
      if (typeof reqBody.enabled !== "boolean") {
        return { status: 400, body: { message: "enabled must be a boolean." } };
      }
      updateConfigFile(env, { autoMode: reqBody.enabled });
    } else if (reqBody.action === "setFallbackMode") {
      const mode = reqBody.mode;
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
      pidChecker: options.pidChecker
    });
    const response = { ok: true, state };
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
    (async () => {
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
              pidChecker: options.pidChecker
            });
            sendJson(res, 200, buildStatusView(snapshot));
            return;
          }
          if (method === "POST") {
            const rawBody = await readRequestBody(req);
            let event;
            try {
              event = JSON.parse(rawBody || "{}");
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
            pidChecker: options.pidChecker
          });
          sendJson(res, 200, snapshot);
          return;
        }
        if (method === "POST" && pathname === "/api/action") {
          const rawBody = await readRequestBody(req);
          let payload;
          try {
            payload = JSON.parse(rawBody || "{}");
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
      syncSessionMarks();
    }, intervalMs);
    timer.unref?.();
    server.on("close", () => {
      clearInterval(timer);
    });
    syncSessionMarks();
  }
  return server;
};
var isMainEntry = () => {
  const entry = process.argv[1];
  if (!entry)
    return false;
  try {
    return path2.resolve(fileURLToPath(import.meta.url)) === path2.resolve(entry);
  } catch {
    return true;
  }
};
if (process.env.OPENCHAMBER_SERVICE_PORT && isMainEntry()) {
  const port = Number(process.env.OPENCHAMBER_SERVICE_PORT);
  const server = createAutoGateServiceServer({ env: process.env });
  server.listen(port, "127.0.0.1");
}
export {
  createAutoGateServiceServer
};
