import { raw } from "hono/html";
import { db, getAgent, getConfig } from "../../db/client.js";
import { getVecDb } from "../../db/vecClient.js";
import { getJob } from "../../crawler/jobs.js";
import { Layout } from "./layout.js";
import {
	PageWrap,
	PageHeader,
	StatStrip,
	StatCard,
	Card,
	CardHead,
	CardBody,
} from "./components.js";

const IcnDot = (color: string) =>
	raw(
		`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${color};flex-shrink:0"></span>`,
	);

const STATUS_CSS = `
  .range-tabs { display:flex; gap:4px; }
  .range-tab {
    height:26px; padding:0 10px; border-radius:5px; font-size:12px; font-weight:500;
    border:1px solid var(--line-strong); background:var(--panel); color:var(--ink-3);
    text-decoration:none; display:inline-flex; align-items:center;
    transition: background .1s, color .1s;
  }
  .range-tab:hover { background:oklch(98% 0.004 85); color:var(--ink); }
  .range-tab.active { background:var(--accent); color:var(--accent-ink); border-color:var(--accent); }

  .status-row { display:flex; align-items:center; gap:10px; padding:12px 20px; border-bottom:1px solid var(--line-2); }
  .status-row:last-child { border-bottom:none; }
  .status-label { font-size:13px; font-weight:500; color:var(--ink-2); min-width:160px; }
  .status-value { font-size:13px; color:var(--ink); display:flex; align-items:center; gap:7px; }
  .status-sub { font-size:12px; color:var(--ink-4); margin-left:auto; }

  .badge-on  { display:inline-flex; align-items:center; gap:5px; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:600; background:oklch(93% 0.05 145); color:oklch(34% 0.1 145); border:1px solid oklch(83% 0.07 145); }
  .badge-off { display:inline-flex; align-items:center; gap:5px; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:600; background:oklch(95% 0.01 0);   color:oklch(52% 0.01 0);   border:1px solid oklch(86% 0.01 0); }
  .badge-running { display:inline-flex; align-items:center; gap:5px; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:600; background:oklch(93% 0.05 250); color:oklch(38% 0.12 250); border:1px solid oklch(83% 0.07 250); }
  .badge-err { display:inline-flex; align-items:center; gap:5px; padding:2px 9px; border-radius:999px; font-size:11px; font-weight:600; background:var(--danger-soft); color:var(--danger); border:1px solid var(--danger-line); }

  .err-filters {
    display:flex; align-items:center; gap:8px; padding:12px 20px;
    border-bottom:1px solid var(--line-2); flex-wrap:wrap;
  }
  .err-filters select {
    height:28px; padding:0 8px; border-radius:5px; font-size:12px;
    border:1px solid var(--line-strong); background:var(--panel); color:var(--ink-2);
    cursor:pointer;
  }
  .err-filters label { font-size:12px; color:var(--ink-3); }
  .err-filters a { font-size:12px; color:var(--ink-3); text-decoration:none; margin-left:4px; }
  .err-filters a:hover { color:var(--ink); }
  .err-msg { font-size:12px; color:var(--ink-2); max-width:60ch; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .err-source { font-size:11px; font-family:'Geist Mono',monospace; color:var(--ink-4); }
  .err-route  { font-size:11px; font-family:'Geist Mono',monospace; color:var(--accent); }
  .err-time   { font-size:11px; color:var(--ink-4); white-space:nowrap; }
`;

function fmt$$(n: number | null): string {
	if (n === null || n === undefined) return "—";
	if (n < 0.00001) return "$0.00";
	if (n < 0.01) return `$${n.toFixed(5)}`;
	return `$${n.toFixed(4)}`;
}

function fmtTokens(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

function fmtTime(unixSec: number | null | undefined): string {
	if (!unixSec) return "—";
	return new Date(unixSec * 1000).toLocaleString();
}

function elapsed(ms: number): string {
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m ${s % 60}s`;
	return `${Math.floor(m / 60)}h ${m % 60}m`;
}

interface RecentError { source: string; route: string; message: string; created_at: number; }

export async function statusView(
	days: number,
	recentErrors: RecentError[] = [],
	errorSources: string[] = [],
	errorRoutes: string[] = [],
	filterSource: string | null = null,
	filterRoute: string | null = null,
): Promise<string> {
	const since = Math.floor(Date.now() / 1000) - days * 86_400;
	const agent = getAgent();
	const config = getConfig();

	// ── Widget ────────────────────────────────────────────────────────────────
	const widgetActive = config["widget_active"] === "1";
	const allowedDomains: string[] = (() => {
		try {
			return JSON.parse(agent.allowed_domains);
		} catch {
			return [];
		}
	})();
	const aiProvider = process.env.AI_PROVIDER ?? "openai";
	const aiModel = process.env.AI_MODEL ?? "(default)";

	// ── Ticketing ─────────────────────────────────────────────────────────────
	const ticketEnabled = config["ticket_enabled"] === "1";
	const ticketEmail = agent.ticket_email || null;

	// ── Costs ─────────────────────────────────────────────────────────────────
	interface CostRow {
		total_cost: number | null;
		calls: number;
		input_tokens: number;
		output_tokens: number;
	}
	const chatCosts = db
		.prepare(
			`
		SELECT
			SUM(cost_usd) as total_cost,
			COUNT(*) as calls,
			SUM(input_tokens) as input_tokens,
			SUM(output_tokens) as output_tokens
		FROM ai_logs
		WHERE created_at >= ?
	`,
		)
		.get(since) as CostRow;

	let embeddingCost: number | null = null;
	try {
		const vecDb = await getVecDb();
		const row = vecDb
			.prepare(
				`SELECT SUM(embedding_cost_usd) as total FROM documents WHERE uploaded_at >= ?`,
			)
			.get(since) as { total: number | null };
		embeddingCost = row?.total ?? null;
	} catch {
		/* vec db not yet initialised */
	}

	const totalCost = (chatCosts.total_cost ?? 0) + (embeddingCost ?? 0);

	// ── Crawlers ──────────────────────────────────────────────────────────────
	interface CrawlSourceRow {
		id: string;
		start_url: string;
		max_pages: number;
		crawl_interval: string;
		last_crawled_at: number | null;
		next_crawl_at: number | null;
	}
	const crawlSources = db
		.prepare(
			`SELECT id, start_url, max_pages, crawl_interval, last_crawled_at, next_crawl_at
		 FROM crawl_sources WHERE agent_id = ? ORDER BY created_at DESC`,
		)
		.all(agent.id) as CrawlSourceRow[];

	const currentJob = getJob();
	const now = Date.now();

	// ── Render ─────────────────────────────────────────────────────────────────

	const rangeTabs = (
		<div class="range-tabs">
			{([7, 30, 90] as const).map((d) => (
				<a
					href={`/admin/status?days=${d}`}
					class={`range-tab${days === d ? " active" : ""}`}
				>
					{d}d
				</a>
			))}
		</div>
	);

	return (
		"<!DOCTYPE html>" +
		String(
			<Layout
				title="Status"
				currentPath="/admin/status"
				showTitle={false}
			>
				<style>{raw(STATUS_CSS)}</style>
				<PageWrap>
					<PageHeader
						title="Status"
						subtitle="Live snapshot of widget, crawlers, ticketing, and AI spend."
					/>

					{/* ── Top stat strip ── */}
					<StatStrip cols={4}>
						<StatCard
							label="Widget"
							value={
								widgetActive ? (
									<span class="badge-on">
										{IcnDot("oklch(52% 0.16 145)")} Active
									</span>
								) : (
									<span class="badge-off">
										{IcnDot("oklch(70% 0.01 0)")} Inactive
									</span>
								)
							}
						/>
						<StatCard
							label="Ticketing"
							value={
								ticketEnabled ? (
									<span class="badge-on">
										{IcnDot("oklch(52% 0.16 145)")} Enabled
									</span>
								) : (
									<span class="badge-off">
										{IcnDot("oklch(70% 0.01 0)")} Disabled
									</span>
								)
							}
						/>
						<StatCard
							label="AI Model"
							value={
								<span class="mono" style="font-size:14px">
									{aiModel}
								</span>
							}
							unit={aiProvider}
						/>
						<StatCard
							label={`Total Cost (${days}d)`}
							value={fmt$$(totalCost > 0 ? totalCost : null)}
						/>
					</StatStrip>

					{/* ── Costs ── */}
					<Card id="costs">
						<CardHead
							title={`AI Spend`}
							desc="Conversation (LLM) and embedding costs over the selected period."
						>
							{rangeTabs}
						</CardHead>
						<CardBody>
							<StatStrip cols={4}>
								<StatCard
									label="Chat Cost"
									value={fmt$$(chatCosts.total_cost)}
								/>
								<StatCard
									label="Embedding Cost"
									value={fmt$$(embeddingCost)}
								/>
								<StatCard
									label="LLM Calls"
									value={chatCosts.calls}
								/>
								<StatCard
									label="Tokens (in / out)"
									value={`${fmtTokens(chatCosts.input_tokens)} / ${fmtTokens(chatCosts.output_tokens)}`}
								/>
							</StatStrip>
						</CardBody>
					</Card>

					{/* ── Widget ── */}
					<Card id="widget">
						<CardHead
							title="Widget"
							desc="Embed status and domain configuration."
						>
							<a href="/admin/widget" class="btn">
								Configure
							</a>
						</CardHead>
						<div>
							<div class="status-row">
								<span class="status-label">Status</span>
								<span class="status-value">
									{widgetActive ? (
										<>
											<span class="badge-on">
												{IcnDot("oklch(52% 0.16 145)")}{" "}
												Active
											</span>
										</>
									) : (
										<>
											<span class="badge-off">
												{IcnDot("oklch(70% 0.01 0)")}{" "}
												Inactive
											</span>
										</>
									)}
								</span>
							</div>
							<div class="status-row">
								<span class="status-label">
									Allowed Domains
								</span>
								<span class="status-value">
									{allowedDomains.length === 0 ? (
										<em style="color:var(--ink-4)">
											None configured
										</em>
									) : (
										allowedDomains.map((d) => (
											<code style="font-size:12px;background:var(--panel-2);border:1px solid var(--line);padding:1px 6px;border-radius:4px">
												{d}
											</code>
										))
									)}
								</span>
							</div>
							<div class="status-row">
								<span class="status-label">
									AI Provider / Model
								</span>
								<span
									class="status-value mono"
									style="font-size:13px"
								>
									{aiProvider} / {aiModel}
								</span>
							</div>
						</div>
					</Card>

					{/* ── Ticketing ── */}
					<Card id="ticketing">
						<CardHead
							title="Ticketing"
							desc="Support ticket escalation settings."
						>
							<a href="/admin/config" class="btn">
								Configure
							</a>
						</CardHead>
						<div>
							<div class="status-row">
								<span class="status-label">Status</span>
								<span class="status-value">
									{ticketEnabled ? (
										<span class="badge-on">
											{IcnDot("oklch(52% 0.16 145)")}{" "}
											Enabled
										</span>
									) : (
										<span class="badge-off">
											{IcnDot("oklch(70% 0.01 0)")}{" "}
											Disabled
										</span>
									)}
								</span>
							</div>
							<div class="status-row">
								<span class="status-label">
									Notification Email
								</span>
								<span class="status-value">
									{ticketEmail ? (
										<code style="font-size:12px;background:var(--panel-2);border:1px solid var(--line);padding:1px 6px;border-radius:4px">
											{ticketEmail}
										</code>
									) : (
										<em style="color:var(--ink-4)">
											Not configured
										</em>
									)}
								</span>
							</div>
						</div>
					</Card>

					{/* ── Crawlers ── */}
					<Card id="crawlers">
						<CardHead
							title="Knowledge Base Crawlers"
							desc="Scheduled web crawl sources and their current state."
						>
							<a href="/admin/knowledge" class="btn">
								Manage
							</a>
						</CardHead>

						{/* Active job banner */}
						{currentJob && currentJob.status === "running" && (
							<div style="padding:10px 20px;border-bottom:1px solid var(--line-2);background:var(--accent-soft);display:flex;align-items:center;gap:10px;font-size:13px">
								<span class="badge-running">
									{IcnDot("oklch(48% 0.18 250)")} Running
								</span>
								<span style="color:var(--ink-2)">
									{currentJob.startUrl}
								</span>
								<span style="color:var(--ink-4);margin-left:auto">
									started{" "}
									{elapsed(now - currentJob.startedAt)} ago
								</span>
							</div>
						)}
						{currentJob && currentJob.status === "done" && (
							<div style="padding:10px 20px;border-bottom:1px solid var(--line-2);background:oklch(96% 0.03 145);display:flex;align-items:center;gap:10px;font-size:13px">
								<span class="badge-on">Done</span>
								<span style="color:var(--ink-2)">
									{currentJob.startUrl}
								</span>
								{currentJob.result && (
									<span style="color:var(--ink-4)">
										{currentJob.result.ingested} new ·{" "}
										{currentJob.result.updated} updated
										{currentJob.result.errors > 0 &&
											` · ${currentJob.result.errors} errors`}
									</span>
								)}
								<span style="color:var(--ink-4);margin-left:auto">
									finished{" "}
									{elapsed(
										now - (currentJob.finishedAt ?? now),
									)}{" "}
									ago
								</span>
							</div>
						)}
						{currentJob && currentJob.status === "error" && (
							<div style="padding:10px 20px;border-bottom:1px solid var(--line-2);background:var(--danger-soft);display:flex;align-items:center;gap:10px;font-size:13px">
								<span class="badge-err">Error</span>
								<span style="color:var(--ink-2)">
									{currentJob.startUrl}
								</span>
								<span style="color:var(--danger)">
									{currentJob.errorMessage}
								</span>
							</div>
						)}

						<CardBody flush>
							{crawlSources.length === 0 ? (
								<p style="padding:16px 20px;color:var(--ink-4);font-size:13px">
									No crawl sources configured.
								</p>
							) : (
								<table>
									<thead>
										<tr>
											<th>URL</th>
											<th>Schedule</th>
											<th>Last Crawled</th>
											<th>Next Crawl</th>
										</tr>
									</thead>
									<tbody>
										{crawlSources.map((src) => {
											const isActiveJob =
												currentJob?.status ===
													"running" &&
												currentJob.startUrl ===
													src.start_url;
											return (
												<tr>
													<td>
														<div style="display:flex;align-items:center;gap:8px">
															{isActiveJob && (
																<span
																	class="badge-running"
																	style="font-size:10px;padding:1px 7px"
																>
																	{IcnDot(
																		"oklch(48% 0.18 250)",
																	)}{" "}
																	Running
																</span>
															)}
															<a
																href={
																	src.start_url
																}
																target="_blank"
																style="font-size:12px;font-family:monospace;color:var(--accent)"
															>
																{src.start_url}
															</a>
														</div>
													</td>
													<td style="font-size:12px">
														{src.crawl_interval ===
														"none" ? (
															<em style="color:var(--ink-4)">
																Manual only
															</em>
														) : (
															src.crawl_interval
														)}
													</td>
													<td style="font-size:12px;color:var(--ink-3)">
														{fmtTime(
															src.last_crawled_at,
														)}
													</td>
													<td style="font-size:12px;color:var(--ink-3)">
														{src.next_crawl_at ? (
															src.next_crawl_at <=
															Math.floor(
																Date.now() /
																	1000,
															) ? (
																<span style="color:var(--warn)">
																	Overdue
																</span>
															) : (
																fmtTime(
																	src.next_crawl_at,
																)
															)
														) : (
															<em style="color:var(--ink-4)">
																—
															</em>
														)}
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							)}
						</CardBody>
					</Card>

					{/* ── Recent Errors ── */}
					<Card id="errors">
						<CardHead
							title="Recent Errors"
							desc="Last 20 errors logged by the system. Use the filters to narrow by source or route."
						/>

						{/* Filter bar */}
						<form method="get" action="/admin/status" class="err-filters">
							<input type="hidden" name="days" value={String(days)} />
							<label for="ef-source">Source</label>
							<select id="ef-source" name="source" onchange="this.form.submit()">
								<option value="">All sources</option>
								{errorSources.map(s => (
									<option value={s} selected={s === filterSource}>{s}</option>
								))}
							</select>
							<label for="ef-route">Route</label>
							<select id="ef-route" name="route" onchange="this.form.submit()">
								<option value="">All routes</option>
								{errorRoutes.map(r => (
									<option value={r} selected={r === filterRoute}>{r}</option>
								))}
							</select>
							{(filterSource || filterRoute) && (
								<a href={`/admin/status?days=${days}`}>Clear filters</a>
							)}
						</form>

						<CardBody flush>
							{recentErrors.length === 0 ? (
								<p style="padding:16px 20px;color:var(--ink-4);font-size:13px">
									{(filterSource || filterRoute) ? 'No errors match the current filters.' : 'No errors recorded.'}
								</p>
							) : (
								<table>
									<thead>
										<tr>
											<th>Source</th>
											<th>Route</th>
											<th>Message</th>
											<th>Time</th>
										</tr>
									</thead>
									<tbody>
										{recentErrors.map(e => (
											<tr>
												<td><span class="err-source">{e.source}</span></td>
												<td><span class="err-route">{e.route}</span></td>
												<td><span class="err-msg" title={e.message}>{e.message}</span></td>
												<td><span class="err-time">{fmtTime(e.created_at)}</span></td>
											</tr>
										))}
									</tbody>
								</table>
							)}
						</CardBody>
					</Card>
				</PageWrap>
			</Layout>,
		)
	);
}
