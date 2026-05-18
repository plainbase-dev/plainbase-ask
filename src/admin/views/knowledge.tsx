import { raw } from "hono/html";
import { getVecDb } from "../../db/vecClient.js";
import {
	getAgent,
	getCrawlSources,
	getCrawlScheduleConfig,
} from "../../db/client.js";
import type { CrawlSource, CrawlInterval } from "../../db/schema.js";
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
	Flash,
	IcnCheck,
	IcnWarn,
	IcnPlus,
	IcnSearch,
	IcnTrash,
} from "./components.js";

interface DocRow {
	id: string;
	filename: string;
	content_type: string;
	uploaded_at: number;
	chunk_count: number;
	source_url: string | null;
	last_crawled_at: number | null;
	char_count: number | null;
	embedding_cost_usd: number | null;
}

// Local icon strings (used in string-template table row builders)
const icnLink = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12" stroke-width="1.8"><path d="M10 14a4 4 0 0 1 0-5.7l3-3a4 4 0 1 1 5.7 5.7l-1.5 1.5"/><path d="M14 10a4 4 0 0 1 0 5.7l-3 3a4 4 0 1 1-5.7-5.7l1.5-1.5"/></svg>`;
const icnPdf = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12" stroke-width="1.8"><path d="M7 3h8l5 5v13H7z"/><path d="M15 3v5h5"/></svg>`;
const icnMd = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12" stroke-width="1.8"><rect x="3" y="6" width="18" height="12" rx="1.5"/><polyline points="6 14 6 10 8 12 10 10 10 14"/><path d="M14 10v4"/><polyline points="13 13 14 14 15 13"/></svg>`;
const icnUpload = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="17" height="17" stroke-width="1.7"><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/><polyline points="8 8 12 4 16 8"/><line x1="12" y1="4" x2="12" y2="15"/></svg>`;
const icnGlobe = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a13 13 0 0 1 0 18a13 13 0 0 1 0-18"/></svg>`;
const icnTrashSm = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.8"><polyline points="4 7 20 7"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>`;
const icnCheckLg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14" stroke-width="1.8"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>`;
const icnStop = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.8"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>`;
const icnClock = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14.5"/></svg>`;
const icnRefresh = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12" stroke-width="1.8"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-5"/></svg>`;

const PAGE_CSS = `
  :root {
    --ok:      oklch(58% 0.13 145);
    --ok-soft: oklch(95% 0.04 145);
    --ok-line: oklch(82% 0.07 145);
  }

  /* ingest grid */
  .ingest-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-bottom: 18px; }
  .ingest-grid .card { margin-bottom: 0; }

  /* drop zone */
  .drop { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 18px; text-align: center; cursor: pointer; border: 1.5px dashed var(--line-strong); border-radius: 9px; background: repeating-linear-gradient(135deg, var(--panel-2) 0 8px, var(--panel) 8px 16px); transition: border-color .12s ease, background .12s ease; }
  .drop:hover { border-color: var(--accent-line); background: var(--accent-soft); }
  .drop input[type=file] { display: none; }
  .dz-icon { width: 36px; height: 36px; border-radius: 9px; border: 1px solid var(--line); background: var(--panel); display: flex; align-items: center; justify-content: center; color: var(--ink-2); box-shadow: 0 1px 0 rgba(20,18,14,.04); }
  .dz-title { font-size: 13px; font-weight: 500; color: var(--ink); }
  .dz-sub { font-size: 12px; color: var(--ink-3); }
  .dz-actions { margin-top: 4px; display: flex; gap: 6px; }
  .drop-meta { margin-top: 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11.5px; color: var(--ink-3); }
  .chip { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--line-2); color: var(--ink-3); font-size: 11px; font-weight: 500; font-family: 'Geist Mono', monospace; }
  .upload-actions { margin-top: 12px; }

  /* crawl form */
  .form-row { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; border-bottom: 1px dashed var(--line-2); }
  .form-row:first-child { padding-top: 0; }
  .form-row:last-child { border-bottom: 0; padding-bottom: 0; }
  .form-row .lbl { font-size: 13px; font-weight: 500; color: var(--ink); }
  .form-row .hint { font-size: 12px; color: var(--ink-3); line-height: 1.42; }
  .input { height: 36px; padding: 0 11px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--panel); font: inherit; font-size: 13.5px; color: var(--ink); width: 100%; transition: border-color .12s ease, box-shadow .12s ease; }
  .input.mono { font-family: 'Geist Mono', monospace; font-size: 13px; }
  .input::placeholder { color: var(--ink-4); }
  .input:hover { border-color: oklch(78% 0.005 85); }
  .input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px oklch(85% 0.06 250 / .35); }
  .field { position: relative; }
  .field .suffix { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 11.5px; color: var(--ink-4); font-family: 'Geist Mono', monospace; pointer-events: none; background: linear-gradient(to right, transparent 0, var(--panel) 8px); padding-left: 8px; }
  .crawl-actions { display: flex; align-items: center; gap: 8px; padding-top: 12px; }

  /* select */
  .select { height: 36px; padding: 0 28px 0 11px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--panel); font: inherit; font-size: 13.5px; color: var(--ink); width: 100%; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 8px center; background-size: 14px; transition: border-color .12s ease, box-shadow .12s ease; }
  .select:hover { border-color: oklch(78% 0.005 85); }
  .select:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px oklch(85% 0.06 250 / .35); }
  .select.sm { height: 28px; font-size: 12px; padding: 0 26px 0 9px; }

  /* buttons */
  .btn.sm { height: 26px; padding: 0 9px; font-size: 12px; border-radius: 6px; }
  .btn.danger { color: var(--danger); border-color: transparent; background: transparent; }
  .btn.danger:hover { background: var(--danger-soft); color: var(--danger); }

  /* crawl status banners */
  .status { margin-bottom: 18px; border-radius: var(--radius); border: 1px solid var(--accent-line); background: var(--accent-soft); padding: 14px 16px 14px 18px; display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; }
  .status .indicator { width: 30px; height: 30px; border-radius: 8px; background: var(--panel); border: 1px solid var(--accent-line); display: flex; align-items: center; justify-content: center; color: var(--accent); flex-shrink: 0; }
  .status .body { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .status .title { font-size: 13.5px; font-weight: 600; color: oklch(30% 0.08 250); letter-spacing: -0.003em; display: flex; align-items: center; gap: 8px; }
  .status .sub { font-size: 12.5px; color: oklch(40% 0.06 250); }
  .status .actions { display: flex; align-items: center; gap: 8px; }
  .status.ok { border-color: var(--ok-line); background: var(--ok-soft); }
  .status.ok .indicator { border-color: var(--ok-line); color: var(--ok); }
  .status.ok .title { color: oklch(30% 0.07 145); }
  .status.ok .sub { color: oklch(38% 0.04 145); }
  .status.err { border-color: var(--danger-line); background: var(--danger-soft); }
  .status.err .indicator { border-color: var(--danger-line); color: var(--danger); }
  .status.err .title { color: oklch(38% 0.16 25); }
  .status.err .sub { color: oklch(45% 0.1 25); }
  .spinner { width: 14px; height: 14px; border-radius: 50%; border: 1.5px solid oklch(85% 0.06 250); border-top-color: var(--accent); animation: spin .9s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); display: inline-block; box-shadow: 0 0 0 0 var(--accent); animation: kbpulse 1.6s ease-out infinite; }
  @keyframes kbpulse { 0%{box-shadow:0 0 0 0 oklch(55% 0.13 250/.55)} 70%{box-shadow:0 0 0 8px oklch(55% 0.13 250/0)} 100%{box-shadow:0 0 0 0 oklch(55% 0.13 250/0)} }

  /* docs toolbar */
  .docs-toolbar { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line-2); background: var(--panel-2); }
  .search-mini { display: flex; align-items: center; gap: 7px; padding: 5px 10px; border: 1px solid var(--line); background: var(--panel); border-radius: 7px; width: 280px; color: var(--ink-3); }
  .search-mini input { border: 0; outline: none; background: transparent; flex: 1; font: inherit; font-size: 13px; color: var(--ink-3); }
  .seg { display: flex; align-items: center; border: 1px solid var(--line); border-radius: 7px; background: var(--panel); padding: 2px; }
  .seg button { appearance: none; border: 0; background: transparent; height: 24px; padding: 0 9px; font: inherit; font-size: 12px; font-weight: 500; color: var(--ink-3); border-radius: 5px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; }
  .seg button.is-active { background: oklch(94% 0.004 85); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line); }
  .seg button .count { font-family: 'Geist Mono', monospace; font-size: 10.5px; color: var(--ink-4); }
  .seg button.is-active .count { color: var(--ink-3); }
  .toolbar-right { margin-left: auto; font-size: 11.5px; color: var(--ink-4); font-family: 'Geist Mono', monospace; }

  /* docs table */
  table.docs { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
  table.docs col.c-source { width: auto; }
  table.docs col.c-type   { width: 90px; }
  table.docs col.c-chunks { width: 80px; }
  table.docs col.c-size   { width: 110px; }
  table.docs col.c-cost   { width: 120px; }
  table.docs col.c-date   { width: 130px; }
  table.docs col.c-act    { width: 50px; }
  table.docs thead th { text-align: left; font-size: 11px; font-weight: 500; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-4); padding: 10px 14px; border-bottom: 1px solid var(--line); background: var(--panel); }
  table.docs thead th.num { text-align: right; }
  table.docs tbody td { padding: 10px 14px; border-bottom: 1px solid var(--line-2); color: var(--ink-2); vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-feature-settings: 'tnum'; }
  table.docs tbody tr:last-child td { border-bottom: 0; }
  table.docs tbody tr:hover td { background: oklch(98% 0.004 85); }
  table.docs tbody td.num { text-align: right; font-family: 'Geist Mono', monospace; font-size: 12.5px; }
  .source-cell { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .source-cell .ico { width: 24px; height: 24px; border-radius: 6px; background: var(--panel-2); border: 1px solid var(--line); display: flex; align-items: center; justify-content: center; color: var(--ink-3); flex-shrink: 0; }
  .source-cell .ico.web { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent); }
  .source-cell .ico.pdf { background: oklch(96% 0.04 25);  border-color: oklch(85% 0.07 25);  color: oklch(50% 0.16 25); }
  .source-cell .ico.md  { background: oklch(96% 0.04 145); border-color: oklch(85% 0.07 145); color: oklch(45% 0.12 145); }
  .source-name { color: var(--ink); font-weight: 450; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; flex: 1; }
  .source-name a { color: inherit; text-decoration: none; }
  .source-name a:hover { text-decoration: underline; }
  .type-pill { display: inline-flex; align-items: center; font-size: 10.5px; font-weight: 500; letter-spacing: .02em; padding: 2px 7px; border-radius: 999px; border: 1px solid var(--line); color: var(--ink-3); background: var(--panel-2); font-family: 'Geist Mono', monospace; }
  .type-pill.web { color: oklch(40% 0.1 250);  background: var(--accent-soft);     border-color: var(--accent-line); }
  .type-pill.pdf { color: oklch(48% 0.16 25);  background: oklch(96% 0.04 25);     border-color: oklch(85% 0.07 25); }
  .type-pill.md  { color: oklch(40% 0.1 145);  background: oklch(96% 0.04 145);    border-color: oklch(85% 0.07 145); }
  .docs-foot { display: flex; align-items: center; gap: 14px; padding: 10px 14px; border-top: 1px solid var(--line-2); color: var(--ink-3); font-size: 12px; background: var(--panel-2); }
  .docs-foot .right { margin-left: auto; font-family: 'Geist Mono', monospace; font-size: 11.5px; color: var(--ink-4); }

  /* crawl sources table */
  table.sources { width: 100%; border-collapse: collapse; font-size: 13px; table-layout: fixed; }
  table.sources col.cs-url      { width: auto; }
  table.sources col.cs-interval { width: 180px; }
  table.sources col.cs-last     { width: 120px; }
  table.sources col.cs-next     { width: 130px; }
  table.sources col.cs-act      { width: 90px; }
  table.sources thead th { text-align: left; font-size: 11px; font-weight: 500; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-4); padding: 10px 14px; border-bottom: 1px solid var(--line); background: var(--panel); }
  table.sources tbody td { padding: 9px 14px; border-bottom: 1px solid var(--line-2); color: var(--ink-2); vertical-align: middle; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  table.sources tbody tr:last-child td { border-bottom: 0; }
  table.sources tbody tr:hover td { background: oklch(98% 0.004 85); }
  .src-actions { display: flex; align-items: center; gap: 5px; justify-content: flex-end; }
  .interval-form { display: flex; align-items: center; gap: 5px; }
  .sources-empty { padding: 28px 20px; text-align: center; color: var(--ink-4); font-size: 13px; }
`;

const UPLOAD_JS = `
(function() {
  var label = document.querySelector('label.drop');
  var input = label && label.querySelector('input[type=file]');
  var title = label && label.querySelector('.dz-title');
  var sub   = label && label.querySelector('.dz-sub');
  if (!label || !input) return;

  function showFile(file) {
    if (!file) return;
    title.textContent = file.name;
    var kb = (file.size / 1024).toFixed(1);
    sub.textContent = kb + ' KB';
    label.style.borderColor = 'var(--accent-line)';
    label.style.background   = 'var(--accent-soft)';
  }

  input.addEventListener('change', function() {
    showFile(input.files && input.files[0]);
  });

  label.addEventListener('dragover', function(e) {
    e.preventDefault();
    label.style.borderColor = 'var(--accent-line)';
    label.style.background   = 'var(--accent-soft)';
  });

  label.addEventListener('dragleave', function() {
    label.style.borderColor = '';
    label.style.background   = '';
  });

  label.addEventListener('drop', function(e) {
    e.preventDefault();
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file) return;
    var dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    showFile(file);
  });
})();
`;

const KB_SEARCH_JS = `
(function() {
  var input = document.getElementById('kb-search');
  var tbody = document.getElementById('docs-tbody');
  var countEl = document.getElementById('docs-count');
  if (!input || !tbody) return;
  input.addEventListener('input', function() {
    var q = input.value.trim().toLowerCase();
    var rows = tbody.querySelectorAll('tr');
    var visible = 0;
    rows.forEach(function(row) {
      var nameEl = row.querySelector('.source-name');
      var text = nameEl ? (nameEl.title || nameEl.textContent || '').toLowerCase() : '';
      var show = !q || text.indexOf(q) !== -1;
      row.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    if (countEl) countEl.textContent = String(visible);
  });
})();
`;

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function fmtSize(chars: number | null): string {
	if (chars == null) return "—";
	if (chars < 1000) return chars + " ch";
	if (chars < 1_000_000)
		return (chars / 1000).toFixed(1).replace(/\.0$/, "") + "k ch";
	return (chars / 1_000_000).toFixed(2) + "M ch";
}

function fmtTs(unix: number, timezone: string): string {
	return new Date(unix * 1000).toLocaleString("en-GB", {
		timeZone: timezone,
		day: "2-digit",
		month: "short",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function fmtDate(unix: number, timezone: string): string {
	return new Date(unix * 1000).toLocaleDateString("en-GB", {
		timeZone: timezone,
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}

function fmtNextCrawl(nextCrawlAt: number | null, timezone: string): string {
	if (nextCrawlAt === null)
		return '<span style="color:var(--ink-4)">—</span>';
	const diffSecs = nextCrawlAt - Math.floor(Date.now() / 1000);
	const abs = escapeHtml(fmtTs(nextCrawlAt, timezone));
	if (diffSecs <= 0)
		return `<span style="color:var(--danger)" title="${abs}">Overdue</span>`;
	if (diffSecs < 3_600)
		return `<span title="${abs}">in ${Math.ceil(diffSecs / 60)} min</span>`;
	if (diffSecs < 86_400)
		return `<span title="${abs}">in ${Math.ceil(diffSecs / 3_600)} h</span>`;
	if (diffSecs < 604_800)
		return `<span title="${abs}">in ${Math.ceil(diffSecs / 86_400)} d</span>`;
	return `<span title="${abs}">${Math.ceil(diffSecs / 86_400)} days</span>`;
}

const INTERVAL_LABELS: Record<CrawlInterval, string> = {
	none: "No rechecking",
	daily: "Daily",
	weekly: "Weekly",
	biweekly: "Biweekly",
	monthly: "Monthly",
};

function intervalOptions(current: CrawlInterval): string {
	return (
		["none", "daily", "weekly", "biweekly", "monthly"] as CrawlInterval[]
	)
		.map(
			(v) =>
				`<option value="${v}"${v === current ? " selected" : ""}>${INTERVAL_LABELS[v]}</option>`,
		)
		.join("");
}

function buildSourceRow(
	s: CrawlSource,
	csrfToken: string,
	timezone: string,
): string {
	const trunc =
		s.start_url.length > 55 ? s.start_url.slice(0, 52) + "…" : s.start_url;
	const lastStr = s.last_crawled_at
		? escapeHtml(fmtTs(s.last_crawled_at, timezone))
		: '<span style="color:var(--ink-4)">Never</span>';
	return `
    <tr>
      <td>
        <div class="source-cell">
          <div class="ico web">${icnGlobe}</div>
          <div class="source-name" title="${escapeHtml(s.start_url)}">
            <a href="${escapeHtml(s.start_url)}" target="_blank" rel="noopener">${escapeHtml(trunc)}</a>
          </div>
        </div>
      </td>
      <td>
        <form class="interval-form" method="POST" action="/admin/knowledge/crawl-source/${s.id}/interval">
          <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}"/>
          <select class="select sm" name="crawl_interval">${intervalOptions(s.crawl_interval)}</select>
          <button class="btn sm" type="submit" title="Save interval">Save</button>
        </form>
      </td>
      <td>${lastStr}</td>
      <td><span style="font-size:12px;display:flex;align-items:center;gap:5px">${icnClock} ${fmtNextCrawl(s.next_crawl_at, timezone)}</span></td>
      <td>
        <div class="src-actions">
          <form method="POST" action="/admin/knowledge/crawl-source/${s.id}/crawl-now" style="display:inline">
            <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}"/>
            <button class="btn sm" type="submit" title="Crawl now">${icnRefresh}</button>
          </form>
          <form method="POST" action="/admin/knowledge/crawl-source/${s.id}/delete" style="display:inline">
            <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}"/>
            <button class="btn danger sm" type="submit" title="Remove source">${icnTrashSm}</button>
          </form>
        </div>
      </td>
    </tr>`;
}

function buildDocRow(d: DocRow, csrfToken: string, timezone: string): string {
	const isWeb = !!d.source_url;
	const type = isWeb
		? "web"
		: d.content_type === "application/pdf"
			? "pdf"
			: "md";
	const label = isWeb
		? "Web"
		: d.content_type === "application/pdf"
			? "PDF"
			: "Markdown";
	const name = d.source_url ?? d.filename;
	const trunc = name.length > 60 ? name.slice(0, 57) + "…" : name;
	const ico = type === "web" ? icnLink : type === "pdf" ? icnPdf : icnMd;
	const srcContent = d.source_url
		? `<a href="${escapeHtml(d.source_url)}" target="_blank" rel="noopener">${escapeHtml(trunc)}</a>`
		: escapeHtml(trunc);
	const costStr =
		d.embedding_cost_usd != null
			? `$${d.embedding_cost_usd.toFixed(6)}`
			: '<span style="color:var(--ink-4)">—</span>';
	const crawledStr = d.last_crawled_at
		? escapeHtml(fmtDate(d.last_crawled_at, timezone))
		: '<span style="color:var(--ink-4)">—</span>';
	return `
    <tr>
      <td>
        <div class="source-cell">
          <div class="ico ${type}">${ico}</div>
          <div class="source-name" title="${escapeHtml(name)}">${srcContent}</div>
        </div>
      </td>
      <td><span class="type-pill ${type}">${label}</span></td>
      <td class="num">${d.chunk_count}</td>
      <td class="num">${fmtSize(d.char_count)}</td>
      <td class="num">${costStr}</td>
      <td>${crawledStr}</td>
      <td style="text-align:right">
        <form method="POST" action="/admin/knowledge/${d.id}/delete" style="display:inline">
          <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}"/>
          <button class="btn danger sm" type="submit" aria-label="Delete document">${icnTrashSm}</button>
        </form>
      </td>
    </tr>`;
}

export async function knowledgeView(
	csrfToken: string,
	error?: string,
	success?: string,
): Promise<string> {
	const agent = getAgent();
	const job = getJob();
	const { timezone } = getCrawlScheduleConfig();
	const crawlSources = getCrawlSources(agent.id);
	let docs: DocRow[] = [];
	let vecError: string | undefined;

	try {
		const vecDb = await getVecDb();
		docs = vecDb
			.prepare(
				`
			SELECT d.id, d.filename, d.content_type, d.uploaded_at,
				d.source_url, d.last_crawled_at, d.char_count, d.embedding_cost_usd,
				(SELECT COUNT(*) FROM chunks c WHERE c.document_id = d.id) as chunk_count
			FROM documents d
			WHERE d.agent_id = ?
			ORDER BY d.uploaded_at DESC
		`,
			)
			.all(agent.id) as DocRow[];
	} catch (e) {
		vecError = e instanceof Error ? e.message : "Vector database error.";
	}

	const totalChunks = docs.reduce((a, b) => a + b.chunk_count, 0);
	const totalChars = docs.reduce((a, b) => a + (b.char_count ?? 0), 0);
	const totalCost = docs.reduce((a, b) => a + (b.embedding_cost_usd ?? 0), 0);

	const corpusValue =
		totalChars >= 1_000_000
			? (totalChars / 1_000_000).toFixed(2)
			: totalChars >= 1000
				? String(Math.round(totalChars / 1000))
				: String(totalChars);
	const corpusUnit =
		totalChars >= 1_000_000
			? "M chars"
			: totalChars >= 1000
				? "k chars"
				: "chars";

	const sourceRows = crawlSources
		.map((s: CrawlSource) => buildSourceRow(s, csrfToken, timezone))
		.join("");
	const tableRows = docs
		.map((d) => buildDocRow(d, csrfToken, timezone))
		.join("");

	return (
		"<!DOCTYPE html>" +
		String(
			<Layout
				title="Knowledge Base"
				currentPath="/admin/knowledge"
				section="Workspace"
				showTitle={false}
			>
				<style>{raw(PAGE_CSS)}</style>
				<PageWrap>
					{error && <Flash variant="err">{error}</Flash>}
					{success && <Flash variant="ok">{success}</Flash>}
					{vecError && <Flash variant="err">{vecError}</Flash>}

					<PageHeader
						title="Knowledge Base"
						subtitle="Documents and pages the assistant can cite when answering. Add sources by uploading a file or pointing the crawler at a help center."
					/>

					<StatStrip cols={4}>
						<StatCard
							label="Documents"
							value={docs.length}
							unit="indexed"
						/>
						<StatCard
							label="Chunks"
							value={totalChunks.toLocaleString()}
							unit="vectors"
						/>
						<StatCard
							label="Corpus size"
							value={corpusValue}
							unit={corpusUnit}
						/>
						<StatCard
							label="Embed spend"
							value={`$${totalCost.toFixed(4)}`}
							unit="USD"
						/>
					</StatStrip>

					{/* Crawl status banner */}
					{job?.status === "running" && (
						<>
							<div class="status" id="crawl-status">
								<div class="indicator">
									<div class="spinner" />
								</div>
								<div class="body">
									<div class="title">
										<span class="pulse" /> Crawl in progress
									</div>
								</div>
								<div class="actions">
									<a
										href="/admin/knowledge/crawl/cancel"
										class="btn sm"
									>
										{raw(icnStop)} Stop
									</a>
								</div>
							</div>
							<script>
								{raw(
									`(function poll(){fetch('/admin/knowledge/crawl/status').then(r=>r.json()).then(function(job){if(job.status==='running'){setTimeout(poll,2000);return;}location.reload();}).catch(function(){setTimeout(poll,3000);});})();`,
								)}
							</script>
						</>
					)}
					{job?.status === "done" && job.result && (
						<div class="status ok">
							<div class="indicator">{raw(icnCheckLg)}</div>
							<div class="body">
								<div class="title">Crawl completed</div>
								<div class="sub">
									<b style="color:oklch(30% 0.07 145)">
										{job.result.ingested +
											job.result.updated}
									</b>{" "}
									pages · {job.result.ingested} ingested ·{" "}
									{job.result.updated} updated ·{" "}
									{job.result.errors} errors
								</div>
							</div>
						</div>
					)}
					{job?.status === "error" && (
						<div class="status err">
							<div class="indicator">{IcnWarn}</div>
							<div class="body">
								<div class="title">Crawl failed</div>
								<div class="sub">
									{job.errorMessage ?? "Crawl failed."}
								</div>
							</div>
						</div>
					)}

					{/* 01 Upload + 02 Crawl (side by side) */}
					<div class="ingest-grid">
						<Card id="upload">
							<CardHead
								num="01"
								title="Upload document"
								desc="Drop a single PDF or Markdown file. The contents are chunked, embedded, and added to the active knowledge base."
							/>
							<CardBody>
								<form
									method="post"
									action="/admin/knowledge"
									enctype="multipart/form-data"
								>
									<input
										type="hidden"
										name="_csrf"
										value={csrfToken}
									/>
									<label class="drop">
										<div class="dz-icon">
											{raw(icnUpload)}
										</div>
										<div class="dz-title">
											Drop a file here, or click to browse
										</div>
										<div class="dz-sub">
											Single file, max 10 MB
										</div>
										<div class="dz-actions">
											<span class="btn sm">
												{IcnPlus} Choose file
											</span>
										</div>
										<input
											type="file"
											name="file"
											accept=".pdf,.md,.txt,application/pdf,text/markdown,text/plain"
											required
										/>
									</label>
									<div class="drop-meta">
										<span>Accepted formats:</span>
										<span class="chip">.pdf</span>
										<span class="chip">.md</span>
									</div>
									<div class="upload-actions">
										<button
											class="btn primary"
											type="submit"
											style="width:100%"
										>
											Upload
										</button>
									</div>
								</form>
								<script>{raw(UPLOAD_JS)}</script>
							</CardBody>
						</Card>

						<Card id="crawl">
							<CardHead
								num="02"
								title="Crawl a website"
								desc={
									<>
										Walks links from the start URL, staying
										on the same domain. Respects{" "}
										<code style="font-family:'Geist Mono',monospace;font-size:11.5px;color:var(--ink-2)">
											robots.txt
										</code>
										.
									</>
								}
							/>
							<CardBody>
								<form
									method="post"
									action="/admin/knowledge/crawl"
								>
									<input
										type="hidden"
										name="_csrf"
										value={csrfToken}
									/>
									<div class="form-row">
										<div class="lbl">Start URL</div>
										<div class="hint">
											Crawl begins here. The crawler will
											only follow links inside the same
											hostname.
										</div>
										<input
											class="input mono"
											type="url"
											name="url"
											placeholder="https://docs.example.com"
											required
										/>
									</div>
									<div class="form-row">
										<div class="lbl">Max pages</div>
										<div class="hint">
											Hard upper bound on crawled URLs.
											Defaults to 50, capped at 200.
										</div>
										<div
											class="field"
											style="max-width:200px"
										>
											<input
												class="input mono"
												type="number"
												name="max_pages"
												value="50"
												min="1"
												max="200"
											/>
											<span class="suffix">pages</span>
										</div>
									</div>
									<div class="form-row">
										<div class="lbl">
											Rechecking interval
										</div>
										<div class="hint">
											How often to automatically re-crawl
											this URL.
										</div>
										<select
											class="select"
											name="crawl_interval"
										>
											<option value="none">
												No rechecking
											</option>
											<option value="daily">Daily</option>
											<option value="weekly">
												Weekly
											</option>
											<option value="biweekly">
												Biweekly
											</option>
											<option value="monthly">
												Monthly
											</option>
										</select>
									</div>
									<div class="crawl-actions">
										<button
											class="btn primary"
											type="submit"
										>
											{raw(icnGlobe)} Start crawl
										</button>
									</div>
								</form>
							</CardBody>
						</Card>
					</div>

					{/* 03 Scheduled sources */}
					<Card id="sources" style="margin-bottom:18px">
						<CardHead
							num="03"
							title="Scheduled sources"
							desc="Crawl URLs registered for automatic re-crawling. The interval and next scheduled run are shown per source."
						/>
						<CardBody flush>
							{crawlSources.length === 0 ? (
								<div class="sources-empty">
									No scheduled sources yet. Use the crawl form
									above to register one.
								</div>
							) : (
								<table class="sources">
									<colgroup>
										<col class="cs-url" />
										<col class="cs-interval" />
										<col class="cs-last" />
										<col class="cs-next" />
										<col class="cs-act" />
									</colgroup>
									<thead>
										<tr>
											<th>Source URL</th>
											<th>Interval</th>
											<th>Last crawled</th>
											<th>Next crawl</th>
											<th></th>
										</tr>
									</thead>
									<tbody>{raw(sourceRows)}</tbody>
								</table>
							)}
						</CardBody>
					</Card>

					{/* 04 Documents */}
					<Card id="docs">
						<CardHead
							num="04"
							title="Documents"
							desc="Every source the bot can cite. Deleting a row immediately removes its embeddings — the bot will stop returning answers from it on the next request."
						/>
						<CardBody flush>
							<div class="docs-toolbar">
								<div class="search-mini">
									{IcnSearch}
									<input
										id="kb-search"
										placeholder="Filter by source name or URL…"
									/>
								</div>
								<div class="seg">
									<button class="is-active" disabled>
										All{" "}
										<span class="count">{docs.length}</span>
									</button>
								</div>
								<div class="toolbar-right">
									{totalChunks.toLocaleString()} chunks · ~
									{Math.round(
										totalChunks * 0.5,
									).toLocaleString()}
									k tokens
								</div>
							</div>
							{docs.length === 0 ? (
								<div style="padding:32px 20px;text-align:center;color:var(--ink-4);font-size:13px">
									No documents uploaded yet.
								</div>
							) : (
								<>
									<table class="docs">
										<colgroup>
											<col class="c-source" />
											<col class="c-type" />
											<col class="c-chunks" />
											<col class="c-size" />
											<col class="c-cost" />
											<col class="c-date" />
											<col class="c-act" />
										</colgroup>
										<thead>
											<tr>
												<th>Source</th>
												<th>Type</th>
												<th class="num">Chunks</th>
												<th class="num">Size</th>
												<th class="num">Embed cost</th>
												<th>Last crawled</th>
												<th></th>
											</tr>
										</thead>
										<tbody id="docs-tbody">
											{raw(tableRows)}
										</tbody>
									</table>
									<div class="docs-foot">
										<span>
											Showing{" "}
											<b
												id="docs-count"
												style="color:var(--ink-2);font-weight:600"
											>
												{docs.length}
											</b>{" "}
											documents
										</span>
										<span class="right">
											total embed spend · $
											{totalCost.toFixed(6)}
										</span>
									</div>
									<script>{raw(KB_SEARCH_JS)}</script>
								</>
							)}
						</CardBody>
					</Card>
				</PageWrap>
			</Layout>,
		)
	);
}
