export type ClassifierVerdict = "ALLOW" | "BLOCK" | "UNSURE";
export type ReviewFallbackMode = "native" | "ntfy";
export type SystemOneExecutionMode = "race" | "cascade";

export interface SanitizedSystemOneConfig {
  enabled: boolean;
  executionMode: SystemOneExecutionMode;
  endpoint: string;
  model: string;
  timeoutMs: number;
  hasApiKey: boolean;
}

export interface SanitizedAutoGateConfig {
  configPath: string;
  configDir: string;
  configExists: boolean;
  autoMode: boolean;
  reviewFallbackMode: ReviewFallbackMode;
  classifierModel: string;
  classifierTimeout: number;
  consecutiveBlockThreshold: number;
  notifyOnVerdict: boolean;
  ntfyServer: string;
  ntfyTopic: string;
  hasNtfyToken: boolean;
  evalLogFile: string;
  systemOne: SanitizedSystemOneConfig;
}

export type RuntimeInFlightItem = {
  id: string;
  sessionID: string;
  toolName: string;
  commandString?: string;
  workspaceRoot?: string;
  reason?: string;
  awaitingReview: boolean;
  status?: string;
  startedAt?: number;
};

export interface RuntimeLastVerdict {
  timestamp: number;
  sessionID?: string;
  toolName?: string;
  commandString?: string;
  verdict: ClassifierVerdict;
  reason?: string;
  riskLevel?: string;
  durationMs?: number;
}

export interface LiveRuntimeState {
  version: number;
  pid: number;
  workspaceRoot: string;
  startedAt: number;
  updatedAt: number;
  autoMode: boolean;
  reviewFallbackMode: ReviewFallbackMode;
  remoteReviewEnabled: boolean;
  consecutiveBlocks: number;
  consecutiveBlockThreshold: number;
  classifierModel: string;
  systemOneEnabled: boolean;
  systemOneMode: SystemOneExecutionMode;
  evalLogFile: string;
  inFlight: RuntimeInFlightItem[];
  lastVerdict: RuntimeLastVerdict | null;
}

export type NormalizedCascadeTrace = {
  mode?: string;
  winner?: "system1" | "system2";
  escalationReason?: string;
  s1LatencyMs?: number;
  s2LatencyMs?: number;
  s2Aborted?: boolean;
  s1Probs?: Record<string, number>;
  inScopeScore?: number;
  injectionScore?: number;
};

export type NormalizedEvalEntry = {
  id: string;
  timestamp: number;
  sessionID: string;
  toolName: string;
  commandString: string;
  commandPreview: string;
  userPrompt?: string;
  reasoning?: string;
  verdict: ClassifierVerdict;
  riskLevel?: string;
  userAuthorization?: string;
  durationMs: number;
  sourceFormat: "opencode" | "omp";
  model?: string;
  cascade?: NormalizedCascadeTrace;
};

export interface SystemOneHealthState {
  enabled: boolean;
  mode: SystemOneExecutionMode;
  endpoint: string;
  healthUrl: string;
  reachable: boolean;
  checkedAt: number;
  latencyMs?: number;
  statusCode?: number;
  error?: string;
}

export interface CircuitBreakerState {
  consecutiveBlocks: number;
  threshold: number;
  tripped: boolean;
  resetCircuitBreakerAt: number | null;
}

export interface EvalStatsSummary {
  total: number;
  allow: number;
  block: number;
  unsure: number;
  avgLatencyMs: number;
  s1FastPathCount: number;
  s1FastPathPct: number;
}

export interface AutoGateSessionSummary {
  sessionID: string;
  latestAt: number;
  totalCount: number;
  allowCount: number;
  blockCount: number;
  unsureCount: number;
  avgLatencyMs: number;
  s1FastPathPct: number;
  latestVerdict: ClassifierVerdict | null;
  latestToolName: string;
  latestCommandPreview: string;
  inFlightCount: number;
  awaitingReviewCount: number;
  inFlight: RuntimeInFlightItem[];
  recentEvaluations: NormalizedEvalEntry[];
}

export type AutoGateSessionPopoverData = {
  sessionID: string;
  title: string | null;
  latestAt: number;
  totalCount: number;
  allowCount: number;
  blockCount: number;
  unsureCount: number;
  avgLatencyMs: number;
  s1FastPathPct: number;
  latestVerdict: ClassifierVerdict | null;
  inFlightCount: number;
  awaitingReviewCount: number;
  inFlight: RuntimeInFlightItem[];
  recentEvaluations: NormalizedEvalEntry[];
};

export interface AutoGateStateSnapshot {
  generatedAt: number;
  config: SanitizedAutoGateConfig;
  runtimes: LiveRuntimeState[];
  breaker: CircuitBreakerState;
  systemOneHealth: SystemOneHealthState;
  inFlight: RuntimeInFlightItem[];
  stats: EvalStatsSummary;
  evaluations: NormalizedEvalEntry[];
  recentSessions: AutoGateSessionSummary[];
}

export type AutoGateActionRequest =
  | { action: "setAutoMode"; enabled: boolean }
  | { action: "setFallbackMode"; mode: ReviewFallbackMode }
  | { action: "resetBreaker" };

export interface AutoGateActionResponse {
  ok: boolean;
  message?: string;
  state: AutoGateStateSnapshot;
}
