import {
  connectHost,
  HostRequestError,
  type HostReadyContext,
} from "@openchamber/sdk";
import {
  applyHostReady,
  mountBadge,
  mountBanner,
  mountButton,
  mountPopoverAnchor,
  type Handle,
  type PopoverAnchorHandle,
  type Tone,
} from "@openchamber/sdk/ui";
import type {
  AutoGateActionRequest,
  AutoGateActionResponse,
  AutoGateSessionPopoverData,
  AutoGateSessionSummary,
  AutoGateStateSnapshot,
  ClassifierVerdict,
  NormalizedCascadeTrace,
  NormalizedEvalEntry,
  ReviewFallbackMode,
  RuntimeInFlightItem,
} from "../shared/types.ts";

const STATUS_MIN_HEIGHT = 24;
const STATUS_MAX_HEIGHT = 320;
const POPOVER_MIN_HEIGHT = 64;
const POPOVER_MAX_HEIGHT = 460;
const POPOVER_WIDTH = 380;
const POPOVER_INITIAL_HEIGHT = 320;
const MAX_STATUS_SESSIONS = 5;
const MAX_POPOVER_EVALS = 6;
const MAX_POPOVER_INFLIGHT = 4;
const POPOVER_PAYLOAD_TARGET_CHARS = 12_000;
const POLL_INTERVAL_MS = 2500;
const SESSION_TITLES_TTL_MS = 15_000;

const isRecord = (val: unknown): val is Record<string, unknown> =>
  Boolean(val) && typeof val === "object" && !Array.isArray(val);

const clampStr = (val: string | undefined | null, maxLen: number): string | undefined => {
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= maxLen) return trimmed;
  return maxLen <= 1 ? trimmed.slice(0, maxLen) : `${trimmed.slice(0, maxLen - 1)}…`;
};

export const truncateSessionId = (sessionID: string): string => {
  const trimmed = sessionID.trim();
  if (trimmed.length <= 16) return trimmed || "session";
  return `${trimmed.slice(0, 12)}…`;
};

export const formatRelativeAge = (
  ts: number,
  now: number = Date.now(),
  isActive: boolean = false,
): string => {
  if (isActive) return "now";
  if (!Number.isFinite(ts) || ts <= 0) return "—";
  const deltaSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (deltaSec < 60) return "now";
  const mins = Math.floor(deltaSec / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
};

const formatClockTime = (ts: number): string => {
  if (!Number.isFinite(ts) || ts <= 0) return "unknown";
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(ts);
  }
};

const verdictTone = (verdict: ClassifierVerdict): Tone => {
  if (verdict === "ALLOW") return "success";
  if (verdict === "BLOCK") return "error";
  return "warning";
};

const riskTone = (risk?: string): Tone => {
  switch (risk?.toUpperCase()) {
    case "LOW":
      return "success";
    case "MEDIUM":
      return "warning";
    case "HIGH":
    case "CRITICAL":
      return "error";
    default:
      return "neutral";
  }
};

const sessionDotTone = (session: AutoGateSessionSummary): "info" | "error" | "warning" | "success" => {
  if (session.inFlightCount > 0) return "info";
  if (session.latestVerdict === "BLOCK") return "error";
  if (session.latestVerdict === "UNSURE") return "warning";
  return "success";
};

const sessionStatusBadge = (
  data: AutoGateSessionPopoverData,
): { label: string; tone: Tone } => {
  if (data.awaitingReviewCount > 0) return { label: "Awaiting Review", tone: "warning" };
  if (data.inFlightCount > 0) return { label: "Evaluating", tone: "info" };
  if (data.latestVerdict === "BLOCK" || (data.latestVerdict === null && data.blockCount > 0)) {
    return { label: "Blocked", tone: "error" };
  }
  if (data.latestVerdict === "UNSURE" || (data.latestVerdict === null && data.unsureCount > 0)) {
    return { label: "Needs Review", tone: "warning" };
  }
  return { label: "Clean", tone: "success" };
};

const compactEvalEntry = (
  entry: NormalizedEvalEntry,
  limits: { cmd: number; preview: number; reason: number; prompt: number },
): NormalizedEvalEntry => ({
  id: entry.id.slice(0, 80),
  timestamp: entry.timestamp,
  sessionID: entry.sessionID.slice(0, 80),
  toolName: entry.toolName.slice(0, 64),
  commandString: clampStr(entry.commandString, limits.cmd) ?? "",
  commandPreview: clampStr(entry.commandPreview, limits.preview) ?? "",
  ...(clampStr(entry.userPrompt, limits.prompt)
    ? { userPrompt: clampStr(entry.userPrompt, limits.prompt) }
    : {}),
  ...(clampStr(entry.reasoning, limits.reason)
    ? { reasoning: clampStr(entry.reasoning, limits.reason) }
    : {}),
  verdict: entry.verdict,
  ...(entry.riskLevel ? { riskLevel: entry.riskLevel.slice(0, 32) } : {}),
  ...(entry.userAuthorization
    ? { userAuthorization: entry.userAuthorization.slice(0, 32) }
    : {}),
  durationMs: entry.durationMs,
  sourceFormat: entry.sourceFormat,
  ...(entry.model ? { model: entry.model.slice(0, 80) } : {}),
  ...(entry.cascade
    ? {
        cascade: {
          ...(entry.cascade.mode ? { mode: entry.cascade.mode.slice(0, 24) } : {}),
          ...(entry.cascade.winner ? { winner: entry.cascade.winner } : {}),
          ...(clampStr(entry.cascade.escalationReason, 120)
            ? { escalationReason: clampStr(entry.cascade.escalationReason, 120) }
            : {}),
          ...(entry.cascade.s1LatencyMs !== undefined
            ? { s1LatencyMs: entry.cascade.s1LatencyMs }
            : {}),
          ...(entry.cascade.s2LatencyMs !== undefined
            ? { s2LatencyMs: entry.cascade.s2LatencyMs }
            : {}),
          ...(entry.cascade.s2Aborted !== undefined
            ? { s2Aborted: entry.cascade.s2Aborted }
            : {}),
          ...(entry.cascade.inScopeScore !== undefined
            ? { inScopeScore: entry.cascade.inScopeScore }
            : {}),
          ...(entry.cascade.injectionScore !== undefined
            ? { injectionScore: entry.cascade.injectionScore }
            : {}),
        },
      }
    : {}),
});

const compactInFlightItem = (
  item: RuntimeInFlightItem,
  limits: { cmd: number; reason: number },
): RuntimeInFlightItem => ({
  id: item.id.slice(0, 80),
  sessionID: item.sessionID.slice(0, 80),
  toolName: item.toolName.slice(0, 64),
  ...(clampStr(item.commandString, limits.cmd)
    ? { commandString: clampStr(item.commandString, limits.cmd) }
    : {}),
  ...(clampStr(item.workspaceRoot, 160)
    ? { workspaceRoot: clampStr(item.workspaceRoot, 160) }
    : {}),
  ...(clampStr(item.reason, limits.reason)
    ? { reason: clampStr(item.reason, limits.reason) }
    : {}),
  awaitingReview: item.awaitingReview,
  ...(item.status ? { status: item.status.slice(0, 40) } : {}),
  ...(item.startedAt !== undefined ? { startedAt: item.startedAt } : {}),
});

export const toBoundedSessionPopoverPayload = (
  session: AutoGateSessionSummary,
  title: string | null,
): AutoGateSessionPopoverData => {
  const payload: AutoGateSessionPopoverData = {
    sessionID: session.sessionID.slice(0, 120),
    title: clampStr(title, 120) ?? null,
    latestAt: session.latestAt,
    totalCount: session.totalCount,
    allowCount: session.allowCount,
    blockCount: session.blockCount,
    unsureCount: session.unsureCount,
    avgLatencyMs: session.avgLatencyMs,
    s1FastPathPct: session.s1FastPathPct,
    latestVerdict: session.latestVerdict,
    inFlightCount: session.inFlightCount,
    awaitingReviewCount: session.awaitingReviewCount,
    inFlight: session.inFlight
      .slice(0, MAX_POPOVER_INFLIGHT)
      .map((item) => compactInFlightItem(item, { cmd: 300, reason: 200 })),
    recentEvaluations: session.recentEvaluations
      .slice(0, MAX_POPOVER_EVALS)
      .map((entry) =>
        compactEvalEntry(entry, { cmd: 600, preview: 160, reason: 450, prompt: 300 }),
      ),
  };

  while (
    JSON.stringify(payload).length > POPOVER_PAYLOAD_TARGET_CHARS &&
    payload.recentEvaluations.length > 1
  ) {
    payload.recentEvaluations.pop();
  }

  if (JSON.stringify(payload).length > POPOVER_PAYLOAD_TARGET_CHARS) {
    payload.inFlight = payload.inFlight
      .slice(0, 1)
      .map((item) => compactInFlightItem(item, { cmd: 180, reason: 120 }));
    payload.recentEvaluations = payload.recentEvaluations
      .slice(0, 1)
      .map((entry) =>
        compactEvalEntry(entry, { cmd: 280, preview: 120, reason: 200, prompt: 140 }),
      );
  }

  return payload;
};

const parseCascade = (raw: unknown): NormalizedCascadeTrace | undefined => {
  if (!isRecord(raw)) return undefined;
  const trace: NormalizedCascadeTrace = {};
  if (typeof raw.mode === "string") trace.mode = raw.mode;
  if (raw.winner === "system1" || raw.winner === "system2") trace.winner = raw.winner;
  if (typeof raw.escalationReason === "string") trace.escalationReason = raw.escalationReason;
  if (typeof raw.s1LatencyMs === "number") trace.s1LatencyMs = raw.s1LatencyMs;
  if (typeof raw.s2LatencyMs === "number") trace.s2LatencyMs = raw.s2LatencyMs;
  if (typeof raw.s2Aborted === "boolean") trace.s2Aborted = raw.s2Aborted;
  if (typeof raw.inScopeScore === "number") trace.inScopeScore = raw.inScopeScore;
  if (typeof raw.injectionScore === "number") trace.injectionScore = raw.injectionScore;
  return Object.keys(trace).length > 0 ? trace : undefined;
};

const parseVerdict = (val: unknown): ClassifierVerdict | null =>
  val === "ALLOW" || val === "BLOCK" || val === "UNSURE" ? val : null;

const parseEvalEntry = (raw: unknown): NormalizedEvalEntry | null => {
  if (!isRecord(raw)) return null;
  const verdict = parseVerdict(raw.verdict);
  if (!verdict || typeof raw.id !== "string") return null;
  const cascade = parseCascade(raw.cascade);
  return {
    id: raw.id,
    timestamp: typeof raw.timestamp === "number" ? raw.timestamp : 0,
    sessionID: typeof raw.sessionID === "string" ? raw.sessionID : "",
    toolName: typeof raw.toolName === "string" ? raw.toolName : "permission",
    commandString: typeof raw.commandString === "string" ? raw.commandString : "",
    commandPreview: typeof raw.commandPreview === "string" ? raw.commandPreview : "",
    ...(typeof raw.userPrompt === "string" ? { userPrompt: raw.userPrompt } : {}),
    ...(typeof raw.reasoning === "string" ? { reasoning: raw.reasoning } : {}),
    verdict,
    ...(typeof raw.riskLevel === "string" ? { riskLevel: raw.riskLevel } : {}),
    ...(typeof raw.userAuthorization === "string"
      ? { userAuthorization: raw.userAuthorization }
      : {}),
    durationMs: typeof raw.durationMs === "number" ? raw.durationMs : 0,
    sourceFormat: raw.sourceFormat === "omp" ? "omp" : "opencode",
    ...(typeof raw.model === "string" ? { model: raw.model } : {}),
    ...(cascade ? { cascade } : {}),
  };
};

const parseInFlightItem = (raw: unknown): RuntimeInFlightItem | null => {
  if (!isRecord(raw) || typeof raw.id !== "string") return null;
  return {
    id: raw.id,
    sessionID: typeof raw.sessionID === "string" ? raw.sessionID : "",
    toolName: typeof raw.toolName === "string" ? raw.toolName : "permission",
    ...(typeof raw.commandString === "string" ? { commandString: raw.commandString } : {}),
    ...(typeof raw.workspaceRoot === "string" ? { workspaceRoot: raw.workspaceRoot } : {}),
    ...(typeof raw.reason === "string" ? { reason: raw.reason } : {}),
    awaitingReview: Boolean(raw.awaitingReview),
    ...(typeof raw.status === "string" ? { status: raw.status } : {}),
    ...(typeof raw.startedAt === "number" ? { startedAt: raw.startedAt } : {}),
  };
};

export const parseSessionPopoverData = (raw: unknown): AutoGateSessionPopoverData | null => {
  if (!isRecord(raw) || typeof raw.sessionID !== "string" || !raw.sessionID.trim()) {
    return null;
  }
  const inFlight = Array.isArray(raw.inFlight)
    ? raw.inFlight.map(parseInFlightItem).filter((item): item is RuntimeInFlightItem => item !== null)
    : [];
  const recentEvaluations = Array.isArray(raw.recentEvaluations)
    ? raw.recentEvaluations
        .map(parseEvalEntry)
        .filter((entry): entry is NormalizedEvalEntry => entry !== null)
    : [];

  return {
    sessionID: raw.sessionID,
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : null,
    latestAt: typeof raw.latestAt === "number" ? raw.latestAt : 0,
    totalCount: typeof raw.totalCount === "number" ? raw.totalCount : recentEvaluations.length,
    allowCount: typeof raw.allowCount === "number" ? raw.allowCount : 0,
    blockCount: typeof raw.blockCount === "number" ? raw.blockCount : 0,
    unsureCount: typeof raw.unsureCount === "number" ? raw.unsureCount : 0,
    avgLatencyMs: typeof raw.avgLatencyMs === "number" ? raw.avgLatencyMs : 0,
    s1FastPathPct: typeof raw.s1FastPathPct === "number" ? raw.s1FastPathPct : 0,
    latestVerdict: parseVerdict(raw.latestVerdict),
    inFlightCount: typeof raw.inFlightCount === "number" ? raw.inFlightCount : inFlight.length,
    awaitingReviewCount:
      typeof raw.awaitingReviewCount === "number"
        ? raw.awaitingReviewCount
        : inFlight.filter((item) => item.awaitingReview).length,
    inFlight,
    recentEvaluations,
  };
};

export const bootAutoGateStatusApp = (): void => {
  const host = connectHost();
  const root = document.querySelector<HTMLElement>("#root");
  if (!root) return;

  let latestContext: HostReadyContext | null = null;
  let mountedSurface: "status" | "popover" | null = null;
  let currentDirectory: string | null = null;
  let snapshot: AutoGateStateSnapshot | null = null;
  let loadError: { text: string; tone: "muted" | "warning" } | null = null;
  let actionBusy = false;
  let expandedInlineSessionId: string | null = null;
  let lastReportedHeight: number | null = null;
  let lastStatusSignature: string | null = null;
  let pendingRender = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let fetchSeq = 0;

  const sessionTitleMap = new Map<string, string>();
  let lastTitlesFetchAt = 0;
  let titlesFetchInFlight = false;

  const activeDisposers: Array<() => void> = [];

  const clearActiveHandles = (): void => {
    while (activeDisposers.length > 0) {
      const dispose = activeDisposers.pop();
      try {
        dispose?.();
      } catch {
        // Ignore disposal errors
      }
    }
  };

  const syncFrameHeight = (minPx: number, maxPx: number): void => {
    const measured = Math.ceil(root.getBoundingClientRect().height);
    const clamped = Math.max(minPx, Math.min(maxPx, measured || minPx));
    if (clamped === lastReportedHeight) return;
    lastReportedHeight = clamped;
    void host.setHeight(clamped).catch(() => {});
  };

  const setupResizeObserver = (minPx: number, maxPx: number): void => {
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      syncFrameHeight(minPx, maxPx);
    });
    observer.observe(root);
  };

  const callService = async <T>(
    method: "GET" | "POST",
    reqPath: string,
    body?: unknown,
  ): Promise<T> => {
    const res = await host.serviceRequest({
      method,
      path: reqPath,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const parsed = res.body
      ? (JSON.parse(res.body) as T & { message?: string })
      : ({} as T & { message?: string });
    if (res.status >= 400) {
      throw new Error(parsed.message || `Service request ${reqPath} failed (${res.status})`);
    }
    return parsed;
  };

  const getDisplaySessionTitle = (sessionID: string, explicitTitle?: string | null): string => {
    const fromMap = sessionTitleMap.get(sessionID);
    const candidate = explicitTitle?.trim() || fromMap?.trim() || "";
    return candidate || truncateSessionId(sessionID);
  };

  const refreshSessionTitlesIfNeeded = async (force = false): Promise<void> => {
    if (titlesFetchInFlight) return;
    const now = Date.now();
    const visibleSessions = (snapshot?.recentSessions ?? []).slice(0, MAX_STATUS_SESSIONS);
    const hasMissing = visibleSessions.some((s) => !sessionTitleMap.has(s.sessionID));
    const ttlExpired = now - lastTitlesFetchAt >= SESSION_TITLES_TTL_MS;
    if (!force && !ttlExpired && (!hasMissing || now - lastTitlesFetchAt < 4_000)) {
      return;
    }

    titlesFetchInFlight = true;
    lastTitlesFetchAt = now;
    let updatedAny = false;

    try {
      const projectsSnap = await host.listProjects();
      const projects = projectsSnap.projects.slice(0, 12);
      const results = await Promise.allSettled(
        projects.map((project) => host.listSessions(project.id)),
      );
      for (const res of results) {
        if (res.status !== "fulfilled") continue;
        for (const ses of res.value.sessions) {
          const title = ses.title?.trim();
          if (title && sessionTitleMap.get(ses.id) !== title) {
            sessionTitleMap.set(ses.id, title);
            updatedAny = true;
          }
        }
      }
    } catch {
      // Capability may be ungranted or unsupported; keep truncated session IDs
    } finally {
      titlesFetchInFlight = false;
    }

    if (updatedAny && mountedSurface === "status") {
      renderStatusSurface();
    }
  };

  const performAction = async (req: AutoGateActionRequest, toastMsg: string): Promise<void> => {
    if (actionBusy) return;
    actionBusy = true;
    renderStatusSurface();
    try {
      const params = new URLSearchParams();
      if (currentDirectory) params.set("directory", currentDirectory);
      const qs = params.toString();
      const res = await callService<AutoGateActionResponse>(
        "POST",
        `/api/action${qs ? `?${qs}` : ""}`,
        req,
      );
      snapshot = res.state;
      loadError = null;
      await host.toast({ kind: "success", message: toastMsg }).catch(() => {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await host.toast({ kind: "error", message }).catch(() => {});
    } finally {
      actionBusy = false;
      renderStatusSurface();
    }
  };

  const fetchState = async (): Promise<void> => {
    const seq = ++fetchSeq;
    const params = new URLSearchParams();
    if (currentDirectory) params.set("directory", currentDirectory);
    const qs = params.toString();

    try {
      const next = await callService<AutoGateStateSnapshot>(
        "GET",
        `/api/state${qs ? `?${qs}` : ""}`,
      );
      if (seq !== fetchSeq) return;
      snapshot = next;
      loadError = null;
      renderStatusSurface();
      void refreshSessionTitlesIfNeeded();
    } catch (err) {
      if (seq !== fetchSeq) return;
      if (err instanceof HostRequestError) {
        if (err.code === "NO_SERVICE" || err.code === "NOT_GRANTED") {
          loadError = {
            text: "Approve AutoGate in Settings → Extensions",
            tone: "warning",
          };
        } else if (err.code === "DISABLED") {
          loadError = {
            text: "AutoGate is paused in Settings → Extensions",
            tone: "muted",
          };
        } else {
          loadError = {
            text: "Waiting for AutoGate service…",
            tone: "muted",
          };
        }
      } else {
        loadError = {
          text: err instanceof Error ? err.message : "Waiting for AutoGate service…",
          tone: "warning",
        };
      }
      renderStatusSurface();
    }
  };

  const mountSessionDetailCard = (
    container: HTMLElement,
    data: AutoGateSessionPopoverData,
    options: { isPopover: boolean },
  ): Array<Handle<unknown>> => {
    const handles: Array<Handle<unknown>> = [];
    const evals = data.recentEvaluations.slice(0, MAX_POPOVER_EVALS);
    let selectedEvalId: string | null = evals[0]?.id ?? null;

    if (options.isPopover) {
      const header = document.createElement("div");
      header.className = "ag-pop-header";

      const titleWrap = document.createElement("div");
      titleWrap.className = "ag-pop-title-wrap";

      const titleEl = document.createElement("h2");
      titleEl.className = "ag-pop-title";
      titleEl.textContent = data.title?.trim() || truncateSessionId(data.sessionID);

      const subEl = document.createElement("div");
      subEl.className = "ag-pop-subtitle";
      subEl.textContent = data.sessionID;
      subEl.title = data.sessionID;

      titleWrap.append(titleEl, subEl);
      header.appendChild(titleWrap);

      const badgeWrap = document.createElement("div");
      handles.push(mountBadge(badgeWrap, sessionStatusBadge(data)) as Handle<unknown>);
      header.appendChild(badgeWrap);

      container.appendChild(header);
    }

    const summaryBox = document.createElement("div");
    summaryBox.className = "ag-pop-summary";

    const countsRow = document.createElement("div");
    countsRow.className = "ag-pop-summary-counts";

    const allowSpan = document.createElement("span");
    allowSpan.className = "ag-count-allow";
    allowSpan.textContent = `${data.allowCount} ALLOW`;
    countsRow.appendChild(allowSpan);

    const blockSpan = document.createElement("span");
    if (data.blockCount > 0) blockSpan.className = "ag-count-block";
    blockSpan.textContent = `${data.blockCount} BLOCK`;
    countsRow.appendChild(blockSpan);

    const unsureSpan = document.createElement("span");
    if (data.unsureCount > 0) unsureSpan.className = "ag-count-unsure";
    unsureSpan.textContent = `${data.unsureCount} UNSURE`;
    countsRow.appendChild(unsureSpan);

    const metaRow = document.createElement("div");
    metaRow.className = "ag-pop-summary-meta";
    const lastActiveText =
      data.latestAt > 0
        ? formatRelativeAge(data.latestAt, Date.now(), data.inFlightCount > 0)
        : "—";
    metaRow.textContent = `${data.totalCount} evals · avg ${data.avgLatencyMs}ms · S1 ${data.s1FastPathPct}% · ${lastActiveText}`;

    summaryBox.append(countsRow, metaRow);
    container.appendChild(summaryBox);

    if (data.awaitingReviewCount > 0 || data.inFlightCount > 0) {
      const first = data.inFlight[0];
      const bannerTitle =
        data.awaitingReviewCount > 0
          ? `${data.awaitingReviewCount} action${data.awaitingReviewCount === 1 ? "" : "s"} awaiting review`
          : `${data.inFlightCount} evaluation${data.inFlightCount === 1 ? "" : "s"} in flight`;
      const bannerBody = first
        ? `${first.toolName}${first.commandString ? `: ${first.commandString}` : ""}`
        : "Pending classifier decision";
      const bannerWrap = document.createElement("div");
      handles.push(
        mountBanner(bannerWrap, {
          tone: data.awaitingReviewCount > 0 ? "warning" : "info",
          title: bannerTitle,
          body: bannerBody,
        }) as Handle<unknown>,
      );
      container.appendChild(bannerWrap);
    }

    const detailHandles: Array<Handle<unknown>> = [];
    const clearDetailHandles = (): void => {
      while (detailHandles.length > 0) {
        try {
          detailHandles.pop()?.dispose();
        } catch {
          // Ignore disposal errors
        }
      }
    };
    handles.push({ dispose: clearDetailHandles } as Handle<unknown>);

    const detailWrap = document.createElement("div");
    detailWrap.className = "ag-eval-detail";

    const listEl = document.createElement("div");
    listEl.className = "ag-mini-list";
    listEl.setAttribute("role", "listbox");
    listEl.setAttribute("aria-label", "Session evaluations");

    const rowEls = new Map<string, HTMLButtonElement>();

    const renderSelectedDetail = (): void => {
      clearDetailHandles();
      detailWrap.replaceChildren();

      const selected = evals.find((e) => e.id === selectedEvalId) ?? evals[0] ?? null;
      if (!selected) {
        detailWrap.hidden = true;
        return;
      }
      detailWrap.hidden = false;
      selectedEvalId = selected.id;

      for (const [id, btn] of rowEls.entries()) {
        btn.setAttribute("aria-selected", id === selectedEvalId ? "true" : "false");
      }

      const badgesRow = document.createElement("div");
      badgesRow.className = "ag-eval-badges";
      detailHandles.push(
        mountBadge(badgesRow, {
          label: selected.verdict,
          tone: verdictTone(selected.verdict),
        }) as Handle<unknown>,
      );
      if (selected.riskLevel) {
        detailHandles.push(
          mountBadge(badgesRow, {
            label: `Risk: ${selected.riskLevel}`,
            tone: riskTone(selected.riskLevel),
          }) as Handle<unknown>,
        );
      }
      if (selected.userAuthorization) {
        detailHandles.push(
          mountBadge(badgesRow, {
            label: `Auth: ${selected.userAuthorization}`,
            tone: "info",
          }) as Handle<unknown>,
        );
      }
      if (selected.cascade?.winner) {
        detailHandles.push(
          mountBadge(badgesRow, {
            label: selected.cascade.winner === "system1" ? "S1 fast-path" : "S2 escalated",
            tone: selected.cascade.winner === "system1" ? "primary" : "neutral",
          }) as Handle<unknown>,
        );
      }
      if (selected.cascade?.escalationReason) {
        detailHandles.push(
          mountBadge(badgesRow, {
            label: selected.cascade.escalationReason,
            tone: "warning",
          }) as Handle<unknown>,
        );
        const pillEl = badgesRow.lastElementChild;
        if (pillEl instanceof HTMLElement) {
          pillEl.title = `Escalation reason: ${selected.cascade.escalationReason}`;
        }
      }
      detailWrap.appendChild(badgesRow);

      const metaEl = document.createElement("div");
      metaEl.className = "ag-eval-meta";
      metaEl.textContent = `${formatClockTime(selected.timestamp)} · ${selected.durationMs}ms · ${selected.toolName}`;
      detailWrap.appendChild(metaEl);

      const cmdLabel = document.createElement("span");
      cmdLabel.className = "ag-field-label";
      cmdLabel.textContent = "Command";
      const cmdPre = document.createElement("pre");
      cmdPre.className = "ag-code-box";
      cmdPre.textContent =
        selected.commandString || selected.commandPreview || selected.toolName;
      detailWrap.append(cmdLabel, cmdPre);

      if (selected.reasoning) {
        const reasonLabel = document.createElement("span");
        reasonLabel.className = "ag-field-label";
        reasonLabel.textContent = "Reasoning";
        const reasonEl = document.createElement("p");
        reasonEl.className = "ag-prose-box";
        reasonEl.textContent = selected.reasoning;
        detailWrap.append(reasonLabel, reasonEl);
      }

      if (selected.userPrompt) {
        const promptLabel = document.createElement("span");
        promptLabel.className = "ag-field-label";
        promptLabel.textContent = "User Prompt";
        const promptEl = document.createElement("p");
        promptEl.className = "ag-prose-box";
        promptEl.textContent = selected.userPrompt;
        detailWrap.append(promptLabel, promptEl);
      }

      if (selected.cascade) {
        const c = selected.cascade;
        const parts: string[] = [];
        if (c.s1LatencyMs !== undefined) parts.push(`S1 ${c.s1LatencyMs}ms`);
        if (c.s2LatencyMs !== undefined) parts.push(`S2 ${c.s2LatencyMs}ms`);
        if (c.inScopeScore !== undefined) parts.push(`inScope ${c.inScopeScore.toFixed(2)}`);
        if (c.injectionScore !== undefined) parts.push(`injection ${c.injectionScore.toFixed(2)}`);
        if (parts.length > 0) {
          const cascadeLabel = document.createElement("span");
          cascadeLabel.className = "ag-field-label";
          cascadeLabel.textContent = "Cascade Trace";
          const cascadeEl = document.createElement("div");
          cascadeEl.className = "ag-cascade-line";
          cascadeEl.textContent = parts.join(" · ");
          detailWrap.append(cascadeLabel, cascadeEl);
        }
      }

      if (options.isPopover) {
        syncFrameHeight(POPOVER_MIN_HEIGHT, POPOVER_MAX_HEIGHT);
      } else {
        syncFrameHeight(STATUS_MIN_HEIGHT, STATUS_MAX_HEIGHT);
      }
    };

    if (evals.length > 0) {
      for (const entry of evals) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "ag-mini-row";
        btn.setAttribute("role", "option");
        btn.dataset.evalId = entry.id;
        btn.setAttribute("aria-selected", entry.id === selectedEvalId ? "true" : "false");

        const left = document.createElement("span");
        left.className = "ag-mini-left";

        const dot = document.createElement("span");
        dot.className = "ag-dot";
        dot.dataset.tone = verdictTone(entry.verdict);

        const cmd = document.createElement("span");
        cmd.className = "ag-mini-cmd";
        const preview = entry.commandPreview || entry.commandString || "";
        cmd.textContent = preview ? `${entry.toolName}: ${preview}` : entry.toolName;

        left.append(dot, cmd);

        const meta = document.createElement("span");
        meta.className = "ag-mini-meta";
        const winnerTag = entry.cascade?.winner
          ? entry.cascade.winner === "system1"
            ? "S1"
            : "S2"
          : null;
        meta.textContent = `${winnerTag ? `${winnerTag} · ` : ""}${entry.durationMs}ms · ${formatRelativeAge(entry.timestamp)}`;

        btn.append(left, meta);
        btn.addEventListener("click", () => {
          selectedEvalId = entry.id;
          renderSelectedDetail();
        });

        rowEls.set(entry.id, btn);
        listEl.appendChild(btn);
      }
      container.appendChild(listEl);
      container.appendChild(detailWrap);
      renderSelectedDetail();
    } else {
      const emptyNote = document.createElement("p");
      emptyNote.className = "ag-note";
      emptyNote.textContent = "No completed evaluations recorded for this session yet.";
      container.appendChild(emptyNote);
    }

    const actions = document.createElement("div");
    actions.className = "ag-pop-actions";

    if (data.sessionID.startsWith("ses_")) {
      const jumpWrap = document.createElement("span");
      handles.push(
        mountButton(jumpWrap, {
          label: "Jump to session",
          size: "xs",
          variant: "secondary",
          onClick: () => {
            void (async () => {
              try {
                await host.openSession(data.sessionID);
                if (options.isPopover) {
                  await host.close().catch(() => {});
                }
              } catch (err) {
                const msg = err instanceof Error ? err.message : "Could not open session";
                await host.toast({ kind: "error", message: msg }).catch(() => {});
              }
            })();
          },
        }) as Handle<unknown>,
      );
      actions.appendChild(jumpWrap);
    }

    const copyIdWrap = document.createElement("span");
    handles.push(
      mountButton(copyIdWrap, {
        label: "Copy session ID",
        size: "xs",
        variant: "outline",
        onClick: () => {
          void (async () => {
            try {
              await host.writeClipboard(data.sessionID);
              await host.toast({ kind: "success", message: "Copied session ID" });
            } catch {
              await host.toast({ kind: "error", message: "Clipboard copy failed" }).catch(() => {});
            }
          })();
        },
      }) as Handle<unknown>,
    );
    actions.appendChild(copyIdWrap);

    const copyCmdWrap = document.createElement("span");
    handles.push(
      mountButton(copyCmdWrap, {
        label: "Copy command",
        size: "xs",
        variant: "outline",
        onClick: () => {
          void (async () => {
            const activeEval = evals.find((e) => e.id === selectedEvalId) ?? evals[0];
            const cmd =
              activeEval?.commandString ||
              activeEval?.commandPreview ||
              data.inFlight[0]?.commandString ||
              "";
            if (!cmd) {
              await host.toast({ kind: "info", message: "No command to copy" }).catch(() => {});
              return;
            }
            try {
              await host.writeClipboard(cmd);
              await host.toast({ kind: "success", message: "Copied command" });
            } catch {
              await host.toast({ kind: "error", message: "Clipboard copy failed" }).catch(() => {});
            }
          })();
        },
      }) as Handle<unknown>,
    );
    actions.appendChild(copyCmdWrap);

    container.appendChild(actions);
    return handles;
  };

  const buildSessionRowGroup = (
    session: AutoGateSessionSummary,
    supportsPopovers: boolean,
    now: number,
  ): HTMLElement => {
    const resolvedTitle = sessionTitleMap.get(session.sessionID) ?? null;
    const displayTitle = getDisplaySessionTitle(session.sessionID, resolvedTitle);

    const groupEl = document.createElement("div");
    groupEl.className = "ag-row-group";
    groupEl.setAttribute("role", "listitem");

    const rowBtn = document.createElement("button");
    rowBtn.type = "button";
    rowBtn.className = "ag-row";
    rowBtn.dataset.sessionId = session.sessionID;

    const mainEl = document.createElement("span");
    mainEl.className = "ag-row-main";

    const topEl = document.createElement("span");
    topEl.className = "ag-row-top";

    const dotEl = document.createElement("span");
    dotEl.className = "ag-dot";
    dotEl.dataset.tone = sessionDotTone(session);

    const titleEl = document.createElement("span");
    titleEl.className = "ag-session-title";
    titleEl.textContent = displayTitle;
    titleEl.title = `${displayTitle} (${session.sessionID})`;

    topEl.append(dotEl, titleEl);

    const subEl = document.createElement("span");
    subEl.className = "ag-row-sub";
    const previewPrefix =
      session.awaitingReviewCount > 0
        ? "Awaiting review · "
        : session.inFlightCount > 0
          ? "Evaluating · "
          : "";
    const cmdText = session.latestCommandPreview
      ? `${session.latestToolName}: ${session.latestCommandPreview}`
      : session.latestToolName;
    subEl.textContent = `${previewPrefix}${cmdText}`;

    mainEl.append(topEl, subEl);

    const rightEl = document.createElement("span");
    rightEl.className = "ag-row-right";

    const countsEl = document.createElement("span");
    countsEl.className = "ag-session-counts";
    if (session.blockCount > 0) countsEl.dataset.hasBlock = "true";
    if (session.totalCount === 0 && session.inFlightCount > 0) {
      countsEl.textContent = `${session.inFlightCount} active`;
    } else {
      countsEl.textContent =
        session.unsureCount > 0
          ? `${session.allowCount}A · ${session.blockCount}B · ${session.unsureCount}U`
          : `${session.allowCount}A · ${session.blockCount}B`;
    }

    const ageEl = document.createElement("span");
    ageEl.className = "ag-age";
    const isActive = session.inFlightCount > 0;
    if (isActive) ageEl.dataset.fresh = "true";
    ageEl.textContent = formatRelativeAge(session.latestAt, now, isActive);

    rightEl.append(countsEl, ageEl);

    rowBtn.append(mainEl, rightEl);
    groupEl.appendChild(rowBtn);

    if (supportsPopovers) {
      const anchorHandle: PopoverAnchorHandle = mountPopoverAnchor(rowBtn, {
        host,
        width: POPOVER_WIDTH,
        height: POPOVER_INITIAL_HEIGHT,
        side: "left",
        label: displayTitle,
        getData: () => toBoundedSessionPopoverPayload(session, resolvedTitle),
      });
      activeDisposers.push(() => anchorHandle.dispose());

      rowBtn.addEventListener("click", () => {
        if (rowBtn.getAttribute("data-oc-popover-open") === "true") return;
        rowBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
      });
    } else {
      const isExpanded = expandedInlineSessionId === session.sessionID;
      rowBtn.setAttribute("aria-expanded", isExpanded ? "true" : "false");
      rowBtn.addEventListener("click", () => {
        expandedInlineSessionId =
          expandedInlineSessionId === session.sessionID ? null : session.sessionID;
        renderStatusSurface();
      });

      if (isExpanded) {
        const inlineBox = document.createElement("div");
        inlineBox.className = "ag-inline-detail";
        const payload = toBoundedSessionPopoverPayload(session, resolvedTitle);
        const subHandles = mountSessionDetailCard(inlineBox, payload, { isPopover: false });
        for (const h of subHandles) {
          activeDisposers.push(() => h.dispose());
        }
        groupEl.appendChild(inlineBox);
      }
    }

    return groupEl;
  };

  const computeStatusSignature = (now: number, supportsPopovers: boolean): string => {
    if (loadError) {
      return `err:${loadError.tone}:${loadError.text}`;
    }
    if (!snapshot) {
      return "loading";
    }
    const { config, systemOneHealth, breaker, stats, recentSessions } = snapshot;
    const topSessions = recentSessions.slice(0, MAX_STATUS_SESSIONS).map((s) => ({
      id: s.sessionID,
      title: sessionTitleMap.get(s.sessionID) ?? null,
      age: formatRelativeAge(s.latestAt, now, s.inFlightCount > 0),
      a: s.allowCount,
      b: s.blockCount,
      u: s.unsureCount,
      t: s.totalCount,
      inf: s.inFlightCount,
      aw: s.awaitingReviewCount,
      lv: s.latestVerdict,
      lt: s.latestToolName,
      lc: s.latestCommandPreview,
    }));

    return JSON.stringify({
      busy: actionBusy,
      pop: supportsPopovers,
      exp: supportsPopovers ? null : expandedInlineSessionId,
      auto: config.autoMode,
      fb: config.reviewFallbackMode,
      s1: {
        en: systemOneHealth.enabled,
        m: systemOneHealth.mode,
        r: systemOneHealth.reachable,
      },
      br: {
        cb: breaker.consecutiveBlocks,
        th: breaker.threshold,
        tr: breaker.tripped,
      },
      st: {
        tot: stats.total,
        a: stats.allow,
        b: stats.block,
        u: stats.unsure,
        lat: stats.avgLatencyMs,
      },
      ses: topSessions,
    });
  };

  const renderStatusSurface = (): void => {
    if (mountedSurface !== "status") return;

    // Stability rule: never replace/rebuild row DOM elements while a popover is open.
    if (root.querySelector('[data-oc-popover-open="true"]')) {
      pendingRender = true;
      return;
    }

    const now = Date.now();
    const supportsPopovers = Boolean(latestContext?.features?.popovers);
    const nextSignature = computeStatusSignature(now, supportsPopovers);
    if (nextSignature === lastStatusSignature) {
      return;
    }
    lastStatusSignature = nextSignature;

    clearActiveHandles();
    root.replaceChildren();

    if (loadError) {
      const note = document.createElement("p");
      note.className = "ag-note";
      note.dataset.tone = loadError.tone;
      note.textContent = loadError.text;
      root.appendChild(note);
      syncFrameHeight(STATUS_MIN_HEIGHT, STATUS_MAX_HEIGHT);
      return;
    }

    if (!snapshot) {
      const note = document.createElement("p");
      note.className = "ag-note";
      note.textContent = "Loading AutoGate…";
      root.appendChild(note);
      syncFrameHeight(STATUS_MIN_HEIGHT, STATUS_MAX_HEIGHT);
      return;
    }

    const { config, systemOneHealth, breaker, stats, recentSessions } = snapshot;
    const wrapper = document.createElement("div");
    wrapper.className = "ag-status-root";

    // Compact control bar
    const controls = document.createElement("div");
    controls.className = "ag-controls";

    const autoBtn = document.createElement("button");
    autoBtn.type = "button";
    autoBtn.className = "ag-pill";
    autoBtn.dataset.control = "auto-mode";
    autoBtn.dataset.tone = config.autoMode ? "success" : "warning";
    autoBtn.disabled = actionBusy;
    autoBtn.title = config.autoMode
      ? "AutoGate automatic classification enabled (click to switch to Manual)"
      : "Manual mode active (click to enable AutoGate)";
    const autoDot = document.createElement("span");
    autoDot.className = "ag-dot";
    autoDot.dataset.tone = config.autoMode ? "success" : "warning";
    const autoLabel = document.createElement("span");
    autoLabel.textContent = config.autoMode ? "Auto: ON" : "Manual";
    autoBtn.append(autoDot, autoLabel);
    autoBtn.addEventListener("click", () => {
      const next = !config.autoMode;
      void performAction(
        { action: "setAutoMode", enabled: next },
        next ? "Auto Mode enabled" : "Auto Mode set to Manual",
      );
    });
    controls.appendChild(autoBtn);

    const fallbackBtn = document.createElement("button");
    fallbackBtn.type = "button";
    fallbackBtn.className = "ag-pill";
    fallbackBtn.dataset.control = "fallback";
    fallbackBtn.disabled = actionBusy;
    fallbackBtn.title = `Review fallback mode: ${config.reviewFallbackMode} (click to toggle)`;
    fallbackBtn.textContent = config.reviewFallbackMode;
    fallbackBtn.addEventListener("click", () => {
      const next: ReviewFallbackMode =
        config.reviewFallbackMode === "ntfy" ? "native" : "ntfy";
      void performAction(
        { action: "setFallbackMode", mode: next },
        `Fallback set to ${next}`,
      );
    });
    controls.appendChild(fallbackBtn);

    const s1Pill = document.createElement("span");
    s1Pill.className = "ag-pill";
    s1Pill.dataset.control = "system1";
    const s1Tone = !systemOneHealth.enabled
      ? "muted"
      : systemOneHealth.reachable
        ? "success"
        : "error";
    s1Pill.dataset.tone = s1Tone;
    s1Pill.title = systemOneHealth.enabled
      ? `${systemOneHealth.endpoint} (${systemOneHealth.mode})${systemOneHealth.latencyMs !== undefined ? ` · ${systemOneHealth.latencyMs}ms` : ""}`
      : `System 1 disabled (${systemOneHealth.endpoint})`;
    const s1Dot = document.createElement("span");
    s1Dot.className = "ag-dot";
    s1Dot.dataset.tone = s1Tone;
    const s1Text = document.createElement("span");
    s1Text.textContent = !systemOneHealth.enabled
      ? "S1 off"
      : systemOneHealth.reachable
        ? `S1 ${systemOneHealth.mode} · up`
        : "S1 down";
    s1Pill.append(s1Dot, s1Text);
    controls.appendChild(s1Pill);

    if (breaker.consecutiveBlocks > 0) {
      const breakerPill = document.createElement("span");
      breakerPill.className = "ag-pill";
      breakerPill.dataset.control = "breaker";
      breakerPill.dataset.tone = breaker.tripped ? "error" : "warning";
      breakerPill.textContent = `Breaker ${breaker.consecutiveBlocks}/${breaker.threshold}`;
      controls.appendChild(breakerPill);

      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "ag-pill";
      resetBtn.dataset.control = "reset-breaker";
      resetBtn.disabled = actionBusy;
      resetBtn.textContent = "Reset";
      resetBtn.addEventListener("click", () => {
        void performAction({ action: "resetBreaker" }, "Circuit breaker reset");
      });
      controls.appendChild(resetBtn);
    }

    wrapper.appendChild(controls);

    // Compact summary line
    const statsEl = document.createElement("div");
    statsEl.className = "ag-stats-summary";
    statsEl.textContent =
      stats.total > 0
        ? `${stats.allow}A · ${stats.block}B · ${stats.unsure}U · avg ${stats.avgLatencyMs}ms`
        : "No evaluations yet";
    wrapper.appendChild(statsEl);

    // Recent Sessions list (up to 5)
    const sessionsSlice = recentSessions.slice(0, MAX_STATUS_SESSIONS);
    if (sessionsSlice.length > 0) {
      const section = document.createElement("div");
      section.className = "ag-sessions-section";

      const sectionLabel = document.createElement("div");
      sectionLabel.className = "ag-section-label";
      sectionLabel.textContent = "Recent Sessions";
      section.appendChild(sectionLabel);

      const listEl = document.createElement("div");
      listEl.className = "ag-sessions-list";
      listEl.setAttribute("role", "list");

      for (const ses of sessionsSlice) {
        listEl.appendChild(buildSessionRowGroup(ses, supportsPopovers, now));
      }

      section.appendChild(listEl);
      wrapper.appendChild(section);
    }

    root.appendChild(wrapper);
    syncFrameHeight(STATUS_MIN_HEIGHT, STATUS_MAX_HEIGHT);
  };

  const mountPopoverSurface = (ctx: HostReadyContext): void => {
    clearActiveHandles();
    root.replaceChildren();

    const wrap = document.createElement("div");
    wrap.className = "ag-popover";

    const data = parseSessionPopoverData(ctx.popover?.data);
    if (!data) {
      const empty = document.createElement("p");
      empty.className = "ag-note";
      empty.textContent = "Session details unavailable.";
      wrap.appendChild(empty);
    } else {
      const handles = mountSessionDetailCard(wrap, data, { isPopover: true });
      for (const h of handles) {
        activeDisposers.push(() => h.dispose());
      }
    }

    root.appendChild(wrap);
    syncFrameHeight(POPOVER_MIN_HEIGHT, POPOVER_MAX_HEIGHT);
  };

  host.onReady((ctx) => {
    latestContext = ctx;
    applyHostReady(ctx, document.documentElement);
    currentDirectory = ctx.directory;
    if (ctx.session?.id && ctx.session.title) {
      sessionTitleMap.set(ctx.session.id, ctx.session.title);
    }

    if (ctx.surface === "popover") {
      if (mountedSurface !== "popover") {
        mountedSurface = "popover";
        setupResizeObserver(POPOVER_MIN_HEIGHT, POPOVER_MAX_HEIGHT);
        mountPopoverSurface(ctx);
      }
      return;
    }

    if (mountedSurface !== "status") {
      mountedSurface = "status";
      setupResizeObserver(STATUS_MIN_HEIGHT, STATUS_MAX_HEIGHT);

      host.onDirectory((dir) => {
        currentDirectory = dir;
        void fetchState();
      });

      host.onSession((session) => {
        if (session?.id && session.title) {
          const prev = sessionTitleMap.get(session.id);
          if (prev !== session.title) {
            sessionTitleMap.set(session.id, session.title);
            renderStatusSurface();
          }
        }
      });

      host.onPopoverClosed(() => {
        queueMicrotask(() => {
          if (!pendingRender) return;
          if (root.querySelector('[data-oc-popover-open="true"]')) return;
          pendingRender = false;
          renderStatusSurface();
        });
      });

      void fetchState();
      pollTimer = setInterval(() => {
        void fetchState();
      }, POLL_INTERVAL_MS);
    } else {
      renderStatusSurface();
    }
  });

  window.addEventListener("pagehide", () => {
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    clearActiveHandles();
  });
};

if (typeof window !== "undefined" && typeof document !== "undefined") {
  bootAutoGateStatusApp();
}
