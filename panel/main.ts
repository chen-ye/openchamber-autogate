import { connectHost } from "@openchamber/sdk";
import {
  applyHostReady,
  GUEST_UI_LOOK_CSS,
  mountBadge,
  mountBanner,
  mountButton,
  mountEmpty,
  mountList,
  mountSearchField,
  mountSelect,
  mountSeparator,
  mountSwitch,
  mountTabs,
  type BadgeHandle,
  type BannerHandle,
  type ButtonHandle,
  type CheckboxHandle,
  type EmptyHandle,
  type ListHandle,
  type ListItem,
  type SearchFieldHandle,
  type SelectHandle,
  type TabsHandle,
  type Tone,
} from "@openchamber/sdk/ui";
import type {
  AutoGateActionRequest,
  AutoGateActionResponse,
  AutoGateStateSnapshot,
  ClassifierVerdict,
  NormalizedEvalEntry,
  ReviewFallbackMode,
} from "../shared/types.ts";

const PANEL_STYLES = `
${GUEST_UI_LOOK_CSS}
*, *::before, *::after {
  box-sizing: border-box;
}
[hidden] {
  display: none !important;
}
html, body {
  margin: 0;
  padding: 0;
  background: var(--surface-background, var(--oc-bg, transparent));
  color: var(--surface-foreground, var(--oc-fg, inherit));
  font-family: var(--font-sans, var(--oc-font, system-ui, sans-serif));
  line-height: 1.4;
}
#root {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  min-block-size: 100vh;
}
.ag-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ag-title-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ag-title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.ag-header-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.ag-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.65rem 0.75rem;
  border-radius: var(--radius, var(--oc-radius, 9px));
  border: 1px solid var(--interactive-border, var(--oc-border, rgba(128, 128, 128, 0.22)));
  background: var(--surface-elevated, var(--oc-elevated, rgba(128, 128, 128, 0.06)));
}
.ag-controls-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
  gap: 0.6rem;
  align-items: center;
}
.ag-status-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ag-badges-wrap {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.ag-stats-line {
  font-size: 0.76rem;
  color: var(--surface-muted-foreground, var(--oc-muted, inherit));
  font-variant-numeric: tabular-nums;
}
.ag-filters {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.ag-filter-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ag-search-wrap {
  flex: 1 1 11rem;
  min-inline-size: 0;
}
.ag-list-wrap {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-block-size: 19rem;
  overflow-y: auto;
}
.ag-inspector {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.75rem;
  border-radius: var(--radius, var(--oc-radius, 9px));
  border: 1px solid var(--interactive-border, var(--oc-border, rgba(128, 128, 128, 0.22)));
  background: var(--surface-elevated, var(--oc-elevated, rgba(128, 128, 128, 0.05)));
}
.ag-inspector-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ag-inspector-meta {
  font-size: 0.75rem;
  color: var(--surface-muted-foreground, var(--oc-muted, inherit));
  font-variant-numeric: tabular-nums;
}
.ag-field-block {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.ag-field-label {
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--surface-muted-foreground, var(--oc-muted, inherit));
}
.ag-code-box {
  margin: 0;
  padding: 0.5rem 0.6rem;
  border-radius: calc(var(--radius, var(--oc-radius, 9px)) - 2px);
  border: 1px solid var(--interactive-border, var(--oc-border, rgba(128, 128, 128, 0.2)));
  background: var(--surface-background, var(--oc-bg, transparent));
  font-family: var(--font-mono, var(--oc-mono, ui-monospace, monospace));
  font-size: 0.76rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  max-block-size: 9rem;
  overflow-y: auto;
}
.ag-prose-box {
  margin: 0;
  font-size: 0.82rem;
  line-height: 1.48;
  white-space: pre-wrap;
  word-break: break-word;
}
.ag-kv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: 0.45rem 0.75rem;
  font-size: 0.76rem;
}
.ag-kv-item {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-inline-size: 0;
}
.ag-kv-key {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--surface-muted-foreground, var(--oc-muted, inherit));
}
.ag-kv-val {
  font-family: var(--font-mono, var(--oc-mono, ui-monospace, monospace));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`;

const host = connectHost();
const root = document.querySelector<HTMLElement>("#root")!;

const styleEl = document.createElement("style");
styleEl.textContent = PANEL_STYLES;
document.head.appendChild(styleEl);

let mounted = false;
let currentDirectory: string | null = null;
let currentSessionId: string | null = null;
let snapshot: AutoGateStateSnapshot | null = null;
let loadError: string | null = null;
let actionBusy = false;

let activeVerdictTab: "ALL" | ClassifierVerdict = "ALL";
let searchQuery = "";
let onlyCurrentSession = false;
let selectedEvalId: string | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

// UI Handles
let runtimeBadge: BadgeHandle;
let refreshBtn: ButtonHandle;
let autoModeSwitch: CheckboxHandle;
let fallbackSelect: SelectHandle;
let system1Badge: BadgeHandle;
let breakerBadge: BadgeHandle;
let resetBreakerBtn: ButtonHandle;
let resetBreakerWrap: HTMLDivElement;
let statsLineEl: HTMLDivElement;

let bannerHostEl: HTMLDivElement;
let bannerHandle: BannerHandle | null = null;

let tabsHandle: TabsHandle;
let searchHandle: SearchFieldHandle;
let sessionFilterWrap: HTMLDivElement;
let sessionFilterSwitch: CheckboxHandle;

let listWrapEl: HTMLDivElement;
let listHandle: ListHandle;
let emptyWrapEl: HTMLDivElement;
let emptyHandle: EmptyHandle | null = null;

let inspectorSectionEl: HTMLDivElement;
let inspectorBodyEl: HTMLDivElement;

async function callService<T>(
  method: "GET" | "POST",
  reqPath: string,
  body?: unknown,
): Promise<T> {
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
}

function verdictTone(verdict: ClassifierVerdict): Tone {
  if (verdict === "ALLOW") return "success";
  if (verdict === "BLOCK") return "error";
  return "warning";
}

function riskTone(risk?: string): Tone {
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
}

function formatTime(ts: number): string {
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
}

function formatRelative(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return "";
  const deltaSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (deltaSec < 60) return `${deltaSec}s ago`;
  const mins = Math.round(deltaSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function getFilteredEvaluations(): NormalizedEvalEntry[] {
  const all = snapshot?.evaluations ?? [];
  const q = searchQuery.trim().toLowerCase();
  return all.filter((entry) => {
    if (onlyCurrentSession && currentSessionId && entry.sessionID !== currentSessionId) {
      return false;
    }
    if (activeVerdictTab !== "ALL" && entry.verdict !== activeVerdictTab) {
      return false;
    }
    if (q) {
      const matches =
        entry.toolName.toLowerCase().includes(q) ||
        entry.commandPreview.toLowerCase().includes(q) ||
        entry.commandString.toLowerCase().includes(q) ||
        (entry.reasoning?.toLowerCase().includes(q) ?? false) ||
        (entry.userPrompt?.toLowerCase().includes(q) ?? false) ||
        entry.sessionID.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });
}

async function fetchState(): Promise<void> {
  const params = new URLSearchParams();
  if (currentDirectory) params.set("directory", currentDirectory);
  const qs = params.toString();
  try {
    const next = await callService<AutoGateStateSnapshot>(
      "GET",
      `/api/state${qs ? `?${qs}` : ""}`,
    );
    snapshot = next;
    loadError = null;
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
  }
  render();
}

async function performAction(req: AutoGateActionRequest, toastMsg: string): Promise<void> {
  if (actionBusy) return;
  actionBusy = true;
  render();
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
    await host.toast({ kind: "success", message: toastMsg });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await host.toast({ kind: "error", message });
  } finally {
    actionBusy = false;
    render();
  }
}

function renderBanner(): void {
  if (bannerHandle) {
    bannerHandle.dispose();
    bannerHandle = null;
  }
  bannerHostEl.innerHTML = "";

  if (loadError) {
    bannerHandle = mountBanner(bannerHostEl, {
      tone: "error",
      title: "AutoGate service error",
      body: loadError,
      action: {
        label: "Retry",
        onClick: () => void fetchState(),
      },
    });
    return;
  }

  if (!snapshot) return;

  const awaiting = snapshot.inFlight.filter((item) => item.awaitingReview);
  if (awaiting.length > 0) {
    const first = awaiting[0]!;
    bannerHandle = mountBanner(bannerHostEl, {
      tone: "warning",
      title: `${awaiting.length} action${awaiting.length === 1 ? "" : "s"} awaiting review`,
      body: `${first.toolName}${first.commandString ? `: ${first.commandString}` : ""}`,
    });
    return;
  }

  if (snapshot.breaker.tripped) {
    bannerHandle = mountBanner(bannerHostEl, {
      tone: "error",
      title: `Circuit breaker tripped (${snapshot.breaker.consecutiveBlocks}/${snapshot.breaker.threshold})`,
      body: "Consecutive blocks reached threshold. Actions will route to manual review until reset.",
      action: {
        label: "Reset Breaker",
        onClick: () => void performAction({ action: "resetBreaker" }, "Circuit breaker reset"),
      },
    });
  }
}

function renderInspector(filtered: NormalizedEvalEntry[]): void {
  inspectorBodyEl.innerHTML = "";

  if (filtered.length === 0) {
    inspectorSectionEl.hidden = true;
    return;
  }
  inspectorSectionEl.hidden = false;

  const selected =
    filtered.find((e) => e.id === selectedEvalId) ?? filtered[0] ?? null;
  if (!selected) {
    inspectorSectionEl.hidden = true;
    return;
  }
  selectedEvalId = selected.id;

  const head = document.createElement("div");
  head.className = "ag-inspector-head";

  const badges = document.createElement("div");
  badges.className = "ag-badges-wrap";
  mountBadge(badges, { label: selected.verdict, tone: verdictTone(selected.verdict) });
  if (selected.riskLevel) {
    mountBadge(badges, {
      label: `Risk: ${selected.riskLevel}`,
      tone: riskTone(selected.riskLevel),
    });
  }
  if (selected.userAuthorization) {
    mountBadge(badges, {
      label: `Auth: ${selected.userAuthorization}`,
      tone: "info",
    });
  }
  if (selected.cascade?.winner) {
    mountBadge(badges, {
      label:
        selected.cascade.winner === "system1"
          ? "System 1 fast-path"
          : "System 2 escalated",
      tone: selected.cascade.winner === "system1" ? "primary" : "neutral",
    });
  }

  const meta = document.createElement("span");
  meta.className = "ag-inspector-meta";
  meta.textContent = `${formatTime(selected.timestamp)} · ${selected.durationMs}ms · ${selected.sourceFormat}`;

  head.append(badges, meta);
  inspectorBodyEl.appendChild(head);

  const cmdBlock = document.createElement("div");
  cmdBlock.className = "ag-field-block";
  const cmdLabel = document.createElement("span");
  cmdLabel.className = "ag-field-label";
  cmdLabel.textContent = `Command / Action (${selected.toolName})`;
  const cmdPre = document.createElement("pre");
  cmdPre.className = "ag-code-box";
  cmdPre.textContent = selected.commandPreview || selected.commandString || selected.toolName;
  cmdBlock.append(cmdLabel, cmdPre);
  inspectorBodyEl.appendChild(cmdBlock);

  if (selected.reasoning) {
    const reasonBlock = document.createElement("div");
    reasonBlock.className = "ag-field-block";
    const reasonLabel = document.createElement("span");
    reasonLabel.className = "ag-field-label";
    reasonLabel.textContent = "Reasoning";
    const reasonText = document.createElement("p");
    reasonText.className = "ag-prose-box";
    reasonText.textContent = selected.reasoning;
    reasonBlock.append(reasonLabel, reasonText);
    inspectorBodyEl.appendChild(reasonBlock);
  }

  if (selected.userPrompt) {
    const promptBlock = document.createElement("div");
    promptBlock.className = "ag-field-block";
    const promptLabel = document.createElement("span");
    promptLabel.className = "ag-field-label";
    promptLabel.textContent = "User Prompt";
    const promptText = document.createElement("p");
    promptText.className = "ag-prose-box";
    promptText.textContent = selected.userPrompt;
    promptBlock.append(promptLabel, promptText);
    inspectorBodyEl.appendChild(promptBlock);
  }

  const kvGrid = document.createElement("div");
  kvGrid.className = "ag-kv-grid";
  const addKv = (k: string, v: string): void => {
    const cell = document.createElement("div");
    cell.className = "ag-kv-item";
    const kEl = document.createElement("span");
    kEl.className = "ag-kv-key";
    kEl.textContent = k;
    const vEl = document.createElement("span");
    vEl.className = "ag-kv-val";
    vEl.textContent = v;
    vEl.title = v;
    cell.append(kEl, vEl);
    kvGrid.appendChild(cell);
  };

  addKv("Session", selected.sessionID || "n/a");
  addKv("Latency", `${selected.durationMs} ms`);
  if (selected.model) addKv("Model", selected.model);

  if (selected.cascade) {
    const c = selected.cascade;
    if (c.mode) addKv("Cascade Mode", c.mode);
    if (c.winner) addKv("Winner", c.winner);
    if (c.escalationReason) addKv("Escalation", c.escalationReason);
    if (c.s1LatencyMs !== undefined) addKv("S1 Latency", `${c.s1LatencyMs} ms`);
    if (c.s2LatencyMs !== undefined) addKv("S2 Latency", `${c.s2LatencyMs} ms`);
    if (c.s2Aborted !== undefined) addKv("S2 Aborted", String(c.s2Aborted));
    if (c.inScopeScore !== undefined) addKv("In-Scope", c.inScopeScore.toFixed(3));
    if (c.injectionScore !== undefined) addKv("Injection", c.injectionScore.toFixed(3));
    if (c.s1Probs) {
      const probsSummary = Object.entries(c.s1Probs)
        .map(([k, v]) => `${k}:${v.toFixed(2)}`)
        .join(" ");
      if (probsSummary) addKv("S1 Probs", probsSummary);
    }
  }

  inspectorBodyEl.appendChild(kvGrid);
}

function render(): void {
  if (!mounted) return;

  const cfg = snapshot?.config;
  const runtimesCount = snapshot?.runtimes.length ?? 0;

  runtimeBadge.update({
    label: runtimesCount > 0 ? `${runtimesCount} live` : "Config",
    tone: runtimesCount > 0 ? "info" : "neutral",
  });

  refreshBtn.update({ disabled: actionBusy });

  autoModeSwitch.update({
    checked: cfg?.autoMode ?? true,
    disabled: actionBusy,
  });

  fallbackSelect.update({
    value: cfg?.reviewFallbackMode ?? "ntfy",
    disabled: actionBusy,
  });

  const s1 = snapshot?.systemOneHealth;
  if (!s1 || !s1.enabled) {
    system1Badge.update({ label: "System 1: disabled", tone: "neutral" });
  } else if (s1.reachable) {
    system1Badge.update({
      label: `System 1: ${s1.mode} · reachable`,
      tone: "success",
    });
  } else {
    system1Badge.update({
      label: `System 1: ${s1.mode} · unreachable`,
      tone: "error",
    });
  }

  const breaker = snapshot?.breaker;
  const blocks = breaker?.consecutiveBlocks ?? 0;
  const threshold = breaker?.threshold ?? 3;
  breakerBadge.update({
    label: `Breaker: ${blocks}/${threshold}`,
    tone: breaker?.tripped ? "error" : blocks > 0 ? "warning" : "success",
  });
  resetBreakerWrap.hidden = blocks === 0;
  resetBreakerBtn.update({ disabled: actionBusy || blocks === 0 });

  const stats = snapshot?.stats;
  if (stats && stats.total > 0) {
    statsLineEl.textContent = `${stats.total} evals · ${stats.allow} ALLOW · ${stats.block} BLOCK · ${stats.unsure} UNSURE · avg ${stats.avgLatencyMs}ms · S1 ${stats.s1FastPathPct}%`;
  } else {
    statsLineEl.textContent = cfg
      ? `Log: ${cfg.evalLogFile} · Model: ${cfg.classifierModel}`
      : "Loading AutoGate state…";
  }

  renderBanner();

  const sessionScopedAll = (snapshot?.evaluations ?? []).filter(
    (e) => !onlyCurrentSession || !currentSessionId || e.sessionID === currentSessionId,
  );
  const allowCount = sessionScopedAll.filter((e) => e.verdict === "ALLOW").length;
  const blockCount = sessionScopedAll.filter((e) => e.verdict === "BLOCK").length;
  const unsureCount = sessionScopedAll.filter((e) => e.verdict === "UNSURE").length;

  tabsHandle.update({
    activeId: activeVerdictTab,
    items: [
      { id: "ALL", label: "All", count: sessionScopedAll.length },
      { id: "ALLOW", label: "ALLOW", count: allowCount },
      { id: "BLOCK", label: "BLOCK", count: blockCount },
      { id: "UNSURE", label: "UNSURE", count: unsureCount },
    ],
  });

  sessionFilterWrap.hidden = !currentSessionId;
  sessionFilterSwitch.update({
    checked: onlyCurrentSession && Boolean(currentSessionId),
    disabled: !currentSessionId,
  });

  const filtered = getFilteredEvaluations();

  if (filtered.length === 0) {
    listWrapEl.hidden = true;
    emptyWrapEl.hidden = false;
    if (emptyHandle) {
      emptyHandle.dispose();
      emptyHandle = null;
    }
    const hasFilters = activeVerdictTab !== "ALL" || searchQuery.trim().length > 0 || onlyCurrentSession;
    emptyHandle = mountEmpty(emptyWrapEl, {
      title: snapshot ? "No matching evaluations" : "Loading evaluations…",
      body: hasFilters
        ? "Adjust the verdict tabs, search query, or session toggle to see more entries."
        : "AutoGate evaluation decisions will appear here once permissions are evaluated.",
      ...(hasFilters
        ? {
            action: {
              label: "Clear filters",
              onClick: () => {
                activeVerdictTab = "ALL";
                searchQuery = "";
                onlyCurrentSession = false;
                searchHandle.update({ value: "" });
                render();
              },
            },
          }
        : {}),
    });
  } else {
    emptyWrapEl.hidden = true;
    listWrapEl.hidden = false;
    if (!filtered.some((e) => e.id === selectedEvalId)) {
      selectedEvalId = filtered[0]?.id ?? null;
    }
    const listItems: ListItem[] = filtered.map((entry) => ({
      id: entry.id,
      leading: entry.toolName,
      title: entry.commandPreview || entry.toolName,
      subtitle: `${formatRelative(entry.timestamp)}${entry.cascade?.winner ? ` · ${entry.cascade.winner === "system1" ? "S1" : "S2"}` : ""}${entry.reasoning ? ` · ${entry.reasoning}` : ""}`,
      badge: {
        label: entry.verdict,
        tone: verdictTone(entry.verdict),
      },
      meta: `${entry.durationMs}ms`,
    }));
    listHandle.update({
      items: listItems,
      selectedId: selectedEvalId,
    });
  }

  renderInspector(filtered);
}

function buildDomOnce(): void {
  const header = document.createElement("div");
  header.className = "ag-header";

  const titleGroup = document.createElement("div");
  titleGroup.className = "ag-title-group";
  const h1 = document.createElement("h1");
  h1.className = "ag-title";
  h1.textContent = "AutoGate";
  const badgeWrap = document.createElement("span");
  runtimeBadge = mountBadge(badgeWrap, { label: "Config", tone: "neutral" });
  titleGroup.append(h1, badgeWrap);

  const headerActions = document.createElement("div");
  headerActions.className = "ag-header-actions";
  refreshBtn = mountButton(headerActions, {
    label: "Refresh",
    variant: "outline",
    size: "xs",
    onClick: () => void fetchState(),
  });

  header.append(titleGroup, headerActions);

  const statusCard = document.createElement("div");
  statusCard.className = "ag-card";

  const controlsGrid = document.createElement("div");
  controlsGrid.className = "ag-controls-grid";

  const switchSlot = document.createElement("div");
  autoModeSwitch = mountSwitch(switchSlot, {
    label: "Auto Mode",
    checked: true,
    onChange: (checked) => {
      autoModeSwitch.update({ checked });
      void performAction(
        { action: "setAutoMode", enabled: checked },
        checked ? "Auto Mode enabled" : "Auto Mode set to Manual",
      );
    },
  });

  const selectSlot = document.createElement("div");
  fallbackSelect = mountSelect(selectSlot, {
    label: "Fallback",
    value: "ntfy",
    options: [
      { id: "ntfy", label: "ntfy (Remote)", hint: "Mobile review" },
      { id: "native", label: "native (Terminal)", hint: "Local prompt" },
    ],
    onChange: (nextVal) => {
      const mode: ReviewFallbackMode = nextVal === "native" ? "native" : "ntfy";
      fallbackSelect.update({ value: mode });
      void performAction(
        { action: "setFallbackMode", mode },
        `Fallback set to ${mode}`,
      );
    },
  });

  controlsGrid.append(switchSlot, selectSlot);

  const statusRow = document.createElement("div");
  statusRow.className = "ag-status-row";

  const statusBadges = document.createElement("div");
  statusBadges.className = "ag-badges-wrap";
  system1Badge = mountBadge(statusBadges, { label: "System 1: disabled", tone: "neutral" });
  breakerBadge = mountBadge(statusBadges, { label: "Breaker: 0/3", tone: "success" });

  resetBreakerWrap = document.createElement("div");
  resetBreakerWrap.hidden = true;
  resetBreakerBtn = mountButton(resetBreakerWrap, {
    label: "Reset Breaker",
    variant: "outline",
    size: "xs",
    onClick: () => void performAction({ action: "resetBreaker" }, "Circuit breaker reset"),
  });

  statusRow.append(statusBadges, resetBreakerWrap);

  statsLineEl = document.createElement("div");
  statsLineEl.className = "ag-stats-line";

  statusCard.append(controlsGrid, statusRow, statsLineEl);

  bannerHostEl = document.createElement("div");

  const filters = document.createElement("div");
  filters.className = "ag-filters";

  const tabsWrap = document.createElement("div");
  tabsHandle = mountTabs(tabsWrap, {
    items: [
      { id: "ALL", label: "All", count: 0 },
      { id: "ALLOW", label: "ALLOW", count: 0 },
      { id: "BLOCK", label: "BLOCK", count: 0 },
      { id: "UNSURE", label: "UNSURE", count: 0 },
    ],
    activeId: "ALL",
    trackBackground: true,
    onChange: (nextId) => {
      activeVerdictTab =
        nextId === "ALLOW" || nextId === "BLOCK" || nextId === "UNSURE" ? nextId : "ALL";
      render();
    },
  });

  const filterRow = document.createElement("div");
  filterRow.className = "ag-filter-row";

  const searchWrap = document.createElement("div");
  searchWrap.className = "ag-search-wrap";
  searchHandle = mountSearchField(searchWrap, {
    value: "",
    placeholder: "Search tool, command, reason, session…",
    label: "Filter evaluations",
    onChange: (nextValue) => {
      searchQuery = nextValue;
      searchHandle.update({ value: nextValue });
      render();
    },
  });

  sessionFilterWrap = document.createElement("div");
  sessionFilterWrap.hidden = true;
  sessionFilterSwitch = mountSwitch(sessionFilterWrap, {
    label: "Current session",
    checked: false,
    onChange: (checked) => {
      onlyCurrentSession = checked;
      render();
    },
  });

  filterRow.append(searchWrap, sessionFilterWrap);
  filters.append(tabsWrap, filterRow);

  listWrapEl = document.createElement("div");
  listWrapEl.className = "ag-list-wrap";
  listHandle = mountList(listWrapEl, {
    items: [],
    selectedId: null,
    ariaLabel: "AutoGate evaluation history",
    emptyText: "No evaluations found",
    onSelect: (id) => {
      selectedEvalId = id;
      render();
    },
  });

  emptyWrapEl = document.createElement("div");
  emptyWrapEl.hidden = true;

  inspectorSectionEl = document.createElement("div");
  inspectorSectionEl.hidden = true;
  const sepWrap = document.createElement("div");
  mountSeparator(sepWrap, { label: "Evaluation Detail" });
  inspectorBodyEl = document.createElement("div");
  inspectorBodyEl.className = "ag-inspector";
  inspectorSectionEl.append(sepWrap, inspectorBodyEl);

  root.append(
    header,
    statusCard,
    bannerHostEl,
    filters,
    listWrapEl,
    emptyWrapEl,
    inspectorSectionEl,
  );
}

host.onReady((ctx) => {
  applyHostReady(ctx, document.documentElement);
  currentDirectory = ctx.directory;
  currentSessionId = ctx.session?.id ?? null;

  if (!mounted) {
    mounted = true;
    buildDomOnce();
    void fetchState();
    pollTimer = setInterval(() => {
      void fetchState();
    }, 2500);
  } else {
    render();
  }
});

host.onDirectory((dir) => {
  currentDirectory = dir;
  void fetchState();
});

host.onSession((session) => {
  currentSessionId = session?.id ?? null;
  render();
});

window.addEventListener("unload", () => {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
});
