import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
  GuestStatusRow,
  GuestStatusTone,
  GuestStatusView,
  ServiceMark,
} from "@openchamber/sdk";
import type {
  AutoGateSessionSummary,
  AutoGateStateSnapshot,
  CircuitBreakerState,
  ClassifierVerdict,
  EvalStatsSummary,
  LiveRuntimeState,
  NormalizedCascadeTrace,
  NormalizedEvalEntry,
  ReviewFallbackMode,
  RuntimeInFlightItem,
  RuntimeLastVerdict,
  SanitizedAutoGateConfig,
  SystemOneExecutionMode,
  SystemOneHealthState,
} from "../shared/types.ts";

export const DEFAULT_SYSTEM_ONE_ENDPOINT = "http://127.0.0.1:4006/v1/systemone";
export const DEFAULT_SYSTEM_ONE_MODEL = "gemini-decision-1";
export const DEFAULT_SYSTEM_ONE_TIMEOUT_MS = 4000;
export const DEFAULT_CLASSIFIER_MODEL = "google/gemini-3.5-flash-lite";
export const DEFAULT_CLASSIFIER_TIMEOUT_MS = 45000;
export const DEFAULT_CONSECUTIVE_BLOCK_THRESHOLD = 3;
export const EVAL_TAIL_MAX_BYTES = 512 * 1024;
export const EVAL_MAX_ENTRIES = 200;
export const SYSTEM_ONE_HEALTH_TIMEOUT_MS = 800;
export const SYSTEM_ONE_HEALTH_CACHE_TTL_MS = 3000;
export const MARK_STALE_WINDOW_MS = 15 * 60 * 1000;

export interface AutoGateEnv {
  [key: string]: string | undefined;
}

export interface AutoGateConfigPaths {
  configPath: string;
  configDir: string;
  runtimeDir: string;
  controlPath: string;
}

export type SystemOneProbeFn = (
  healthUrl: string,
  timeoutMs: number,
) => Promise<{ reachable: boolean; statusCode?: number; latencyMs?: number; error?: string }>;

const isRecord = (val: unknown): val is Record<string, unknown> =>
  typeof val === "object" && val !== null && !Array.isArray(val);

const getHomeDir = (env: AutoGateEnv): string => {
  const envHome = env.HOME?.trim();
  return envHome && envHome.length > 0 ? envHome : os.homedir();
};

export const expandHomePath = (inputPath: string, env: AutoGateEnv = process.env): string => {
  if (inputPath.startsWith("~/")) {
    return path.join(getHomeDir(env), inputPath.slice(2));
  }
  if (inputPath === "~") {
    return getHomeDir(env);
  }
  return inputPath;
};

export const resolveConfigPaths = (env: AutoGateEnv = process.env): AutoGateConfigPaths => {
  const explicitConfig = env.AUTOGATE_CONFIG?.trim();
  let configPath: string;
  let configDir: string;

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
    controlPath: path.join(configDir, "control.json"),
  };
};

const parseBooleanLike = (val: unknown): boolean | undefined => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    const lower = val.toLowerCase().trim();
    if (lower === "true" || lower === "1" || lower === "on") return true;
    if (lower === "false" || lower === "0" || lower === "off") return false;
  }
  return undefined;
};

const parsePositiveNum = (val: unknown, fallback: number): number => {
  if (typeof val === "number" && Number.isFinite(val) && val > 0) return val;
  if (typeof val === "string" && val.trim().length > 0) {
    const parsed = Number(val.trim());
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return fallback;
};

const normalizeFallbackMode = (val: unknown): ReviewFallbackMode | undefined => {
  if (typeof val !== "string") return undefined;
  const lower = val.toLowerCase().trim();
  if (lower === "native" || lower === "terminal" || lower === "desk") return "native";
  if (lower === "ntfy" || lower === "mobile" || lower === "remote") return "ntfy";
  return undefined;
};

const normalizeExecutionMode = (val: unknown): SystemOneExecutionMode =>
  val === "cascade" ? "cascade" : "race";

const normalizeVerdict = (val: unknown): ClassifierVerdict | null => {
  if (typeof val !== "string") return null;
  const upper = val.toUpperCase().trim();
  if (upper === "ALLOW" || upper === "BLOCK" || upper === "UNSURE") {
    return upper;
  }
  return null;
};

const truncateText = (text: string, maxLen: number): string => {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLen) return singleLine;
  if (maxLen <= 1) return singleLine.slice(0, maxLen);
  return `${singleLine.slice(0, maxLen - 1)}…`;
};

const readJsonObjectSafe = (filePath: string): { exists: boolean; data: Record<string, unknown> } => {
  try {
    if (!fs.existsSync(filePath)) {
      return { exists: false, data: {} };
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return { exists: true, data: isRecord(parsed) ? parsed : {} };
  } catch {
    return { exists: false, data: {} };
  }
};

export const loadSanitizedConfig = (env: AutoGateEnv = process.env): SanitizedAutoGateConfig => {
  const paths = resolveConfigPaths(env);
  const { exists, data: raw } = readJsonObjectSafe(paths.configPath);

  const autoMode =
    parseBooleanLike(env.AUTOGATE_AUTO_MODE) ??
    parseBooleanLike(env.OPENCODE_AUTO_MODE) ??
    parseBooleanLike(raw.autoMode) ??
    true;

  const ompObj = isRecord(raw.omp) ? raw.omp : {};
  const reviewFallbackMode =
    normalizeFallbackMode(env.AUTOGATE_FALLBACK) ??
    normalizeFallbackMode(raw.reviewFallbackMode) ??
    normalizeFallbackMode(raw.fallbackMode) ??
    normalizeFallbackMode(ompObj.reviewFallbackMode) ??
    "ntfy";

  const classifierModel =
    (typeof env.CLASSIFIER_MODEL === "string" && env.CLASSIFIER_MODEL.trim()) ||
    (typeof raw.classifierModel === "string" && raw.classifierModel.trim()) ||
    DEFAULT_CLASSIFIER_MODEL;

  const classifierTimeout = parsePositiveNum(
    env.CLASSIFIER_TIMEOUT ?? raw.classifierTimeout,
    DEFAULT_CLASSIFIER_TIMEOUT_MS,
  );

  const consecutiveBlockThreshold = Math.max(
    1,
    Math.floor(
      parsePositiveNum(
        env.CONSECUTIVE_BLOCK_THRESHOLD ?? raw.consecutiveBlockThreshold,
        DEFAULT_CONSECUTIVE_BLOCK_THRESHOLD,
      ),
    ),
  );

  const notifyOnVerdict =
    parseBooleanLike(env.AUTOGATE_NOTIFY_ON_VERDICT) ??
    parseBooleanLike(raw.notifyOnVerdict) ??
    true;

  const rawNtfyServer =
    (typeof env.NTFY_SERVER === "string" && env.NTFY_SERVER.trim()) ||
    (typeof raw.ntfyServer === "string" && raw.ntfyServer.trim()) ||
    "https://ntfy.sh";
  let ntfyServer = "https://ntfy.sh";
  try {
    ntfyServer = new URL(rawNtfyServer).toString().replace(/\/$/, "");
  } catch {
    ntfyServer = "https://ntfy.sh";
  }

  const ntfyTopic =
    (typeof env.AUTOGATE_NTFY_TOPIC === "string" && env.AUTOGATE_NTFY_TOPIC.trim()) ||
    (typeof env.NTFY_TOPIC === "string" && env.NTFY_TOPIC.trim()) ||
    (typeof raw.ntfyTopic === "string" && raw.ntfyTopic.trim()) ||
    "autogate";

  const hasNtfyToken = Boolean(
    (typeof env.NTFY_TOKEN === "string" && env.NTFY_TOKEN.trim()) ||
      (typeof env.AUTOGATE_NTFY_TOKEN === "string" && env.AUTOGATE_NTFY_TOKEN.trim()) ||
      (typeof raw.ntfyToken === "string" && raw.ntfyToken.trim()),
  );

  const rawEvalLog =
    (typeof env.AUTOGATE_EVAL_LOG === "string" && env.AUTOGATE_EVAL_LOG.trim()) ||
    (typeof raw.evalLogFile === "string" && raw.evalLogFile.trim()) ||
    (typeof ompObj.evalLogFile === "string" && ompObj.evalLogFile.trim()) ||
    "";
  const evalLogFile = rawEvalLog
    ? path.resolve(expandHomePath(rawEvalLog, env))
    : path.join(getHomeDir(env), ".omp", "logs", "autogate-evals.jsonl");

  const rawS1 = isRecord(raw.systemOne) ? raw.systemOne : {};
  const s1Enabled =
    parseBooleanLike(env.AUTOGATE_SYSTEM_ONE_ENABLED) ??
    parseBooleanLike(rawS1.enabled) ??
    false;
  const s1Mode = normalizeExecutionMode(env.AUTOGATE_SYSTEM_ONE_MODE ?? rawS1.executionMode);
  const s1Endpoint =
    (typeof env.AUTOGATE_SYSTEM_ONE_ENDPOINT === "string" && env.AUTOGATE_SYSTEM_ONE_ENDPOINT.trim()) ||
    (typeof rawS1.endpoint === "string" && rawS1.endpoint.trim()) ||
    DEFAULT_SYSTEM_ONE_ENDPOINT;
  const s1Model =
    (typeof env.AUTOGATE_SYSTEM_ONE_MODEL === "string" && env.AUTOGATE_SYSTEM_ONE_MODEL.trim()) ||
    (typeof rawS1.model === "string" && rawS1.model.trim()) ||
    DEFAULT_SYSTEM_ONE_MODEL;
  const s1Timeout = parsePositiveNum(
    env.AUTOGATE_SYSTEM_ONE_TIMEOUT_MS ?? rawS1.timeoutMs,
    DEFAULT_SYSTEM_ONE_TIMEOUT_MS,
  );
  const hasApiKey = Boolean(
    (typeof env.AUTOGATE_SYSTEM_ONE_API_KEY === "string" && env.AUTOGATE_SYSTEM_ONE_API_KEY.trim()) ||
      (typeof rawS1.apiKey === "string" && rawS1.apiKey.trim()),
  );

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
      hasApiKey,
    },
  };
};

export const atomicWriteJson = (filePath: string, payload: unknown): void => {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  );
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
      }
    } catch {
      // Ignore temp cleanup error
    }
    throw err;
  }
};

export const updateConfigFile = (
  env: AutoGateEnv,
  patch: Partial<{ autoMode: boolean; reviewFallbackMode: ReviewFallbackMode }>,
): SanitizedAutoGateConfig => {
  const paths = resolveConfigPaths(env);
  let existing: Record<string, unknown> = {};
  if (fs.existsSync(paths.configPath)) {
    const rawText = fs.readFileSync(paths.configPath, "utf8").trim();
    if (rawText.length > 0) {
      const parsed: unknown = JSON.parse(rawText);
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

export const readControlResetAt = (env: AutoGateEnv = process.env): number | null => {
  const paths = resolveConfigPaths(env);
  const { exists, data } = readJsonObjectSafe(paths.controlPath);
  if (!exists) return null;
  const ts = data.resetCircuitBreakerAt;
  return typeof ts === "number" && Number.isFinite(ts) && ts > 0 ? ts : null;
};

export const writeControlReset = (
  env: AutoGateEnv = process.env,
  timestamp: number = Date.now(),
): number => {
  const paths = resolveConfigPaths(env);
  const { exists, data } = readJsonObjectSafe(paths.controlPath);
  const next: Record<string, unknown> = exists ? { ...data } : {};
  next.resetCircuitBreakerAt = timestamp;
  atomicWriteJson(paths.controlPath, next);
  return timestamp;
};

export const isPidAlive = (pid: unknown): pid is number => {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    return code === "EPERM";
  }
};

const normalizeInFlightItem = (
  raw: unknown,
  idx: number,
  defaultWorkspaceRoot: string,
): RuntimeInFlightItem | null => {
  if (!isRecord(raw)) return null;
  const id =
    (typeof raw.id === "string" && raw.id.trim()) ||
    (typeof raw.requestID === "string" && raw.requestID.trim()) ||
    `inflight-${idx}`;
  const sessionID =
    (typeof raw.sessionID === "string" && raw.sessionID.trim()) ||
    (typeof raw.sessionId === "string" && raw.sessionId.trim()) ||
    "";
  const toolName =
    (typeof raw.toolName === "string" && raw.toolName.trim()) ||
    (typeof raw.action === "string" && raw.action.trim()) ||
    "permission";
  const commandString =
    typeof raw.commandString === "string" && raw.commandString.trim()
      ? raw.commandString.trim()
      : typeof raw.command === "string" && raw.command.trim()
        ? raw.command.trim()
        : undefined;
  const workspaceRoot =
    typeof raw.workspaceRoot === "string" && raw.workspaceRoot.trim()
      ? raw.workspaceRoot.trim()
      : typeof raw.directory === "string" && raw.directory.trim()
        ? raw.directory.trim()
        : defaultWorkspaceRoot;
  const reason = typeof raw.reason === "string" && raw.reason.trim() ? raw.reason.trim() : undefined;
  const stage = typeof raw.stage === "string" && raw.stage.trim() ? raw.stage.trim() : undefined;
  const status =
    (typeof raw.status === "string" && raw.status.trim() ? raw.status.trim() : undefined) ?? stage;
  const awaitingReview =
    typeof raw.awaitingReview === "boolean"
      ? raw.awaitingReview
      : stage === "evaluating" || status === "evaluating" || status === "classifying"
        ? false
        : true;
  const startedAt =
    typeof raw.startedAt === "number" && Number.isFinite(raw.startedAt)
      ? raw.startedAt
      : undefined;

  return {
    id,
    sessionID,
    toolName,
    ...(commandString ? { commandString } : {}),
    ...(workspaceRoot ? { workspaceRoot } : {}),
    ...(reason ? { reason } : {}),
    awaitingReview,
    ...(status ? { status } : {}),
    ...(startedAt !== undefined ? { startedAt } : {}),
  };
};

const normalizeRuntimeLastVerdict = (raw: unknown): RuntimeLastVerdict | null => {
  if (!isRecord(raw)) return null;
  const verdict = normalizeVerdict(raw.verdict);
  if (!verdict) return null;
  const timestamp =
    typeof raw.timestamp === "number" && Number.isFinite(raw.timestamp)
      ? raw.timestamp
      : typeof raw.timestamp === "string" && Number.isFinite(Date.parse(raw.timestamp))
        ? Date.parse(raw.timestamp)
        : Date.now();
  return {
    timestamp,
    ...(typeof raw.sessionID === "string" && raw.sessionID.trim()
      ? { sessionID: raw.sessionID.trim() }
      : {}),
    ...(typeof raw.toolName === "string" && raw.toolName.trim()
      ? { toolName: raw.toolName.trim() }
      : {}),
    ...(typeof raw.commandString === "string" && raw.commandString.trim()
      ? { commandString: raw.commandString.trim() }
      : {}),
    verdict,
    ...(typeof raw.reason === "string" && raw.reason.trim()
      ? { reason: raw.reason.trim() }
      : {}),
    ...(typeof raw.riskLevel === "string" && raw.riskLevel.trim()
      ? { riskLevel: raw.riskLevel.trim() }
      : typeof raw.risk_level === "string" && raw.risk_level.trim()
        ? { riskLevel: raw.risk_level.trim() }
        : {}),
    ...(typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs)
      ? { durationMs: raw.durationMs }
      : {}),
  };
};

export const loadLiveRuntimes = (
  env: AutoGateEnv = process.env,
  pidChecker: (pid: unknown) => boolean = isPidAlive,
): LiveRuntimeState[] => {
  const paths = resolveConfigPaths(env);
  if (!fs.existsSync(paths.runtimeDir)) return [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(paths.runtimeDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const runtimes: LiveRuntimeState[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(paths.runtimeDir, entry.name);
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      continue;
    }
    if (!isRecord(parsed) || !pidChecker(parsed.pid)) continue;
    const pid = parsed.pid as number;

    const workspaceRoot =
      typeof parsed.workspaceRoot === "string" ? parsed.workspaceRoot.trim() : "";
    const inFlightRaw = Array.isArray(parsed.inFlight) ? parsed.inFlight : [];
    const inFlight: RuntimeInFlightItem[] = [];
    for (let i = 0; i < inFlightRaw.length; i += 1) {
      const item = normalizeInFlightItem(inFlightRaw[i], i, workspaceRoot);
      if (item) inFlight.push(item);
    }

    const consecutiveBlocks =
      typeof parsed.consecutiveBlocks === "number" &&
      Number.isFinite(parsed.consecutiveBlocks) &&
      parsed.consecutiveBlocks >= 0
        ? Math.floor(parsed.consecutiveBlocks)
        : 0;
    const consecutiveBlockThreshold = Math.max(
      1,
      Math.floor(
        parsePositiveNum(parsed.consecutiveBlockThreshold, DEFAULT_CONSECUTIVE_BLOCK_THRESHOLD),
      ),
    );

    runtimes.push({
      version: typeof parsed.version === "number" ? parsed.version : 1,
      pid,
      workspaceRoot,
      startedAt:
        typeof parsed.startedAt === "number" && Number.isFinite(parsed.startedAt)
          ? parsed.startedAt
          : 0,
      updatedAt:
        typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : 0,
      autoMode: typeof parsed.autoMode === "boolean" ? parsed.autoMode : true,
      reviewFallbackMode: normalizeFallbackMode(parsed.reviewFallbackMode) ?? "ntfy",
      remoteReviewEnabled:
        typeof parsed.remoteReviewEnabled === "boolean" ? parsed.remoteReviewEnabled : true,
      consecutiveBlocks,
      consecutiveBlockThreshold,
      classifierModel:
        typeof parsed.classifierModel === "string" && parsed.classifierModel.trim()
          ? parsed.classifierModel.trim()
          : DEFAULT_CLASSIFIER_MODEL,
      systemOneEnabled:
        typeof parsed.systemOneEnabled === "boolean" ? parsed.systemOneEnabled : false,
      systemOneMode: normalizeExecutionMode(parsed.systemOneMode),
      evalLogFile:
        typeof parsed.evalLogFile === "string" && parsed.evalLogFile.trim()
          ? path.resolve(expandHomePath(parsed.evalLogFile.trim(), env))
          : "",
      inFlight,
      lastVerdict: normalizeRuntimeLastVerdict(parsed.lastVerdict),
    });
  }

  runtimes.sort((a, b) => b.updatedAt - a.updatedAt);
  return runtimes;
};

const formatCommandPreview = (rawCommand: string): string => {
  const trimmed = rawCommand.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        const parts = parsed
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim());
        if (parts.length > 0) {
          return parts.join(" && ").replace(/\s+/g, " ");
        }
      }
    } catch {
      // Keep raw text when not valid JSON array
    }
  }
  return trimmed.replace(/\s+/g, " ");
};

const normalizeCascadeTrace = (raw: unknown): NormalizedCascadeTrace | undefined => {
  if (!isRecord(raw)) return undefined;
  const trace: NormalizedCascadeTrace = {};
  if (typeof raw.mode === "string" && raw.mode.trim()) trace.mode = raw.mode.trim();
  if (raw.winner === "system1" || raw.winner === "system2") trace.winner = raw.winner;
  if (typeof raw.escalationReason === "string" && raw.escalationReason.trim()) {
    trace.escalationReason = raw.escalationReason.trim();
  }
  if (typeof raw.s1LatencyMs === "number" && Number.isFinite(raw.s1LatencyMs)) {
    trace.s1LatencyMs = raw.s1LatencyMs;
  }
  if (typeof raw.s2LatencyMs === "number" && Number.isFinite(raw.s2LatencyMs)) {
    trace.s2LatencyMs = raw.s2LatencyMs;
  }
  if (typeof raw.s2Aborted === "boolean") trace.s2Aborted = raw.s2Aborted;
  if (isRecord(raw.s1Probs)) {
    const probs: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw.s1Probs)) {
      if (typeof v === "number" && Number.isFinite(v)) probs[k] = v;
    }
    if (Object.keys(probs).length > 0) trace.s1Probs = probs;
  }
  if (typeof raw.inScopeScore === "number" && Number.isFinite(raw.inScopeScore)) {
    trace.inScopeScore = raw.inScopeScore;
  }
  if (typeof raw.injectionScore === "number" && Number.isFinite(raw.injectionScore)) {
    trace.injectionScore = raw.injectionScore;
  }
  return Object.keys(trace).length > 0 ? trace : undefined;
};

const parseTimestampMs = (raw: unknown): number | null => {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim().length > 0) {
    const num = Number(raw.trim());
    if (Number.isFinite(num) && num > 0) return num;
    const parsed = Date.parse(raw.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export const normalizeEvalLogEntry = (raw: unknown, index: number): NormalizedEvalEntry | null => {
  if (!isRecord(raw)) return null;

  const isOmp = isRecord(raw.action) || isRecord(raw.decision);
  const timestamp = parseTimestampMs(raw.timestamp) ?? 0;

  if (isOmp) {
    const action = isRecord(raw.action) ? raw.action : {};
    const decision = isRecord(raw.decision) ? raw.decision : {};
    const inference = isRecord(raw.inference) ? raw.inference : {};
    const modelObj = isRecord(raw.model) ? raw.model : {};

    const verdict = normalizeVerdict(decision.verdict ?? raw.verdict);
    if (!verdict) return null;

    const toolName =
      (typeof action.toolName === "string" && action.toolName.trim()) ||
      (typeof raw.toolName === "string" && raw.toolName.trim()) ||
      "tool";
    const commandRaw =
      (typeof action.command === "string" && action.command) ||
      (typeof action.targetPath === "string" && action.targetPath) ||
      (typeof raw.commandString === "string" && raw.commandString) ||
      "";
    const sessionID =
      (typeof action.sessionID === "string" && action.sessionID.trim()) ||
      (typeof raw.sessionID === "string" && raw.sessionID.trim()) ||
      "";
    const reasoning =
      (typeof decision.reason === "string" && decision.reason.trim()) ||
      (typeof inference.thinking === "string" && inference.thinking.trim()) ||
      (typeof raw.error === "string" && raw.error.trim()) ||
      undefined;
    const riskLevel =
      (typeof decision.riskLevel === "string" && decision.riskLevel.trim()) ||
      (typeof decision.risk_level === "string" && decision.risk_level.trim()) ||
      undefined;
    const userAuthorization =
      (typeof decision.userAuthorization === "string" && decision.userAuthorization.trim()) ||
      (typeof decision.user_authorization === "string" && decision.user_authorization.trim()) ||
      undefined;
    const durationMs =
      typeof inference.durationMs === "number" && Number.isFinite(inference.durationMs)
        ? Math.max(0, Math.round(inference.durationMs))
        : 0;
    const modelId = typeof modelObj.id === "string" ? modelObj.id.trim() : "";
    const modelProvider = typeof modelObj.provider === "string" ? modelObj.provider.trim() : "";
    const model = modelId
      ? modelProvider
        ? `${modelProvider}/${modelId}`
        : modelId
      : undefined;
    const id =
      (typeof action.id === "string" && action.id.trim()) ||
      `omp-${timestamp}-${index}`;

    return {
      id,
      timestamp,
      sessionID,
      toolName,
      commandString: commandRaw,
      commandPreview: formatCommandPreview(commandRaw),
      ...(typeof raw.userPrompt === "string" && raw.userPrompt.trim()
        ? { userPrompt: raw.userPrompt.trim() }
        : {}),
      ...(reasoning ? { reasoning } : {}),
      verdict,
      ...(riskLevel ? { riskLevel } : {}),
      ...(userAuthorization ? { userAuthorization } : {}),
      durationMs,
      sourceFormat: "omp",
      ...(model ? { model } : {}),
      ...(normalizeCascadeTrace(raw.cascade) ? { cascade: normalizeCascadeTrace(raw.cascade) } : {}),
    };
  }

  // OpenCode flat JSONL format
  const verdict = normalizeVerdict(raw.verdict);
  if (!verdict) return null;

  const toolName =
    (typeof raw.toolName === "string" && raw.toolName.trim()) || "permission";
  const commandRaw =
    typeof raw.commandString === "string"
      ? raw.commandString
      : raw.commandString !== undefined
        ? JSON.stringify(raw.commandString)
        : "";
  const sessionID = typeof raw.sessionID === "string" ? raw.sessionID.trim() : "";
  const reasoning =
    (typeof raw.reasoning === "string" && raw.reasoning.trim()) ||
    (typeof raw.reason === "string" && raw.reason.trim()) ||
    undefined;
  const userPrompt =
    typeof raw.userPrompt === "string" && raw.userPrompt.trim()
      ? raw.userPrompt.trim()
      : undefined;
  const riskLevel =
    (typeof raw.risk_level === "string" && raw.risk_level.trim()) ||
    (typeof raw.riskLevel === "string" && raw.riskLevel.trim()) ||
    undefined;
  const userAuthorization =
    (typeof raw.user_authorization === "string" && raw.user_authorization.trim()) ||
    (typeof raw.userAuthorization === "string" && raw.userAuthorization.trim()) ||
    undefined;
  const durationMs =
    typeof raw.durationMs === "number" && Number.isFinite(raw.durationMs)
      ? Math.max(0, Math.round(raw.durationMs))
      : 0;
  const cascade = normalizeCascadeTrace(raw.cascade);

  return {
    id: `oc-${timestamp}-${index}`,
    timestamp,
    sessionID,
    toolName,
    commandString: commandRaw,
    commandPreview: formatCommandPreview(commandRaw),
    ...(userPrompt ? { userPrompt } : {}),
    ...(reasoning ? { reasoning } : {}),
    verdict,
    ...(riskLevel ? { riskLevel } : {}),
    ...(userAuthorization ? { userAuthorization } : {}),
    durationMs,
    sourceFormat: "opencode",
    ...(cascade ? { cascade } : {}),
  };
};

export const readRecentEvaluations = (
  logFilePath: string,
  maxBytes: number = EVAL_TAIL_MAX_BYTES,
  maxEntries: number = EVAL_MAX_ENTRIES,
): NormalizedEvalEntry[] => {
  if (!logFilePath || !fs.existsSync(logFilePath)) return [];

  let fd: number | null = null;
  try {
    const stat = fs.statSync(logFilePath);
    if (!stat.isFile() || stat.size <= 0) return [];

    const readBytes = Math.min(stat.size, maxBytes);
    const startOffset = stat.size - readBytes;
    const buffer = Buffer.allocUnsafe(readBytes);

    fd = fs.openSync(logFilePath, "r");
    let bytesReadTotal = 0;
    while (bytesReadTotal < readBytes) {
      const n = fs.readSync(fd, buffer, bytesReadTotal, readBytes - bytesReadTotal, startOffset + bytesReadTotal);
      if (n <= 0) break;
      bytesReadTotal += n;
    }

    let text = buffer.subarray(0, bytesReadTotal).toString("utf8");
    if (startOffset > 0) {
      const firstNewline = text.indexOf("\n");
      if (firstNewline === -1) return [];
      text = text.slice(firstNewline + 1);
    }

    const lines = text.split(/\r?\n/);
    const normalized: NormalizedEvalEntry[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]?.trim();
      if (!line) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const entry = normalizeEvalLogEntry(parsed, i);
      if (entry) normalized.push(entry);
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
      } catch {
        // Ignore close errors
      }
    }
  }
};

export const resolveSystemOneHealthUrl = (endpoint: string): string => {
  try {
    return new URL("/health", endpoint).toString();
  } catch {
    return "http://127.0.0.1:4006/health";
  }
};

export const defaultSystemOneProbe: SystemOneProbeFn = async (healthUrl, timeoutMs) => {
  const started = Date.now();
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Math.max(0, Date.now() - started);
    return {
      reachable: res.ok,
      statusCode: res.status,
      latencyMs,
      ...(!res.ok ? { error: `HTTP ${res.status}` } : {}),
    };
  } catch (err) {
    return {
      reachable: false,
      latencyMs: Math.max(0, Date.now() - started),
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

export class SystemOneHealthCache {
  private cache = new Map<string, { state: SystemOneHealthState; expiresAt: number }>();

  constructor(
    private readonly probeFn: SystemOneProbeFn = defaultSystemOneProbe,
    private readonly ttlMs: number = SYSTEM_ONE_HEALTH_CACHE_TTL_MS,
    private readonly timeoutMs: number = SYSTEM_ONE_HEALTH_TIMEOUT_MS,
  ) {}

  async check(
    enabled: boolean,
    mode: SystemOneExecutionMode,
    endpoint: string,
    now: number = Date.now(),
  ): Promise<SystemOneHealthState> {
    const healthUrl = resolveSystemOneHealthUrl(endpoint);
    if (!enabled) {
      return {
        enabled: false,
        mode,
        endpoint,
        healthUrl,
        reachable: false,
        checkedAt: now,
      };
    }

    const cached = this.cache.get(healthUrl);
    if (cached && now < cached.expiresAt) {
      return {
        ...cached.state,
        enabled,
        mode,
        endpoint,
      };
    }

    const result = await this.probeFn(healthUrl, this.timeoutMs);
    const checkedAt = Date.now();
    const state: SystemOneHealthState = {
      enabled,
      mode,
      endpoint,
      healthUrl,
      reachable: result.reachable,
      checkedAt,
      ...(result.latencyMs !== undefined ? { latencyMs: result.latencyMs } : {}),
      ...(result.statusCode !== undefined ? { statusCode: result.statusCode } : {}),
      ...(result.error ? { error: result.error } : {}),
    };
    this.cache.set(healthUrl, { state, expiresAt: checkedAt + this.ttlMs });
    return state;
  }

  clear(): void {
    this.cache.clear();
  }
}

export const computeEvalStats = (entries: readonly NormalizedEvalEntry[]): EvalStatsSummary => {
  let allow = 0;
  let block = 0;
  let unsure = 0;
  let latencySum = 0;
  let s1FastPathCount = 0;

  for (const entry of entries) {
    if (entry.verdict === "ALLOW") allow += 1;
    else if (entry.verdict === "BLOCK") block += 1;
    else unsure += 1;

    latencySum += entry.durationMs;
    if (entry.cascade?.winner === "system1") {
      s1FastPathCount += 1;
    }
  }

  const total = entries.length;
  const avgLatencyMs = total > 0 ? Math.round(latencySum / total) : 0;
  const s1FastPathPct = total > 0 ? Math.round((s1FastPathCount / total) * 100) : 0;

  return {
    total,
    allow,
    block,
    unsure,
    avgLatencyMs,
    s1FastPathCount,
    s1FastPathPct,
  };
};

export const RECENT_SESSIONS_MAX = 12;
export const SESSION_ITEMS_MAX = 8;

export const buildRecentSessions = (
  evaluations: readonly NormalizedEvalEntry[],
  inFlight: readonly RuntimeInFlightItem[],
): AutoGateSessionSummary[] => {
  const bySession = new Map<
    string,
    { evals: NormalizedEvalEntry[]; inFlight: RuntimeInFlightItem[] }
  >();

  const ensureBucket = (sessionID: string) => {
    let bucket = bySession.get(sessionID);
    if (!bucket) {
      bucket = { evals: [], inFlight: [] };
      bySession.set(sessionID, bucket);
    }
    return bucket;
  };

  for (const entry of evaluations) {
    const sid = entry.sessionID.trim();
    if (!sid) continue;
    ensureBucket(sid).evals.push(entry);
  }

  for (const item of inFlight) {
    const sid = item.sessionID.trim();
    if (!sid) continue;
    ensureBucket(sid).inFlight.push(item);
  }

  const summaries: AutoGateSessionSummary[] = [];
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
    if (
      newestInFlight &&
      (!newestEval || (newestInFlight.startedAt ?? Number.MAX_SAFE_INTEGER) >= newestEval.timestamp)
    ) {
      latestToolName = newestInFlight.toolName;
      latestCommandPreview =
        formatCommandPreview(newestInFlight.commandString ?? "") || newestInFlight.toolName;
    } else if (newestEval) {
      latestToolName = newestEval.toolName;
      latestCommandPreview =
        newestEval.commandPreview ||
        formatCommandPreview(newestEval.commandString) ||
        newestEval.toolName;
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
      recentEvaluations: sortedEvals.slice(0, SESSION_ITEMS_MAX),
    });
  }

  summaries.sort((a, b) => {
    const aActive = a.inFlightCount > 0 ? 1 : 0;
    const bActive = b.inFlightCount > 0 ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    if (b.latestAt !== a.latestAt) return b.latestAt - a.latestAt;
    return a.sessionID.localeCompare(b.sessionID);
  });

  return summaries.slice(0, RECENT_SESSIONS_MAX);
};

const selectMatchingRuntimes = (
  runtimes: readonly LiveRuntimeState[],
  directory: string | null,
): LiveRuntimeState[] => {
  if (!directory || !directory.trim()) return [...runtimes];
  const resolvedDir = path.resolve(directory.trim());
  const matched = runtimes.filter((rt) => {
    if (!rt.workspaceRoot) return false;
    const rtRoot = path.resolve(rt.workspaceRoot);
    return resolvedDir === rtRoot || resolvedDir.startsWith(rtRoot + path.sep);
  });
  return matched.length > 0 ? matched : [...runtimes];
};

export interface BuildSnapshotOptions {
  env?: AutoGateEnv;
  directory?: string | null;
  sessionId?: string | null;
  verdict?: string | null;
  query?: string | null;
  healthCache?: SystemOneHealthCache;
  pidChecker?: (pid: unknown) => boolean;
  now?: number;
}

export const collectAutoGateSnapshot = async (
  options: BuildSnapshotOptions = {},
): Promise<AutoGateStateSnapshot> => {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now();
  const config = loadSanitizedConfig(env);
  const allRuntimes = loadLiveRuntimes(env, options.pidChecker);
  const relevantRuntimes = selectMatchingRuntimes(allRuntimes, options.directory ?? null);
  const resetAt = readControlResetAt(env);

  const effectiveEvalLogFile =
    relevantRuntimes.find((rt) => rt.evalLogFile)?.evalLogFile || config.evalLogFile;
  const allEvaluations = readRecentEvaluations(effectiveEvalLogFile);
  const stats = computeEvalStats(allEvaluations);

  const s1Enabled =
    config.systemOne.enabled || relevantRuntimes.some((rt) => rt.systemOneEnabled);
  const s1Mode =
    relevantRuntimes.find((rt) => rt.systemOneEnabled)?.systemOneMode ??
    config.systemOne.executionMode;

  const healthCache = options.healthCache ?? new SystemOneHealthCache();
  const systemOneHealth = await healthCache.check(
    s1Enabled,
    s1Mode,
    config.systemOne.endpoint,
    now,
  );

  let consecutiveBlocks = 0;
  let threshold = config.consecutiveBlockThreshold;
  for (const rt of relevantRuntimes) {
    threshold = rt.consecutiveBlockThreshold || threshold;
    const clearedByControl = resetAt !== null && rt.updatedAt > 0 && resetAt >= rt.updatedAt;
    const rtBlocks = clearedByControl ? 0 : rt.consecutiveBlocks;
    if (rtBlocks > consecutiveBlocks) consecutiveBlocks = rtBlocks;
  }

  const breaker: CircuitBreakerState = {
    consecutiveBlocks,
    threshold,
    tripped: consecutiveBlocks >= threshold,
    resetCircuitBreakerAt: resetAt,
  };

  const inFlight: RuntimeInFlightItem[] = [];
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
    filtered = filtered.filter(
      (e) =>
        e.toolName.toLowerCase().includes(q) ||
        e.commandPreview.toLowerCase().includes(q) ||
        e.commandString.toLowerCase().includes(q) ||
        (e.reasoning?.toLowerCase().includes(q) ?? false) ||
        (e.userPrompt?.toLowerCase().includes(q) ?? false) ||
        e.sessionID.toLowerCase().includes(q),
    );
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
    recentSessions,
  };
};

const verdictTone = (verdict: ClassifierVerdict): GuestStatusTone => {
  if (verdict === "ALLOW") return "success";
  if (verdict === "BLOCK") return "error";
  return "warning";
};

export const buildStatusView = (snapshot: AutoGateStateSnapshot): GuestStatusView => {
  const { config, runtimes, breaker, systemOneHealth, inFlight, stats, evaluations } = snapshot;

  const autoMode = config.autoMode;
  const fallbackMode = config.reviewFallbackMode;
  const liveCount = runtimes.length;

  const rows: GuestStatusRow[] = [];

  rows.push({
    kind: "line",
    id: "mode",
    label: "Auto Mode",
    dot: autoMode ? "success" : "warning",
    value: autoMode ? "Active" : "Manual",
    valueTone: autoMode ? "success" : "warning",
    badge: {
      label: liveCount > 0 ? `${liveCount} live` : "Config",
      tone: liveCount > 0 ? "info" : "muted",
    },
    actions: [
      {
        kind: "switch",
        id: "toggle-automode",
        label: "Auto Mode",
        checked: autoMode,
      },
    ],
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
        { value: "native", label: "native" },
      ],
    },
  });

  const s1Dot: GuestStatusTone = !systemOneHealth.enabled
    ? "muted"
    : systemOneHealth.reachable
      ? "success"
      : "error";
  const s1Value = !systemOneHealth.enabled
    ? "disabled"
    : systemOneHealth.reachable
      ? `${systemOneHealth.mode} · reachable`
      : "unreachable";

  rows.push({
    kind: "line",
    id: "system1",
    label: "System 1",
    dot: s1Dot,
    value: truncateText(s1Value, 80),
    valueTone: s1Dot,
    tooltip: truncateText(
      systemOneHealth.enabled
        ? `${systemOneHealth.endpoint} (${systemOneHealth.mode})${systemOneHealth.latencyMs !== undefined ? ` · ${systemOneHealth.latencyMs}ms` : ""}`
        : `System 1 disabled (${systemOneHealth.endpoint})`,
      200,
    ),
  });

  const breakerDot: GuestStatusTone = breaker.tripped
    ? "error"
    : breaker.consecutiveBlocks > 0
      ? "warning"
      : "success";

  rows.push({
    kind: "line",
    id: "breaker",
    label: "Breaker",
    dot: breakerDot,
    value: `${breaker.consecutiveBlocks}/${breaker.threshold}`,
    valueTone: breaker.consecutiveBlocks > 0 ? breakerDot : "muted",
    ...(breaker.consecutiveBlocks > 0
      ? {
          actions: [
            {
              kind: "button",
              id: "reset-breaker",
              label: "Reset",
              variant: "outline",
            },
          ],
        }
      : {}),
  });

  if (inFlight.length > 0) {
    const awaitingCount = inFlight.filter((item) => item.awaitingReview).length;
    const firstItem = inFlight[0];
    const summaryText = firstItem
      ? truncateText(
          `${firstItem.toolName}${firstItem.commandString ? `: ${firstItem.commandString}` : ""}`,
          200,
        )
      : `${inFlight.length} active`;
    rows.push({
      kind: "line",
      id: "inflight",
      label: "In Flight",
      dot: "warning",
      content: {
        kind: "text",
        text: summaryText || "Awaiting review",
        tone: "warning",
      },
      value: truncateText(
        awaitingCount > 0 ? `${awaitingCount} awaiting` : `${inFlight.length} active`,
        80,
      ),
      valueTone: "warning",
    });
  }

  rows.push({
    kind: "line",
    id: "stats",
    label: "Recent",
    ...(stats.total > 0
      ? {
          content: {
            kind: "text",
            text: truncateText(`avg ${stats.avgLatencyMs}ms · S1 ${stats.s1FastPathPct}%`, 200),
            tone: "muted",
          },
          value: truncateText(`${stats.allow}A · ${stats.block}B · ${stats.unsure}U`, 80),
          valueTone: stats.block > 0 ? "warning" : "muted",
          tooltip: truncateText(
            `${stats.total} evaluations · ${stats.allow} ALLOW, ${stats.block} BLOCK, ${stats.unsure} UNSURE · ${stats.s1FastPathCount} via System 1`,
            200,
          ),
        }
      : {
          value: "No evals",
          valueTone: "muted",
        }),
  });

  const recentSlice = evaluations.slice(0, 4);
  for (let i = 0; i < recentSlice.length; i += 1) {
    const item = recentSlice[i];
    if (!item) continue;
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
      ...(rowTooltip ? { tooltip: rowTooltip } : {}),
    });
  }

  return {
    rows: rows.slice(0, 16),
  };
};

export const computeSessionMarks = (
  snapshot: AutoGateStateSnapshot,
  previouslyMarkedSessionIds: Iterable<string>,
  now: number = Date.now(),
): Map<string, ServiceMark | null> => {
  const prevSet = new Set(previouslyMarkedSessionIds);
  const result = new Map<string, ServiceMark | null>();
  const awaitingSessions = new Set<string>();

  for (const item of snapshot.inFlight) {
    if (item.sessionID && item.awaitingReview) {
      awaitingSessions.add(item.sessionID);
    }
  }

  const latestBySession = new Map<string, { timestamp: number; verdict: ClassifierVerdict }>();

  const considerVerdict = (sessionID: string, timestamp: number, verdict: ClassifierVerdict): void => {
    if (!sessionID) return;
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
      considerVerdict(
        rt.lastVerdict.sessionID,
        rt.lastVerdict.timestamp,
        rt.lastVerdict.verdict,
      );
    }
  }

  const candidateSessionIds = new Set<string>([
    ...previouslyMarkedSessionIds,
    ...awaitingSessions,
    ...latestBySession.keys(),
  ]);

  for (const sessionID of candidateSessionIds) {
    if (!sessionID || sessionID === "default-session") continue;

    if (awaitingSessions.has(sessionID)) {
      result.set(sessionID, {
        icon: "shield",
        tone: "warning",
        text: "Awaiting AutoGate review",
      });
      continue;
    }

    const latest = latestBySession.get(sessionID);
    if (latest && now - latest.timestamp <= MARK_STALE_WINDOW_MS) {
      if (latest.verdict === "BLOCK") {
        result.set(sessionID, {
          icon: "close-circle",
          tone: "error",
          text: "Blocked by AutoGate",
        });
        continue;
      }
      if (latest.verdict === "UNSURE") {
        result.set(sessionID, {
          icon: "alert",
          tone: "warning",
          text: "Flagged UNSURE by AutoGate",
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
