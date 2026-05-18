import { getAgent } from '../../db/client.js';
import { layout } from './layout.js';

export function widgetSnippetView(host: string): string {
  const agent = getAgent();
  const snippet = `<script\n  src="${host}/widget.js"\n  data-agent-id="${agent.id}"\n></script>`;

  const content = `
    <div class="card">
      <h3 style="font-size:15px;margin-bottom:8px">Embed snippet</h3>
      <p style="font-size:13px;color:#64748b;margin-bottom:14px">
        Paste this into the <code>&lt;head&gt;</code> of your website. The widget will appear as a chat button in the bottom-right corner.
      </p>
      <pre id="snippet" style="background:#0f172a;color:#e2e8f0;padding:16px;border-radius:8px;font-size:13px;overflow:auto;white-space:pre">${escapeHtml(snippet)}</pre>
      <div style="margin-top:12px">
        <button class="btn btn-secondary" onclick="
          navigator.clipboard.writeText(document.getElementById('snippet').textContent)
            .then(() => { this.textContent = 'Copied!'; setTimeout(() => this.textContent = 'Copy to clipboard', 2000); })
        ">Copy to clipboard</button>
      </div>
    </div>
    <div class="card">
      <h3 style="font-size:15px;margin-bottom:8px">Agent ID</h3>
      <code style="font-size:13px;background:#f1f5f9;padding:4px 8px;border-radius:4px">${escapeHtml(agent.id)}</code>
    </div>
  `;

  return layout('Widget Snippet', content, '/admin/widget');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
