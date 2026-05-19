import { raw } from 'hono/html';
import { db } from '../../db/client.js';
import { Layout } from './layout.js';
import type { Message, AiLog } from '../../db/schema.js';

interface ConvRow {
	id: string;
	user_email: string | null;
	started_at: number;
	message_count: number;
	has_ticket: number;
	snippet: string | null;
	blocked_reason: string | null;
}

export function conversationsView(params: {
	page: number;
	q: string;
	ticket: boolean;
	blocked: boolean;
	selectedId: string | null;
}): string {
	const { page, q, ticket, blocked, selectedId } = params;
	const perPage = 20;
	const offset = (page - 1) * perPage;
	const like = q ? `%${q}%` : null;

	let whereParts = ['1=1'];
	const countParams: (string | number)[] = [];
	const listParams: (string | number)[] = [];

	if (like) {
		whereParts.push(
			'(c.user_email LIKE ? OR c.id LIKE ? OR EXISTS (SELECT 1 FROM messages WHERE conversation_id = c.id AND content LIKE ?))',
		);
		countParams.push(like, like, like);
		listParams.push(like, like, like);
	}
	if (ticket) {
		whereParts.push('EXISTS (SELECT 1 FROM tickets WHERE conversation_id = c.id)');
	}
	if (blocked) {
		whereParts.push('c.blocked_reason IS NOT NULL');
	}

	const where = whereParts.join(' AND ');

	const total = (
		db.prepare(`SELECT COUNT(*) as n FROM conversations c WHERE ${where}`).get(...countParams) as { n: number }
	).n;
	const totalPages = Math.max(1, Math.ceil(total / perPage));

	const convs = db
		.prepare(
			`SELECT c.id, c.user_email, c.started_at, c.blocked_reason,
				(SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
				(SELECT COUNT(*) FROM tickets WHERE conversation_id = c.id) as has_ticket,
				(SELECT content FROM messages WHERE conversation_id = c.id AND role = 'user' ORDER BY created_at ASC LIMIT 1) as snippet
			 FROM conversations c
			 WHERE ${where}
			 ORDER BY c.started_at DESC
			 LIMIT ? OFFSET ?`,
		)
		.all(...listParams, perPage, offset) as ConvRow[];

	const resolvedId = selectedId ?? convs[0]?.id ?? null;

	const filterParams = (overrides: Record<string, string | number | boolean | null>) => {
		const p = new URLSearchParams();
		if ((overrides.q ?? q) !== '') p.set('q', String(overrides.q ?? q));
		const tk = overrides.ticket !== undefined ? overrides.ticket : ticket;
		if (tk) p.set('ticket', '1');
		const bl = overrides.blocked !== undefined ? overrides.blocked : blocked;
		if (bl) p.set('blocked', '1');
		const pg = overrides.page ?? page;
		if (Number(pg) > 1) p.set('page', String(pg));
		const id = overrides.id !== undefined ? overrides.id : resolvedId;
		if (id) p.set('id', String(id));
		const s = p.toString();
		return s ? `?${s}` : '';
	};

	const filterBar = `
    <form class="filterbar" method="GET" action="/admin/conversations" id="conv-filter-form">
      <input type="hidden" name="id" value="${resolvedId ? escapeHtml(resolvedId) : ''}" />
      <div class="fb-count">
        <span class="fb-num">${total.toLocaleString()}</span>
        <span class="fb-lbl">conversations</span>
      </div>
      <div class="fb-search">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14" stroke-width="1.8"><circle cx="11" cy="11" r="6"/><line x1="20" y1="20" x2="15.5" y2="15.5"/></svg>
        <input type="search" name="q" value="${escapeHtml(q)}" placeholder="Search by email, ID, or message…" autocomplete="off" />
      </div>
      <button type="submit" name="ticket" value="${ticket ? '' : '1'}" class="fb-chip${ticket ? ' active' : ''}" formnovalidate>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.8"><path d="M3 10a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0a2 2 0 0 0 0 4v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v0a2 2 0 0 0 0-4z"/><line x1="14" y1="8" x2="14" y2="16" stroke-dasharray="2 2"/></svg>
        Ticket <span class="fb-chip-v">${ticket ? 'on' : 'any'}</span>
      </button>
      <button type="submit" name="blocked" value="${blocked ? '' : '1'}" class="fb-chip${blocked ? ' active' : ''}" formnovalidate>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        Blocked <span class="fb-chip-v">${blocked ? 'on' : 'any'}</span>
      </button>
    </form>
  `;

	const relTime = (ts: number) => {
		const diff = Date.now() / 1000 - ts;
		if (diff < 60) return 'just now';
		if (diff < 3600) return `${Math.floor(diff / 60)}m`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
		if (diff < 172800) return 'yesterday';
		return new Date(ts * 1000).toLocaleDateString();
	};

	const blockedReasonLabel: Record<string, string> = {
		message_limit: 'Msg limit',
		cost_limit: 'Cost limit',
	};

	const listItems = convs.map(c => {
		const href = `/admin/conversations${filterParams({ id: c.id, page })}`;
		const isActive = c.id === resolvedId;
		const snippetText = c.snippet ? escapeHtml(c.snippet.slice(0, 90)) : '';
		const msgIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="11" height="11" stroke-width="1.7"><path d="M5 5h14v10H10l-5 4V5z"/></svg>`;
		const ticketIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="11" height="11" stroke-width="1.7"><path d="M3 10a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0a2 2 0 0 0 0 4v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v0a2 2 0 0 0 0-4z"/><line x1="14" y1="8" x2="14" y2="16" stroke-dasharray="2 2"/></svg>`;
		const blockedIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="11" height="11" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
		const blockedLabel = c.blocked_reason ? (blockedReasonLabel[c.blocked_reason] ?? c.blocked_reason) : null;
		return `
      <a href="${href}" class="ci${isActive ? ' active' : ''}">
        <div class="ci-row1">
          <div class="ci-email${c.user_email ? '' : ' anon'}">${c.user_email ? escapeHtml(c.user_email) : 'anonymous'}</div>
          <div class="ci-time">${relTime(c.started_at)}</div>
        </div>
        ${snippetText ? `<div class="ci-snippet">${snippetText}</div>` : ''}
        <div class="ci-meta">
          <span class="ci-id">${c.id.slice(0, 8)}</span>
          <span class="ci-dot">·</span>
          <span class="ci-msgs">${msgIcon} ${c.message_count}</span>
          ${c.has_ticket ? `<span class="ci-ticket">${ticketIcon} Ticket</span>` : ''}
          ${blockedLabel ? `<span class="ci-blocked">${blockedIcon} ${escapeHtml(blockedLabel)}</span>` : ''}
        </div>
      </a>
    `;
	}).join('');

	const prevHref = page > 1 ? `/admin/conversations${filterParams({ page: page - 1 })}` : null;
	const nextHref = page < totalPages ? `/admin/conversations${filterParams({ page: page + 1 })}` : null;

	const convList = `
    <aside class="convlist">
      <div class="ci-scroll">
        ${convs.length ? listItems : '<div style="padding:24px 16px;font-size:13px;color:var(--ink-4)">No conversations found.</div>'}
      </div>
      <div class="cl-foot">
        <span class="cl-page">Page ${page} of ${totalPages}</span>
        <div style="margin-left:auto;display:flex;gap:4px">
          ${prevHref
		? `<a href="${prevHref}" class="pg-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14" stroke-width="2"><polyline points="14 6 8 12 14 18"/></svg></a>`
		: `<span class="pg-btn disabled"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14" stroke-width="2"><polyline points="14 6 8 12 14 18"/></svg></span>`}
          ${nextHref
		? `<a href="${nextHref}" class="pg-btn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14" stroke-width="2"><polyline points="10 6 16 12 10 18"/></svg></a>`
		: `<span class="pg-btn disabled"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14" stroke-width="2"><polyline points="10 6 16 12 10 18"/></svg></span>`}
        </div>
      </div>
    </aside>
  `;

	const detailPane = resolvedId
		? (convDetailHtml(resolvedId) ?? emptyDetail())
		: emptyDetail();

	const crumbId = resolvedId ? resolvedId.slice(0, 8) : null;
	const titleText = crumbId ? `Conversations / ${crumbId}` : 'Conversations';

	const innerContent = `
    <div class="conv-wrap">
      ${filterBar}
      <div class="conv-split">
        ${convList}
        <div class="conv-detail">
          ${detailPane}
        </div>
      </div>
    </div>
    <script>
      (function() {
        function setupTabs(root) {
          root.querySelectorAll('.conv-tab').forEach(function(t) {
            t.addEventListener('click', function() {
              var name = t.dataset.tab;
              root.querySelectorAll('.conv-tab').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === name); });
              var msgs = root.querySelector('#tab-messages');
              var logs = root.querySelector('#tab-logs');
              if (msgs) msgs.style.display = name === 'messages' ? '' : 'none';
              if (logs) logs.style.display = name === 'logs' ? '' : 'none';
            });
          });
        }

        setupTabs(document);

        var form = document.getElementById('conv-filter-form');
        var inp = form.querySelector('input[name="q"]');
        var timer;
        inp.addEventListener('input', function() {
          clearTimeout(timer);
          timer = setTimeout(function() {
            form.querySelector('input[name="id"]').value = '';
            form.submit();
          }, 400);
        });

        var detail = document.querySelector('.conv-detail');
        document.querySelectorAll('.ci').forEach(function(link) {
          link.addEventListener('click', function(e) {
            e.preventDefault();
            var href = link.getAttribute('href');
            var id = new URL(href, location.href).searchParams.get('id');
            if (!id) return;
            document.querySelectorAll('.ci').forEach(function(l) { l.classList.remove('active'); });
            link.classList.add('active');
            history.pushState({}, '', href);
            form.querySelector('input[name="id"]').value = id;
            fetch('/admin/conversations/detail?id=' + encodeURIComponent(id))
              .then(function(r) { return r.text(); })
              .then(function(html) {
                detail.innerHTML = html;
                setupTabs(detail);
              });
          });
        });
      })();
    </script>
  `;

	return '<!DOCTYPE html>' + String(
		<Layout title={titleText} currentPath="/admin/conversations" showTitle={false}>
			{raw(pageStyles())}
			{raw(innerContent)}
		</Layout>,
	);
}

export function convDetailFragment(id: string | null): string {
	if (!id) return emptyDetail();
	return convDetailHtml(id) ?? emptyDetail();
}

function emptyDetail(): string {
	return `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="32" height="32" stroke-width="1.4" style="color:var(--ink-4);margin-bottom:12px"><path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1 4.5A8 8 0 0 1 21 12z"/></svg>
      <h3>Select a conversation</h3>
      <p>Pick a row on the left to read the message thread and inspect the AI calls behind each reply.</p>
    </div>
  `;
}

function convDetailHtml(id: string): string | null {
	const conv = db.prepare(
		'SELECT id, user_email, started_at FROM conversations WHERE id = ?',
	).get(id) as { id: string; user_email: string | null; started_at: number } | undefined;

	if (!conv) return null;

	const messages = db.prepare(
		'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
	).all(id) as Message[];

	const ticket = db.prepare(
		'SELECT user_email, created_at FROM tickets WHERE conversation_id = ?',
	).get(id) as { user_email: string; created_at: number } | undefined;

	const logs = db.prepare(
		'SELECT * FROM ai_logs WHERE conversation_id = ? ORDER BY created_at ASC',
	).all(id) as AiLog[];

	const msgHtml = messages.map(m => `
    <div class="msg msg-${m.role}">
      <div class="msg-head">
        <span class="msg-role role-${m.role}">${m.role}</span>
        ${m.ticket_triggered ? '<span class="trigger-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="10" height="10" stroke-width="1.8"><path d="M3 10a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v0a2 2 0 0 0 0 4v0a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v0a2 2 0 0 0 0-4z"/><line x1="14" y1="8" x2="14" y2="16" stroke-dasharray="2 2"/></svg> Ticket trigger</span>' : ''}
      </div>
      <div class="msg-body">${escapeHtml(m.content)}</div>
    </div>
  `).join('<div class="msg-divider"></div>');

	const totalIn   = logs.reduce((s, l) => s + l.input_tokens, 0);
	const totalOut  = logs.reduce((s, l) => s + l.output_tokens, 0);
	const totalCost = logs.reduce((s, l) => s + (l.cost_usd ?? 0), 0);

	const logsStats = logs.length ? `
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-v">${logs.length}</div><div class="stat-l">LLM calls</div></div>
      <div class="stat-card"><div class="stat-v">${totalIn.toLocaleString()}</div><div class="stat-l">Input tokens</div></div>
      <div class="stat-card"><div class="stat-v">${totalOut.toLocaleString()}</div><div class="stat-l">Output tokens</div></div>
      <div class="stat-card"><div class="stat-v">${formatCost(totalCost)}</div><div class="stat-l">Est. cost</div></div>
    </div>
  ` : '';

	const logsRows = logs.length
		? logs.map(l => logRow(l)).join('')
		: '<div style="padding:20px;font-size:13px;color:var(--ink-4)">No AI calls logged for this conversation.</div>';

	return `
    <div class="detail-head">
      <div style="min-width:0">
        <h2 class="detail-title">
          ${conv.user_email ? escapeHtml(conv.user_email) : 'Anonymous visitor'}
          <span class="detail-id">${conv.id.slice(0, 8)}</span>
        </h2>
        <div class="detail-meta">
          <span>${new Date(conv.started_at * 1000).toLocaleString()}</span>
          <span class="meta-dot">·</span>
          <span>${messages.length} messages</span>
          ${conv.user_email ? `<span class="meta-dot">·</span><span>${escapeHtml(conv.user_email)}</span>` : ''}
          ${ticket ? `<span class="meta-dot">·</span><span class="badge badge-blue">Ticket by ${escapeHtml(ticket.user_email)}</span>` : ''}
        </div>
      </div>
    </div>

    <div class="detail-tabs">
      <button class="conv-tab active" data-tab="messages">
        Messages <span class="tab-ct">${messages.length}</span>
      </button>
      <button class="conv-tab" data-tab="logs">
        AI Logs <span class="tab-ct">${logs.length}</span>
      </button>
    </div>

    <div id="tab-messages" class="tab-body">
      ${msgHtml || '<div style="padding:20px;font-size:13px;color:var(--ink-4)">No messages.</div>'}
    </div>

    <div id="tab-logs" class="tab-body" style="display:none">
      ${logsStats}
      <div class="logs-table-wrap">
        <div class="logs-thead">
          <span>Time</span><span>Model</span>
          <span class="nr">In</span><span class="nr">Out</span><span class="nr">Thinking</span><span class="nr">Cost</span>
          <span></span>
        </div>
        ${logsRows}
      </div>
    </div>
  `;
}

function logRow(l: AiLog): string {
	let messages: Array<{ role: string; content: unknown }> = [];
	let steps: Array<{ text?: string; toolCalls?: unknown[]; toolResults?: unknown[] }> = [];
	try { messages = JSON.parse(l.messages); } catch { /* empty */ }
	try { steps = JSON.parse(l.steps); } catch { /* empty */ }

	const messagesHtml = messages.map(m => `
    <div class="log-msg">
      <div class="log-msg-head">
        <span class="log-role role-${m.role}">${escapeHtml(String(m.role))}</span>
        <span style="font-size:11px;color:var(--ink-4)">${typeof m.content === 'string' ? m.content.length.toLocaleString() : 0} chars</span>
      </div>
      <pre class="log-pre">${escapeHtml(typeof m.content === 'string' ? (m.content.length > 500 ? m.content.slice(0, 500) + '\n…' : m.content) : JSON.stringify(m.content, null, 2))}</pre>
    </div>
  `).join('');

	const stepsHtml = steps.length === 0
		? '<p style="color:var(--ink-4);font-size:12px">No tool calls.</p>'
		: steps.map((s, i) => {
			const toolName = (s.toolCalls?.[0] as { name?: string } | undefined)?.name ?? 'tool';
			return `
          <div class="step-block">
            <div class="step-head">
              <span class="step-n">step ${String(i + 1).padStart(2, '0')}</span>
              <span>${escapeHtml(toolName)}</span>
              <span class="step-tag">tool</span>
            </div>
            <div class="step-body">
              ${s.toolCalls?.length ? `<div class="step-half"><h5>Tool call</h5><pre class="log-pre">${escapeHtml(JSON.stringify(s.toolCalls[0], null, 2))}</pre></div>` : ''}
              ${s.toolResults?.length ? `<div class="step-half b-left"><h5>Tool result</h5><pre class="log-pre">${escapeHtml(JSON.stringify(s.toolResults[0], null, 2))}</pre></div>` : ''}
            </div>
            ${s.text ? `<div class="step-text"><h5>Text output</h5><pre class="log-pre">${escapeHtml(s.text)}</pre></div>` : ''}
          </div>
        `;
		}).join('');

	const ts = new Date(l.created_at * 1000).toLocaleTimeString();
	const thinking = l.thinking_tokens > 0 ? l.thinking_tokens.toLocaleString() : '<span class="dash">—</span>';

	return `
    <details class="log-row">
      <summary class="log-summary">
        <span class="mono" style="font-size:12px">${ts}</span>
        <span style="font-size:12px;color:var(--ink-3)">${escapeHtml(l.model)}</span>
        <span class="nr">${l.input_tokens.toLocaleString()}</span>
        <span class="nr">${l.output_tokens.toLocaleString()}</span>
        <span class="nr">${thinking}</span>
        <span class="nr">${formatCost(l.cost_usd)}</span>
        <span style="text-align:right"><span class="log-toggle-btn">View</span></span>
      </summary>
      <div class="log-expand">
        <div class="log-section">
          <h4 class="log-sh">System prompt</h4>
          <pre class="log-pre">${escapeHtml(l.system_prompt)}</pre>
        </div>
        <div class="log-section">
          <h4 class="log-sh">Messages sent to LLM <span class="log-sh-meta">· ${messages.length} messages</span></h4>
          ${messagesHtml || '<p style="color:var(--ink-4);font-size:12px">No messages.</p>'}
        </div>
        <div class="log-section">
          <h4 class="log-sh">Tool call steps <span class="log-sh-meta">· ${steps.length} step${steps.length !== 1 ? 's' : ''}</span></h4>
          ${stepsHtml}
        </div>
        <div class="log-section" style="margin-bottom:0">
          <h4 class="log-sh">Response</h4>
          <pre class="log-pre">${escapeHtml(l.response_text || '(empty)')}</pre>
        </div>
      </div>
    </details>
  `;
}

function formatCost(cost: number | null): string {
	if (cost === null || cost === 0) return '<span class="dash">—</span>';
	if (cost < 0.0001) return '&lt;$0.0001';
	return `$${cost.toFixed(4)}`;
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function pageStyles(): string {
	return `<style>
  .main { height: 100vh; }
  #main-content { flex: 1; padding: 0 !important; display: flex; flex-direction: column; overflow: hidden; }
  .conv-wrap { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
  .filterbar { flex-shrink: 0; display: flex; align-items: center; gap: 10px; padding: 10px 20px; border-bottom: 1px solid var(--line); background: var(--canvas); }
  .fb-count { display: flex; align-items: baseline; gap: 5px; flex-shrink: 0; }
  .fb-num { font-size: 15px; font-weight: 700; color: var(--ink); }
  .fb-lbl { font-size: 12px; color: var(--ink-4); }
  .fb-search { display: flex; align-items: center; gap: 8px; background: var(--panel); border: 1px solid var(--line-strong); border-radius: var(--radius-sm); padding: 0 10px; height: 32px; flex: 1; max-width: 360px; }
  .fb-search svg { color: var(--ink-4); flex-shrink: 0; }
  .fb-search input { border: none; background: transparent; font: inherit; font-size: 13px; color: var(--ink); outline: none; width: 100%; }
  .fb-chip { appearance: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: var(--radius-sm); font: inherit; font-size: 13px; font-weight: 500; color: var(--ink-3); background: var(--panel); border: 1px solid var(--line-strong); transition: background .12s, color .12s; }
  .fb-chip:hover { background: var(--panel-2); color: var(--ink); }
  .fb-chip.active { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent); }
  .fb-chip-v { font-size: 11px; color: var(--ink-4); }
  .fb-chip.active .fb-chip-v { color: var(--accent); }
  .conv-split { display: grid; grid-template-columns: 320px 1fr; flex: 1; min-height: 0; overflow: hidden; }
  .convlist { display: flex; flex-direction: column; border-right: 1px solid var(--line); overflow: hidden; }
  .ci-scroll { flex: 1; overflow-y: auto; }
  .ci { display: block; padding: 11px 14px; border-bottom: 1px solid var(--line-2); text-decoration: none; transition: background .1s; }
  .ci:hover { background: var(--panel-2); }
  .ci.active { background: var(--accent-soft); border-left: 2px solid var(--accent); padding-left: 12px; }
  .ci-row1 { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; }
  .ci-email { font-size: 13px; font-weight: 500; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ci-email.anon { color: var(--ink-4); font-style: italic; }
  .ci.active .ci-email { color: var(--accent); }
  .ci-time { font-size: 11px; color: var(--ink-4); flex-shrink: 0; margin-left: 8px; }
  .ci-snippet { font-size: 12px; color: var(--ink-3); line-height: 1.4; margin-bottom: 5px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .ci-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--ink-4); }
  .ci-id { font-family: 'Geist Mono', monospace; }
  .ci-dot { color: var(--line-strong); }
  .ci-msgs { display: inline-flex; align-items: center; gap: 3px; }
  .ci-ticket { display: inline-flex; align-items: center; gap: 3px; color: oklch(38% 0.12 250); background: oklch(92% 0.05 250); border-radius: 3px; padding: 0 4px; font-size: 10px; font-weight: 600; }
  .ci-blocked { display: inline-flex; align-items: center; gap: 3px; color: oklch(40% 0.15 25); background: oklch(93% 0.06 25); border-radius: 3px; padding: 0 4px; font-size: 10px; font-weight: 600; }
  .cl-foot { flex-shrink: 0; display: flex; align-items: center; padding: 8px 14px; border-top: 1px solid var(--line); background: var(--canvas); }
  .cl-page { font-size: 12px; color: var(--ink-4); }
  .pg-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 5px; color: var(--ink-3); text-decoration: none; border: 1px solid var(--line-strong); background: var(--panel); transition: background .1s; }
  .pg-btn:hover { background: var(--panel-2); color: var(--ink); }
  .pg-btn.disabled { color: var(--line-strong); border-color: var(--line); cursor: default; background: transparent; }
  .conv-detail { display: flex; flex-direction: column; overflow: hidden; }
  .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--ink-3); text-align: center; padding: 40px; }
  .empty-state h3 { font-size: 15px; font-weight: 600; color: var(--ink-2); margin-bottom: 6px; }
  .empty-state p { font-size: 13px; color: var(--ink-4); max-width: 280px; line-height: 1.5; }
  .detail-head { padding: 16px 20px 0; flex-shrink: 0; border-bottom: 1px solid var(--line); }
  .detail-title { font-size: 15px; font-weight: 600; color: var(--ink); margin-bottom: 5px; }
  .detail-id { font-family: 'Geist Mono', monospace; font-size: 11px; font-weight: 400; color: var(--ink-4); margin-left: 8px; }
  .detail-meta { display: flex; flex-wrap: wrap; gap: 8px; font-size: 12px; color: var(--ink-3); margin-bottom: 12px; }
  .meta-dot { color: var(--line-strong); }
  .detail-tabs { display: flex; border-bottom: 1px solid var(--line); flex-shrink: 0; padding: 0 20px; }
  .conv-tab { appearance: none; border: 0; background: none; cursor: pointer; font: inherit; font-size: 13px; font-weight: 500; color: var(--ink-3); padding: 10px 14px; border-bottom: 2px solid transparent; margin-bottom: -1px; display: inline-flex; align-items: center; gap: 6px; transition: color .12s; }
  .conv-tab:hover { color: var(--ink); }
  .conv-tab.active { color: var(--ink); border-bottom-color: var(--accent); }
  .tab-ct { font-size: 11px; padding: 1px 6px; border-radius: 999px; background: var(--panel-2); border: 1px solid var(--line); color: var(--ink-3); }
  .conv-tab.active .tab-ct { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent); }
  .tab-body { flex: 1; overflow-y: auto; padding: 20px; }
  .msg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 5px; }
  .msg-role { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; padding: 2px 7px; border-radius: 3px; border: 1px solid var(--line); background: var(--panel-2); color: var(--ink-3); }
  .msg-role.role-user { background: var(--accent-soft); border-color: var(--accent-line); color: var(--accent); }
  .msg-body { white-space: pre-wrap; font-size: 13px; line-height: 1.6; color: var(--ink-2); }
  .msg-divider { border: none; border-top: 1px solid var(--line-2); margin: 14px 0; }
  .trigger-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 500; color: oklch(38% 0.12 250); background: oklch(92% 0.05 250); border-radius: 3px; padding: 2px 6px; }
  .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; margin-bottom: 18px; }
  .stat-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 11px 14px; }
  .stat-v { font-size: 18px; font-weight: 700; color: var(--ink); }
  .stat-l { font-size: 11px; color: var(--ink-4); margin-top: 2px; }
  .logs-table-wrap { border: 1px solid var(--line); border-radius: var(--radius-sm); overflow: hidden; }
  .logs-thead { display: grid; grid-template-columns: 90px 1fr 64px 64px 78px 84px 52px; padding: 7px 12px; background: var(--panel-2); border-bottom: 1px solid var(--line); font-size: 10px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-4); }
  .log-row { border-bottom: 1px solid var(--line); }
  .log-row:last-child { border-bottom: none; }
  .log-summary { display: grid; grid-template-columns: 90px 1fr 64px 64px 78px 84px 52px; align-items: center; padding: 9px 12px; cursor: pointer; list-style: none; user-select: none; font-size: 13px; color: var(--ink-2); }
  .log-summary::-webkit-details-marker { display: none; }
  .log-summary:hover { background: var(--panel-2); }
  details[open] > .log-summary { background: var(--accent-soft); }
  .nr { text-align: right; font-variant-numeric: tabular-nums; }
  .dash { color: var(--ink-4); }
  .log-toggle-btn { display: inline-block; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--accent-soft); border: 1px solid var(--accent-line); padding: 2px 8px; border-radius: 4px; pointer-events: none; text-align: center; width: 100%; }
  details[open] .log-toggle-btn { background: var(--panel-2); border-color: var(--line); color: var(--ink-3); }
  .log-expand { padding: 20px; background: var(--panel-2); border-top: 1px solid var(--line); }
  .log-section { margin-bottom: 18px; }
  .log-sh { font-size: 10px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-4); margin-bottom: 8px; }
  .log-sh-meta { font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--ink-4); margin-left: 4px; }
  .log-pre { background: var(--panel); border: 1px solid var(--line); border-radius: 6px; padding: 10px 12px; font-size: 12px; overflow: auto; white-space: pre-wrap; max-height: 280px; font-family: 'Geist Mono', ui-monospace, monospace; line-height: 1.5; color: var(--ink-2); }
  .log-msg { margin-bottom: 10px; }
  .log-msg-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .log-role { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; padding: 1px 6px; border-radius: 3px; background: var(--panel-2); color: var(--ink-3); border: 1px solid var(--line); }
  .log-role.role-user { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-line); }
  .log-role.role-system { background: var(--warn-soft); color: var(--warn); border-color: var(--warn-line); }
  .step-block { border: 1px solid var(--line); border-radius: 6px; overflow: hidden; margin-bottom: 8px; }
  .step-head { display: flex; align-items: center; gap: 8px; padding: 7px 12px; background: var(--panel); border-bottom: 1px solid var(--line); font-size: 12px; font-weight: 500; color: var(--ink-2); }
  .step-n { font-family: 'Geist Mono', monospace; font-size: 11px; color: var(--ink-4); }
  .step-tag { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; padding: 1px 6px; border-radius: 3px; background: var(--panel-2); border: 1px solid var(--line); color: var(--ink-3); }
  .step-body { display: grid; grid-template-columns: 1fr 1fr; }
  .step-half { padding: 10px 12px; }
  .step-half h5 { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-4); margin-bottom: 5px; }
  .b-left { border-left: 1px solid var(--line); }
  .step-text { padding: 10px 12px; border-top: 1px solid var(--line); }
  .step-text h5 { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .05em; color: var(--ink-4); margin-bottom: 5px; }
</style>`;
}
