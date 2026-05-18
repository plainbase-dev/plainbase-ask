import { raw } from 'hono/html';
import { db, getConfig } from '../../db/client.js';
import { getVecDb } from '../../db/vecClient.js';
import { Layout } from './layout.js';
import { PageWrap, PageHeader } from './components.js';

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const DASH_CSS = `
  :root {
    --good: oklch(58% 0.13 145);
    --good-soft: oklch(95% 0.04 145);
    --good-line: oklch(85% 0.06 145);
  }

  /* live pill */
  .pill-live {
    display:inline-flex; align-items:center; gap:5px;
    font-size:10.5px; font-weight:500; letter-spacing:.02em;
    padding:2.5px 8px 2.5px 6px; border-radius:999px;
    border:1px solid var(--good-line);
    color:oklch(38% 0.10 145); background:var(--good-soft);
  }
  .pill-off {
    display:inline-flex; align-items:center; gap:5px;
    font-size:10.5px; font-weight:500; letter-spacing:.02em;
    padding:2.5px 8px 2.5px 6px; border-radius:999px;
    border:1px solid var(--line); color:var(--ink-3); background:var(--panel-2);
  }
  .pill-live .ld {
    width:6px; height:6px; border-radius:50%;
    background:oklch(58% 0.13 145);
    box-shadow:0 0 0 3px oklch(58% 0.13 145 / .18);
    animation:pulse-live 1.6s ease-in-out infinite;
  }
  .pill-off .ld { width:6px; height:6px; border-radius:50%; background:var(--ink-4); }
  @keyframes pulse-live {
    0%,100% { box-shadow:0 0 0 3px oklch(58% 0.13 145 / .18); }
    50%      { box-shadow:0 0 0 6px oklch(58% 0.13 145 / 0); }
  }

  /* KPI grid */
  .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-bottom:18px; }
  .kpi {
    background:var(--panel); border:1px solid var(--line);
    border-radius:var(--radius); padding:14px 16px 10px;
    display:flex; flex-direction:column; gap:6px;
    box-shadow:0 1px 0 rgba(20,18,14,.02);
  }
  .kpi .lbl { font-size:11px; font-weight:500; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-4); }
  .kpi .v {
    font-size:24px; font-weight:600; color:var(--ink);
    letter-spacing:-0.018em; line-height:1.05;
    font-feature-settings:'tnum';
    display:flex; align-items:baseline; gap:5px;
  }
  .kpi .v .unit { font-size:13px; color:var(--ink-3); font-weight:450; font-family:'Geist Mono',monospace; }
  .kpi .row { display:flex; align-items:center; gap:10px; margin-top:auto; padding-top:4px; }
  .delta {
    display:inline-flex; align-items:center; gap:3px;
    font-size:11.5px; font-family:'Geist Mono',monospace;
    font-feature-settings:'tnum'; font-weight:500;
  }
  .delta.up   { color:oklch(45% 0.12 145); }
  .delta.down { color:oklch(48% 0.16 25); }
  .delta.flat { color:var(--ink-3); }
  .delta svg  { width:10px; height:10px; stroke-width:2.2; }
  .delta .ref { color:var(--ink-4); font-weight:400; margin-left:4px; }
  .spark { margin-left:auto; flex-shrink:0; }

  /* dash card (own variant to avoid conflicts with global .card) */
  .dash-card {
    background:var(--panel); border:1px solid var(--line);
    border-radius:var(--radius); overflow:hidden;
    box-shadow:0 1px 0 rgba(20,18,14,.02);
  }
  .dash-card-head {
    padding:14px 18px 12px; border-bottom:1px solid var(--line-2);
    display:flex; align-items:flex-start; gap:14px;
  }
  .dash-card-head h2 { font-size:13.5px; font-weight:600; margin:0 0 2px; letter-spacing:-0.005em; }
  .dash-card-head .desc { color:var(--ink-3); font-size:12px; line-height:1.4; max-width:54ch; }
  .dash-card-head-meta { margin-left:auto; display:flex; align-items:center; gap:8px; flex-shrink:0; }
  .dash-card-foot {
    border-top:1px solid var(--line-2); padding:9px 18px;
    display:flex; align-items:center; gap:8px;
    font-size:12px; color:var(--ink-3);
  }
  .dash-card-foot a { color:var(--ink-2); text-decoration:none; font-weight:500; }
  .dash-card-foot a:hover { color:var(--ink); }
  .dash-card-foot .spacer { flex:1; }

  /* traffic chart */
  .traffic-card { margin-bottom:18px; }
  .traffic-card .legend { display:flex; align-items:center; gap:14px; font-size:11.5px; color:var(--ink-3); }
  .traffic-card .legend .lg { display:inline-flex; align-items:center; gap:6px; }
  .traffic-card .legend .sw { width:9px; height:9px; border-radius:2px; }
  .traffic-card .legend .sw.bar  { background:oklch(78% 0.04 80); }
  .traffic-card .legend .sw.line { background:var(--accent); height:2.5px; border-radius:2px; }

  .chart-body { padding:18px 18px 8px; }
  .chart-svg  { display:block; width:100%; height:220px; }
  .chart-grid line { stroke:var(--line-2); stroke-dasharray:2 3; }
  .chart-bar         { fill:oklch(82% 0.025 80); }
  .chart-bar.weekend { fill:oklch(88% 0.025 80); }
  .chart-line { fill:none; stroke:var(--accent); stroke-width:1.75; stroke-linecap:round; stroke-linejoin:round; }
  .chart-dot  { fill:var(--panel); stroke:var(--accent); stroke-width:1.5; }
  .chart-x-tick { font-family:'Geist Mono',monospace; font-size:10px; fill:var(--ink-4); text-anchor:middle; }
  .chart-y-tick { font-family:'Geist Mono',monospace; font-size:10px; fill:var(--ink-4); text-anchor:end; dominant-baseline:middle; }

  /* two-col grid */
  .grid-2-eq { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px; }

  /* cost breakdown */
  .cost-body   { padding:14px 18px 18px; }
  .cost-total  { display:flex; align-items:baseline; gap:8px; margin-bottom:14px; }
  .cost-total .v {
    font-size:24px; font-weight:600; color:var(--ink);
    letter-spacing:-0.018em; font-feature-settings:'tnum';
  }
  .cost-total .v .cur { font-size:14px; color:var(--ink-3); font-weight:450; margin-right:2px; }
  .cost-stack {
    display:flex; height:10px; border-radius:5px; overflow:hidden;
    margin-bottom:10px; background:var(--line-2);
  }
  .cost-stack > span { display:block; }
  .cost-legend { display:flex; flex-direction:column; gap:7px; }
  .cost-leg-row { display:grid; grid-template-columns:auto 1fr auto auto; align-items:center; gap:10px; font-size:12px; }
  .cost-leg-row .sw { width:8px; height:8px; border-radius:2px; }
  .cost-leg-row .nm { color:var(--ink-2); font-weight:450; }
  .cost-leg-row .nm .sub { color:var(--ink-4); font-family:'Geist Mono',monospace; font-size:11px; margin-left:6px; }
  .cost-leg-row .am { font-family:'Geist Mono',monospace; color:var(--ink); font-feature-settings:'tnum'; font-size:12px; }
  .cost-leg-row .pc { font-family:'Geist Mono',monospace; color:var(--ink-4); font-size:11px; min-width:34px; text-align:right; }

  /* system health */
  .health-list { padding:6px 0; }
  .health-row {
    display:flex; align-items:center; gap:12px;
    padding:9px 18px; border-bottom:1px dashed var(--line-2); font-size:12.5px;
  }
  .health-row:last-child { border-bottom:0; }
  .health-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
  .health-dot.ok   { background:oklch(58% 0.13 145); box-shadow:0 0 0 3px oklch(58% 0.13 145 / .15); }
  .health-dot.warn { background:oklch(72% 0.13 75);  box-shadow:0 0 0 3px oklch(72% 0.13 75  / .15); }
  .health-dot.err  { background:oklch(58% 0.18 25);  box-shadow:0 0 0 3px oklch(58% 0.18 25  / .15); }
  .health-name { color:var(--ink); font-weight:450; flex:1; }
  .health-meta { font-family:'Geist Mono',monospace; color:var(--ink-4); font-size:11px; }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deltaDir(curr: number, prev: number): 'up' | 'down' | 'flat' {
	if (prev === 0) return 'flat';
	const pct = (curr - prev) / prev;
	return pct > 0.0005 ? 'up' : pct < -0.0005 ? 'down' : 'flat';
}

function deltaPct(curr: number, prev: number): string {
	if (prev === 0) return '0.0%';
	const pct = ((curr - prev) / prev) * 100;
	return (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
}

function fmtDateLabel(isoDate: string): string {
	const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	const [, mm, dd] = isoDate.split('-');
	return `${months[parseInt(mm, 10) - 1]} ${parseInt(dd, 10)}`;
}

// ---------------------------------------------------------------------------
// SVG helpers (return plain strings — caller wraps in raw())
// ---------------------------------------------------------------------------

function buildSparkline(data: number[], color: string, fill = false): string {
	if (data.length < 2) return '';
	const W = 80, H = 28;
	const min = Math.min(...data);
	const max = Math.max(...data);
	const range = max - min || 1;
	const stepX = W / (data.length - 1);
	const pts = data.map((v, i) => {
		const x = i * stepX;
		const y = H - 3 - ((v - min) / range) * (H - 6);
		return [x, y] as [number, number];
	});
	const d = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
	const [lx, ly] = pts[pts.length - 1];
	const areaD = fill ? `${d} L${W} ${H} L0 ${H} Z` : '';
	return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="${W}" height="${H}">
    ${fill ? `<path d="${areaD}" fill="${color}" opacity="0.10"/>` : ''}
    <path d="${d}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2" fill="var(--panel)" stroke="${color}" stroke-width="1.3"/>
  </svg>`;
}

interface ChartDay {
	conv: number;
	resolvePct: number;
	weekend: boolean;
	label: string;
}

function buildTrafficChart(days: ChartDay[]): string {
	const W = 1000, H = 220;
	const padL = 38, padR = 46, padT = 16, padB = 28;
	const innerW = W - padL - padR;
	const innerH = H - padT - padB;

	if (days.length === 0) return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}"></svg>`;

	const maxConv = Math.max(...days.map(d => d.conv), 1);
	const yMax = Math.ceil(maxConv / 50) * 50 || 50;
	const yTicks = 4;
	const stepX = innerW / days.length;
	const bw = stepX * 0.68;
	const gap = stepX * 0.16;

	// Left axis (conv count)
	const gridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
		const y = padT + (innerH / yTicks) * i;
		const v = Math.round(yMax - (yMax / yTicks) * i);
		return `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}"/>` +
		       `<text class="chart-y-tick" x="${(padL - 6).toFixed(1)}" y="${y.toFixed(1)}">${v}</text>`;
	}).join('');

	// Bars
	const bars = days.map((d, i) => {
		const h = Math.max(0, (d.conv / yMax) * innerH);
		const x = padL + stepX * i + gap;
		const y = padT + innerH - h;
		return `<rect class="chart-bar${d.weekend ? ' weekend' : ''}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"/>`;
	}).join('');

	// X tick labels (show ~14 evenly)
	const xTicks = days.map((d, i) => {
		if (i % Math.ceil(days.length / 14) !== 0 && i !== days.length - 1) return '';
		const x = padL + stepX * i + stepX / 2;
		return `<text class="chart-x-tick" x="${x.toFixed(1)}" y="${H - 8}">${d.label}</text>`;
	}).join('');

	// Resolved % line (right axis 0–100%)
	const pts = days.map((d, i) => {
		const x = padL + stepX * i + stepX / 2;
		const y = padT + innerH - (d.resolvePct / 100) * innerH;
		return [x, y] as [number, number];
	});
	const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
	const dots = pts.map(([x, y]) => `<circle class="chart-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4"/>`).join('');

	// Right axis ticks (resolved %)
	const rightTicks = [0, 25, 50, 75, 100].map(v => {
		const y = padT + innerH - (v / 100) * innerH;
		return `<text class="chart-y-tick" x="${(W - padR + 6).toFixed(1)}" y="${y.toFixed(1)}" style="text-anchor:start;fill:oklch(56% 0.13 250)">${v}%</text>`;
	}).join('');

	return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <g class="chart-grid">${gridLines}</g>
    ${bars}
    ${xTicks}
    <path class="chart-line" d="${linePath}"/>
    ${dots}
    <g>${rightTicks}</g>
  </svg>`;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

const icnUp   = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="10" height="10" stroke-width="2.2"><polyline points="6 14 12 8 18 14"/></svg>`);
const icnDown = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="10" height="10" stroke-width="2.2"><polyline points="6 10 12 16 18 10"/></svg>`);

function sourceStatus(count: number | undefined): 'ok' | 'warn' | 'err' {
	if (!count)    return 'ok';
	if (count < 4) return 'warn';
	return 'err';
}

export async function dashboardView(errorMap: Record<string, number> = {}): Promise<string> {
	const now   = Math.floor(Date.now() / 1000);
	const d30   = now - 30 * 86_400;
	const d60   = now - 60 * 86_400;

	// ── Widget status ──────────────────────────────────────────────────────────
	const config = getConfig();
	const widgetActive = config['widget_active'] === '1';

	// ── KPI: conversations + resolved ──────────────────────────────────────────
	interface ConvStats { total: number; resolved: number; }

	const currStats = db.prepare(`
		SELECT COUNT(*) as total,
		       COUNT(CASE WHEN t.id IS NULL THEN 1 END) as resolved
		FROM conversations c
		LEFT JOIN tickets t ON t.conversation_id = c.id
		WHERE c.started_at >= ?
	`).get(d30) as ConvStats;

	const prevStats = db.prepare(`
		SELECT COUNT(*) as total,
		       COUNT(CASE WHEN t.id IS NULL THEN 1 END) as resolved
		FROM conversations c
		LEFT JOIN tickets t ON t.conversation_id = c.id
		WHERE c.started_at >= ? AND c.started_at < ?
	`).get(d60, d30) as ConvStats;

	// ── KPI: avg messages ──────────────────────────────────────────────────────
	interface AvgRow { avg_msgs: number | null; }

	const currAvgRow = db.prepare(`
		SELECT AVG(mc) as avg_msgs FROM (
			SELECT COUNT(*) as mc FROM messages m
			JOIN conversations c ON c.id = m.conversation_id
			WHERE c.started_at >= ?
			GROUP BY m.conversation_id
		)
	`).get(d30) as AvgRow;

	const prevAvgRow = db.prepare(`
		SELECT AVG(mc) as avg_msgs FROM (
			SELECT COUNT(*) as mc FROM messages m
			JOIN conversations c ON c.id = m.conversation_id
			WHERE c.started_at >= ? AND c.started_at < ?
			GROUP BY m.conversation_id
		)
	`).get(d60, d30) as AvgRow;

	// ── Daily traffic for chart ────────────────────────────────────────────────
	interface DailyRow { day: string; conv: number; resolved: number; }

	const dailyRows = db.prepare(`
		SELECT
			date(c.started_at, 'unixepoch') as day,
			COUNT(*) as conv,
			COUNT(CASE WHEN t.id IS NULL THEN 1 END) as resolved
		FROM conversations c
		LEFT JOIN tickets t ON t.conversation_id = c.id
		WHERE c.started_at >= ?
		GROUP BY day
		ORDER BY day ASC
	`).all(d30) as DailyRow[];

	const rowMap = new Map(dailyRows.map(r => [r.day, r]));

	const chartDays: ChartDay[] = Array.from({ length: 30 }, (_, i) => {
		const ts  = now - (29 - i) * 86_400;
		const iso = new Date(ts * 1000).toISOString().slice(0, 10);
		const row = rowMap.get(iso);
		const conv     = row?.conv ?? 0;
		const resolved = row?.resolved ?? 0;
		const dow = new Date(ts * 1000).getUTCDay();
		return {
			conv,
			resolvePct: conv > 0 ? (resolved / conv) * 100 : 0,
			weekend: dow === 0 || dow === 6,
			label: fmtDateLabel(iso),
		};
	});

	// ── Cost: last 30d, LLM + embeddings only ─────────────────────────────────
	interface CostRow { total_cost: number | null; }

	const chatCostRow = db.prepare(
		`SELECT SUM(cost_usd) as total_cost FROM ai_logs WHERE created_at >= ?`
	).get(d30) as CostRow;
	const chatCost = chatCostRow.total_cost ?? 0;

	let embCost = 0;
	try {
		const vecDb = await getVecDb();
		const embRow = vecDb.prepare(
			`SELECT SUM(embedding_cost_usd) as total_cost FROM documents WHERE uploaded_at >= ?`
		).get(d30) as CostRow;
		embCost = embRow?.total_cost ?? 0;
	} catch { /* vec db not yet initialised */ }

	const totalCost = chatCost + embCost;

	// ── Derived values ─────────────────────────────────────────────────────────
	const currTotal      = currStats.total;
	const prevTotal      = prevStats.total;
	const currResolvePct = currTotal > 0 ? (currStats.resolved / currTotal) * 100 : 0;
	const prevResolvePct = prevTotal > 0 ? (prevStats.resolved / prevTotal) * 100 : 0;
	const currAvgMsgs    = currAvgRow.avg_msgs ?? 0;
	const prevAvgMsgs    = prevAvgRow.avg_msgs ?? 0;

	const totalChartConvs = chartDays.reduce((s, d) => s + d.conv, 0);

	// Cost breakdown items
	const aiProvider = process.env.AI_PROVIDER ?? 'AI provider';
	const aiModel = process.env.AI_MODEL ?? 'AI model';
	const costItems = [
		{ name: 'Chat completions', sub: aiModel,          amount: chatCost, color: 'oklch(58% 0.14 250)' },
		{ name: 'Embeddings',       sub: 'text embeddings', amount: embCost,  color: 'oklch(62% 0.13 200)' },
	].filter(c => c.amount > 0);
	const totalForPct = costItems.reduce((s, c) => s + c.amount, 0) || 1;

	// Sparkline data arrays
	const convSpark    = chartDays.map(d => d.conv);
	const resolveSpark = chartDays.map(d => d.resolvePct);

	// ── System health driven by last-24h error counts ─────────────────────────
	const knowledgeErrors = (errorMap['knowledge'] ?? 0) + (errorMap['crawler'] ?? 0);
	const healthServices: { name: string; state: 'ok' | 'warn' | 'err'; meta: string }[] = [
		{ name: aiProvider,       state: sourceStatus(errorMap['chat']),    meta: errorMap['chat']    ? `${errorMap['chat']} error${errorMap['chat'] === 1 ? '' : 's'} (24h)` : '' },
		{ name: 'Knowledge base', state: sourceStatus(knowledgeErrors),     meta: knowledgeErrors     ? `${knowledgeErrors} error${knowledgeErrors === 1 ? '' : 's'} (24h)` : '' },
		{ name: 'Ticket routing', state: sourceStatus(errorMap['ticket']),  meta: errorMap['ticket']  ? `${errorMap['ticket']} error${errorMap['ticket'] === 1 ? '' : 's'} (24h)` : '' },
		{ name: 'Web widget',     state: widgetActive ? sourceStatus(errorMap['widget']) : 'warn', meta: widgetActive ? (errorMap['widget'] ? `${errorMap['widget']} error${errorMap['widget'] === 1 ? '' : 's'} (24h)` : 'Active') : 'Inactive' },
		{ name: 'Email relay',    state: sourceStatus(errorMap['email']),   meta: errorMap['email']   ? `${errorMap['email']} error${errorMap['email'] === 1 ? '' : 's'} (24h)` : '' },
	];

	// ── Render ─────────────────────────────────────────────────────────────────
	return '<!DOCTYPE html>' + String(
		<Layout title="Dashboard" currentPath="/admin" section="Workspace" showTitle={false}>
			<style>{raw(DASH_CSS)}</style>
			<PageWrap>
				<PageHeader
					title="Dashboard"
					subtitle="Snapshot of how the assistant is performing across your workspace."
				>
					{widgetActive
						? <span class="pill-live"><span class="ld"></span> Live</span>
						: <span class="pill-off"><span class="ld"></span> Inactive</span>
					}
				</PageHeader>

				{/* ── KPI grid ── */}
				<div class="kpi-grid">
					<div class="kpi">
						<div class="lbl">Conversations</div>
						<div class="v">{currTotal.toLocaleString()}</div>
						<div class="row">
							<span class={`delta ${deltaDir(currTotal, prevTotal)}`}>
								{deltaDir(currTotal, prevTotal) === 'up'   && icnUp}
								{deltaDir(currTotal, prevTotal) === 'down' && icnDown}
								{deltaPct(currTotal, prevTotal)}
								<span class="ref">vs prev 30d</span>
							</span>
							{raw(buildSparkline(convSpark, 'oklch(55% 0.13 250)', true))}
						</div>
					</div>

					<div class="kpi">
						<div class="lbl">Resolved by bot</div>
						<div class="v">{currResolvePct.toFixed(1)}<span class="unit">%</span></div>
						<div class="row">
							<span class={`delta ${deltaDir(currResolvePct, prevResolvePct)}`}>
								{deltaDir(currResolvePct, prevResolvePct) === 'up'   && icnUp}
								{deltaDir(currResolvePct, prevResolvePct) === 'down' && icnDown}
								{deltaPct(currResolvePct, prevResolvePct)}
								<span class="ref">vs prev 30d</span>
							</span>
							{raw(buildSparkline(resolveSpark, 'oklch(58% 0.13 145)'))}
						</div>
					</div>

					<div class="kpi">
						<div class="lbl">Avg. messages / conv</div>
						<div class="v">{currAvgMsgs.toFixed(1)}<span class="unit">msg</span></div>
						<div class="row">
							<span class={`delta ${deltaDir(currAvgMsgs, prevAvgMsgs)}`}>
								{deltaDir(currAvgMsgs, prevAvgMsgs) === 'up'   && icnUp}
								{deltaDir(currAvgMsgs, prevAvgMsgs) === 'down' && icnDown}
								{deltaPct(currAvgMsgs, prevAvgMsgs)}
								<span class="ref">vs prev 30d</span>
							</span>
							{raw(buildSparkline(convSpark, 'oklch(60% 0.13 200)'))}
						</div>
					</div>
				</div>

				{/* ── Traffic chart ── */}
				<div class="dash-card traffic-card">
					<div class="dash-card-head">
						<div>
							<h2>Conversation traffic</h2>
							<div class="desc">Daily volume over the last 30 days, with the share of conversations resolved by the bot overlaid.</div>
						</div>
						<div class="dash-card-head-meta">
							<div class="legend">
								<span class="lg"><span class="sw bar"></span>Conversations</span>
								<span class="lg"><span class="sw line"></span>% resolved</span>
							</div>
						</div>
					</div>
					<div class="chart-body">
						{raw(buildTrafficChart(chartDays))}
					</div>
					<div class="dash-card-foot">
						<span>
							<b style="color:var(--ink);font-weight:600">{totalChartConvs.toLocaleString()}</b>
							{' '}conversations · avg resolved{' '}
							<b style="color:var(--ink);font-weight:600">{currResolvePct.toFixed(1)}%</b>
						</span>
						<span class="spacer"></span>
						<a href="/admin/conversations">Open Conversations →</a>
					</div>
				</div>

				{/* ── Cost + System Health ── */}
				<div class="grid-2-eq">
					{/* Cost */}
					<div class="dash-card">
						<div class="dash-card-head">
							<div>
								<h2>Cost this month</h2>
								<div class="desc">Last 30 days · LLM completions and embeddings.</div>
							</div>
						</div>
						<div class="cost-body">
							<div class="cost-total">
								<div class="v"><span class="cur">$</span>{totalCost.toFixed(2)}</div>
							</div>
							{costItems.length > 0
								? <>
									<div class="cost-stack">
										{costItems.map(c => {
											const pct = (c.amount / totalForPct) * 100;
											return <span style={`width:${pct.toFixed(1)}%;background:${c.color}`}></span>;
										})}
									</div>
									<div class="cost-legend">
										{costItems.map(c => {
											const pct = (c.amount / totalForPct) * 100;
											return (
												<div class="cost-leg-row">
													<span class="sw" style={`background:${c.color}`}></span>
													<span class="nm">{c.name}<span class="sub">{c.sub}</span></span>
													<span class="am">${c.amount.toFixed(2)}</span>
													<span class="pc">{pct.toFixed(0)}%</span>
												</div>
											);
										})}
									</div>
								</>
								: <p style="color:var(--ink-4);font-size:13px;margin-top:8px">No costs in the last 30 days.</p>
							}
						</div>
					</div>

					{/* System Health */}
					<div class="dash-card">
						<div class="dash-card-head">
							<div>
								<h2>System health</h2>
								<div class="desc">Status of upstream services and integrations.</div>
							</div>
						</div>
						<div class="health-list">
							{healthServices.map(s => (
								<div class="health-row">
									<span class={`health-dot ${s.state}`}></span>
									<span class="health-name">{s.name}</span>
									{s.meta && <span class="health-meta">{s.meta}</span>}
								</div>
							))}
						</div>
						<div class="dash-card-foot">
							<span class="spacer"></span>
							<a href="/admin/status">Status page →</a>
						</div>
					</div>
				</div>
			</PageWrap>
		</Layout>
	);
}
