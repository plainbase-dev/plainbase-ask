import { getAiLogs, getAiLog, countAiLogs } from '../../db/client.js';
import type { AiLog } from '../../db/schema.js';
import { layout } from './layout.js';

const PAGE_SIZE = 50;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatCost(cost: number | null): string {
  if (cost === null) return '<span style="color:#94a3b8">—</span>';
  if (cost < 0.0001) return '<$0.0001';
  return `$${cost.toFixed(4)}`;
}

function formatTokens(n: number): string {
  return n.toLocaleString();
}

export function logsListView(page = 1): string {
  const offset = (page - 1) * PAGE_SIZE;
  const logs = getAiLogs(PAGE_SIZE, offset);
  const total = countAiLogs();
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const totalInputTokens = (logs.reduce((s, l) => s + l.input_tokens, 0)).toLocaleString();
  const totalOutputTokens = (logs.reduce((s, l) => s + l.output_tokens, 0)).toLocaleString();
  const totalCost = logs.reduce((s, l) => s + (l.cost_usd ?? 0), 0);

  const rows = logs.map(l => `
    <tr>
      <td style="white-space:nowrap">${new Date(l.created_at * 1000).toLocaleString()}</td>
      <td><code style="font-size:11px">${escapeHtml(l.model)}</code></td>
      <td>${l.conversation_id
        ? `<a href="/admin/conversations/${l.conversation_id}">${l.conversation_id.slice(0, 8)}…</a>`
        : '<span style="color:#94a3b8">—</span>'
      }</td>
      <td style="text-align:right">${formatTokens(l.input_tokens)}</td>
      <td style="text-align:right">${formatTokens(l.output_tokens)}</td>
      <td style="text-align:right">${l.thinking_tokens > 0 ? formatTokens(l.thinking_tokens) : '<span style="color:#94a3b8">—</span>'}</td>
      <td style="text-align:right">${formatCost(l.cost_usd)}</td>
      <td><a href="/admin/logs/${l.id}" class="btn btn-secondary" style="padding:4px 10px;font-size:12px">View</a></td>
    </tr>
  `).join('');

  const pagination = totalPages > 1 ? `
    <div style="display:flex;gap:8px;align-items:center;margin-top:16px;font-size:13px">
      ${page > 1 ? `<a href="/admin/logs?page=${page - 1}" class="btn btn-secondary">← Prev</a>` : ''}
      <span style="color:#64748b">Page ${page} of ${totalPages} &nbsp;·&nbsp; ${total} entries</span>
      ${page < totalPages ? `<a href="/admin/logs?page=${page + 1}" class="btn btn-secondary">Next →</a>` : ''}
    </div>
  ` : `<p style="margin-top:12px;font-size:12px;color:#94a3b8">${total} total entries</p>`;

  const content = `
    <div class="card" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:20px">
      <div><div style="font-size:22px;font-weight:700">${total.toLocaleString()}</div><div style="color:#64748b;font-size:13px">Total LLM calls</div></div>
      <div><div style="font-size:22px;font-weight:700">${totalInputTokens} / ${totalOutputTokens}</div><div style="color:#64748b;font-size:13px">Input / output tokens (this page)</div></div>
      <div><div style="font-size:22px;font-weight:700">${formatCost(totalCost)}</div><div style="color:#64748b;font-size:13px">Est. cost (this page)</div></div>
    </div>
    <div class="card">
      ${logs.length === 0
        ? '<p style="color:#94a3b8">No AI calls logged yet.</p>'
        : `
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Model</th>
                <th>Conversation</th>
                <th style="text-align:right">In tokens</th>
                <th style="text-align:right">Out tokens</th>
                <th style="text-align:right">Thinking</th>
                <th style="text-align:right">Cost</th>
                <th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          ${pagination}
        `
      }
    </div>
  `;

  return layout('AI Logs', content, '/admin/logs');
}

export function logDetailView(id: string): string | null {
  const log = getAiLog(id);
  if (!log) return null;

  let messages: unknown[] = [];
  let steps: unknown[] = [];
  try { messages = JSON.parse(log.messages); } catch { /* leave empty */ }
  try { steps = JSON.parse(log.steps); } catch { /* leave empty */ }

  const convLink = log.conversation_id
    ? `<a href="/admin/conversations/${log.conversation_id}">${log.conversation_id}</a>`
    : '—';

  const section = (title: string, body: string) => `
    <div class="card">
      <h3 style="font-size:14px;font-weight:600;margin-bottom:12px">${title}</h3>
      ${body}
    </div>
  `;

  const pre = (text: string) =>
    `<pre style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px;font-size:12px;overflow:auto;white-space:pre-wrap;max-height:400px">${escapeHtml(text)}</pre>`;

  const messagesHtml = (messages as Array<{ role: string; content: unknown }>).map(m => `
    <div style="margin-bottom:10px">
      <span class="badge ${m.role === 'user' ? 'badge-blue' : ''}" style="${m.role === 'assistant' ? 'background:#f1f5f9;color:#475569' : ''}">${m.role}</span>
      ${pre(typeof m.content === 'string' ? m.content : JSON.stringify(m.content, null, 2))}
    </div>
  `).join('');

  const stepsHtml = steps.length === 0
    ? '<p style="color:#94a3b8;font-size:13px">No tool calls.</p>'
    : (steps as Array<{ text?: string; toolCalls?: unknown[]; toolResults?: unknown[] }>).map((s, i) => `
      <div style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;color:#64748b;margin-bottom:6px">Step ${i + 1}</div>
        ${s.toolCalls?.length ? `<div style="font-size:12px;color:#475569;margin-bottom:4px">Tool calls:</div>${pre(JSON.stringify(s.toolCalls, null, 2))}` : ''}
        ${s.toolResults?.length ? `<div style="font-size:12px;color:#475569;margin-top:8px;margin-bottom:4px">Tool results:</div>${pre(JSON.stringify(s.toolResults, null, 2))}` : ''}
        ${s.text ? `<div style="font-size:12px;color:#475569;margin-top:8px;margin-bottom:4px">Text:</div>${pre(s.text)}` : ''}
      </div>
    `).join('');

  const content = `
    <div style="margin-bottom:16px">
      <a href="/admin/logs" style="font-size:13px">← Back to AI Logs</a>
    </div>

    ${section('Overview', `
      <table style="width:auto">
        <tbody>
          <tr><td style="color:#64748b;padding-right:24px">Time</td><td>${new Date(log.created_at * 1000).toLocaleString()}</td></tr>
          <tr><td style="color:#64748b">Model</td><td><code>${escapeHtml(log.model)}</code></td></tr>
          <tr><td style="color:#64748b">Conversation</td><td>${convLink}</td></tr>
          <tr><td style="color:#64748b">Input tokens</td><td>${formatTokens(log.input_tokens)}</td></tr>
          <tr><td style="color:#64748b">Output tokens</td><td>${formatTokens(log.output_tokens)}</td></tr>
          <tr><td style="color:#64748b">Thinking tokens</td><td>${log.thinking_tokens > 0 ? formatTokens(log.thinking_tokens) : '—'}</td></tr>
          <tr><td style="color:#64748b">Est. cost</td><td>${formatCost(log.cost_usd)}</td></tr>
        </tbody>
      </table>
    `)}

    ${section('System Prompt', pre(log.system_prompt))}

    ${section('Messages sent to LLM', messagesHtml || '<p style="color:#94a3b8;font-size:13px">No messages.</p>')}

    ${section('Clean Response', pre(log.response_text || '(empty)'))}

    ${section('Tool Call Steps', stepsHtml)}
  `;

  return layout(`AI Log ${id.slice(0, 8)}…`, content, '/admin/logs');
}
