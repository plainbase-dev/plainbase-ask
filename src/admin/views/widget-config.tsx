import { raw } from 'hono/html';
import { getAgent, getConfig } from '../../db/client.js';
import { Layout } from './layout.js';
import { Flash, Card, CardHead, CardBody, PageWrap, PageHeader } from './components.js';

// ---------------------------------------------------------------------------
// Page-local CSS
// ---------------------------------------------------------------------------

const WIDGET_CSS = `
  /* two-column layout: form left, preview right */
  .wg-layout {
    display: grid;
    grid-template-columns: minmax(0,1fr) 380px;
    gap: 32px;
    align-items: start;
  }

  /* field rows */
  .field-row {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 16px 0;
    border-bottom: 1px dashed var(--line-2);
  }
  .field-row:last-child { border-bottom: 0; }
  .field-lbl { font-size: 13px; font-weight: 500; color: var(--ink); }
  .field-hint { font-size: 12px; color: var(--ink-3); line-height: 1.45; max-width: 64ch; }

  /* inputs */
  .wg-input {
    height: 36px;
    padding: 0 11px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    background: var(--panel);
    font: inherit;
    font-size: 13.5px;
    color: var(--ink);
    width: 100%;
    box-sizing: border-box;
    transition: border-color .12s ease, box-shadow .12s ease;
  }
  .wg-input:hover { border-color: oklch(78% 0.005 85); }
  .wg-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px oklch(85% 0.06 250 / .35);
  }
  textarea.wg-input {
    height: auto;
    min-height: 80px;
    padding: 9px 11px;
    line-height: 1.5;
    resize: vertical;
  }
  .wg-input[readonly] {
    background: var(--panel-2);
    color: var(--ink-2);
    border-color: var(--line);
    cursor: default;
  }

  /* embed snippet block */
  .snippet-block {
    position: relative;
    background: oklch(12% 0.005 250);
    border-radius: 8px;
    padding: 14px 16px;
    font-family: 'Geist Mono', monospace;
    font-size: 12.5px;
    line-height: 1.65;
    color: #e2e8f0;
    overflow: auto;
    white-space: pre;
  }
  .snippet-copy {
    position: absolute;
    top: 10px;
    right: 10px;
    padding: 4px 10px;
    border: 1px solid rgba(255,255,255,.12);
    border-radius: 6px;
    background: rgba(255,255,255,.07);
    color: #94a3b8;
    font-size: 12px;
    font-family: 'Geist', inherit;
    cursor: pointer;
    transition: background .12s ease, color .12s ease;
  }
  .snippet-copy:hover { background: rgba(255,255,255,.14); color: #e2e8f0; }

  /* brand colour row */
  .color-row { display: flex; align-items: center; gap: 10px; }
  .color-row input[type=color] {
    width: 40px; height: 36px;
    padding: 2px; border: 1px solid var(--line-strong);
    border-radius: 6px; cursor: pointer;
    background: var(--panel);
  }
  .color-hex {
    width: 90px;
    font-family: 'Geist Mono', monospace;
    font-size: 13px;
  }

  /* toggle switch */
  .toggle-label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    cursor: pointer;
    user-select: none;
  }
  .toggle-label input[type=checkbox] {
    width: 36px; height: 20px;
    appearance: none; -webkit-appearance: none;
    background: var(--line-strong);
    border-radius: 10px;
    position: relative;
    cursor: pointer;
    flex-shrink: 0;
    transition: background .15s ease;
  }
  .toggle-label input[type=checkbox]::after {
    content: "";
    position: absolute;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--panel);
    top: 3px; left: 3px;
    transition: left .15s ease;
    box-shadow: 0 1px 2px rgba(0,0,0,.15);
  }
  .toggle-label input[type=checkbox]:checked { background: var(--accent); }
  .toggle-label input[type=checkbox]:checked::after { left: 19px; }
  .toggle-label input[type=checkbox]:disabled { opacity: 0.5; cursor: not-allowed; }
  .toggle-text { font-size: 13.5px; color: var(--ink-2); }

  /* status pills */
  .wg-pill-active {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10.5px; font-weight: 500; letter-spacing: .02em;
    padding: 2.5px 8px 2.5px 6px; border-radius: 999px;
    border: 1px solid oklch(85% 0.06 145);
    color: oklch(38% 0.10 145);
    background: oklch(95% 0.04 145);
    white-space: nowrap;
  }
  .wg-pill-active .d {
    width: 6px; height: 6px; border-radius: 50%;
    background: oklch(58% 0.13 145);
    box-shadow: 0 0 0 3px oklch(58% 0.13 145 / .18);
    animation: wg-pulse 1.6s ease-in-out infinite;
  }
  @keyframes wg-pulse {
    0%,100% { box-shadow: 0 0 0 3px oklch(58% 0.13 145 / .18); }
    50%      { box-shadow: 0 0 0 6px oklch(58% 0.13 145 / 0); }
  }
  .wg-pill-inactive {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10.5px; font-weight: 500; letter-spacing: .02em;
    padding: 2.5px 8px 2.5px 6px; border-radius: 999px;
    border: 1px solid var(--line); color: var(--ink-4); background: var(--panel-2);
    white-space: nowrap;
  }
  .wg-pill-inactive .d { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-4); }

  /* logo preview */
  .logo-current {
    display: flex; align-items: center; gap: 14px;
  }
  .logo-current img {
    width: 48px; height: 48px; object-fit: contain;
    border: 1px solid var(--line); border-radius: 8px; padding: 4px;
    background: var(--panel-2);
  }

  /* preview column */
  .wg-preview { position: sticky; top: 70px; }
  .wg-preview-frame {
    border-radius: 18px;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(15,20,30,.12), 0 0 0 1px rgba(15,20,30,.04);
    height: 560px;
    background: #f0eee9;
  }
  .wg-preview-hint {
    text-align: center; font-size: 12px; color: var(--ink-4); margin-top: 10px;
  }
`;

// ---------------------------------------------------------------------------
// Language row JS — serialises the dynamic language rows on form submit
// ---------------------------------------------------------------------------

const LANG_JS = `
const IS = 'width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px';
const TS = IS + ';resize:vertical;font-family:inherit';

function addLangRow() {
  const row = document.createElement('div');
  row.className = 'lang-row';
  row.style.cssText = 'border:1px solid #e2e8f0;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px';
  row.innerHTML = \`
    <div style="display:flex;gap:8px">
      <div style="flex:0 0 80px">
        <label style="font-size:12px;color:#64748b">Code <a href="https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:none;font-size:11px">ISO 639</a></label>
        <input type="text" class="lang-code" placeholder="en" maxlength={10} style="\${IS}" />
      </div>
      <div style="flex:1">
        <label style="font-size:12px;color:#64748b">Label</label>
        <input type="text" class="lang-label" placeholder="🇬🇧 English" style="\${IS}" />
      </div>
      <div style="flex:0 0 auto;align-self:flex-end">
        <button type="button" onclick="this.closest('.lang-row').remove()" style="padding:6px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;cursor:pointer;font-size:13px">Remove</button>
      </div>
    </div>
    <div>
      <label style="font-size:12px;color:#64748b">Starter message</label>
      <textarea class="lang-msg" rows="2" placeholder="Hi! How can I help you?" style="\${TS}"></textarea>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <label style="font-size:12px;color:#64748b">Widget title</label>
        <input type="text" class="lang-title" placeholder="Support" style="\${IS}" />
      </div>
      <div>
        <label style="font-size:12px;color:#64748b">Widget subtitle</label>
        <input type="text" class="lang-subtitle" placeholder="AI-powered · answers instantly" style="\${IS}" />
      </div>
    </div>
    <div>
      <label style="font-size:12px;color:#64748b">Chat input placeholder</label>
      <input type="text" class="lang-placeholder" placeholder="Ask a question…" style="\${IS}" />
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div>
        <label style="font-size:12px;color:#64748b">Ticket button label</label>
        <input type="text" class="lang-ticket-btn" placeholder="Create a ticket" style="\${IS}" />
      </div>
      <div>
        <label style="font-size:12px;color:#64748b">Ticket card title</label>
        <input type="text" class="lang-card-title" placeholder="Leave us a message" style="\${IS}" />
      </div>
    </div>
    <div>
      <label style="font-size:12px;color:#64748b">Ticket card body text</label>
      <textarea class="lang-card-text" rows="2" placeholder="We'll continue the conversation by email and reply during office hours." style="\${TS}"></textarea>
    </div>
    <div>
      <label style="font-size:12px;color:#64748b">Office hours</label>
      <textarea class="lang-card-hours" rows="3" placeholder="Mon – Fri | 9:00 – 18:00&#10;Saturday | 10:00 – 14:00&#10;Sunday | Closed" style="\${TS}"></textarea>
      <p style="font-size:11.5px;color:#94a3b8;margin:4px 0 0">One row per line, use <code>|</code> to separate label from hours. Leave empty to hide.</p>
    </div>
    <div>
      <label style="font-size:12px;color:#64748b">Conversation limit message</label>
      <input type="text" class="lang-conv-limit" placeholder="Conversation limit reached." style="\${IS}" />
      <p style="font-size:11.5px;color:#94a3b8;margin:4px 0 0">Shown when a conversation is blocked by any rate limit. Leave empty to use the default.</p>
    </div>
  \`;
  document.getElementById('lang-rows').appendChild(row);
}

document.getElementById('widget-form').addEventListener('submit', function() {
  const langs = Array.from(document.querySelectorAll('.lang-row')).map(row => ({
    code: row.querySelector('.lang-code').value.trim(),
    label: row.querySelector('.lang-label').value.trim(),
    starterMessage: row.querySelector('.lang-msg').value.trim(),
    widgetTitle: row.querySelector('.lang-title').value.trim(),
    widgetSubtitle: row.querySelector('.lang-subtitle').value.trim(),
    chatInputPlaceholder: row.querySelector('.lang-placeholder').value.trim(),
    ticketButtonLabel: row.querySelector('.lang-ticket-btn').value.trim(),
    ticketCardTitle: row.querySelector('.lang-card-title').value.trim(),
    ticketCardText: row.querySelector('.lang-card-text').value.trim(),
    ticketCardOfficeHours: row.querySelector('.lang-card-hours').value.trim(),
    conversationLimitMessage: row.querySelector('.lang-conv-limit').value.trim(),
  })).filter(l => l.code && l.label);
  document.getElementById('lang-json').value = JSON.stringify(langs);
});
`;

// ---------------------------------------------------------------------------
// Types + helpers
// ---------------------------------------------------------------------------

type LangEntry = {
	code: string;
	label: string;
	widgetTitle?: string;
	widgetSubtitle?: string;
	chatInputPlaceholder?: string;
	starterMessage: string;
	ticketButtonLabel?: string;
	ticketCardTitle?: string;
	ticketCardText?: string;
	ticketCardOfficeHours?: string;
	conversationLimitMessage?: string;
};

const IS = 'width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:13px';
const TS = IS + ';resize:vertical;font-family:inherit';

function LangRow({ l }: { l: LangEntry }) {
	return (
		<div class="lang-row" style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:8px">
			<div style="display:flex;gap:8px">
				<div style="flex:0 0 80px">
					<label style="font-size:12px;color:#64748b">Code <a href="https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes" target="_blank" rel="noopener" style="color:#2563eb;text-decoration:none;font-size:11px">ISO 639</a></label>
					<input type="text" class="lang-code" value={l.code} placeholder="en" maxlength={10} style={IS} />
				</div>
				<div style="flex:1">
					<label style="font-size:12px;color:#64748b">Label</label>
					<input type="text" class="lang-label" value={l.label} placeholder="🇬🇧 English" style={IS} />
				</div>
				<div style="flex:0 0 auto;align-self:flex-end">
					<button type="button" onclick="this.closest('.lang-row').remove()" style="padding:6px 10px;background:#fee2e2;color:#dc2626;border:none;border-radius:6px;cursor:pointer;font-size:13px">Remove</button>
				</div>
			</div>
			<div>
				<label style="font-size:12px;color:#64748b">Starter message</label>
				<textarea class="lang-msg" rows={2} placeholder="Hi! How can I help you?" style={TS}>{l.starterMessage}</textarea>
			</div>
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
				<div>
					<label style="font-size:12px;color:#64748b">Widget title</label>
					<input type="text" class="lang-title" value={l.widgetTitle ?? ''} placeholder="Support" style={IS} />
				</div>
				<div>
					<label style="font-size:12px;color:#64748b">Widget subtitle</label>
					<input type="text" class="lang-subtitle" value={l.widgetSubtitle ?? ''} placeholder="AI-powered · answers instantly" style={IS} />
				</div>
			</div>
			<div>
				<label style="font-size:12px;color:#64748b">Chat input placeholder</label>
				<input type="text" class="lang-placeholder" value={l.chatInputPlaceholder ?? ''} placeholder="Ask a question…" style={IS} />
			</div>
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
				<div>
					<label style="font-size:12px;color:#64748b">Ticket button label</label>
					<input type="text" class="lang-ticket-btn" value={l.ticketButtonLabel ?? ''} placeholder="Create a ticket" style={IS} />
				</div>
				<div>
					<label style="font-size:12px;color:#64748b">Ticket card title</label>
					<input type="text" class="lang-card-title" value={l.ticketCardTitle ?? ''} placeholder="Leave us a message" style={IS} />
				</div>
			</div>
			<div>
				<label style="font-size:12px;color:#64748b">Ticket card body text</label>
				<textarea class="lang-card-text" rows={2} placeholder="We'll continue the conversation by email and reply during office hours." style={TS}>{l.ticketCardText ?? ''}</textarea>
			</div>
			<div>
				<label style="font-size:12px;color:#64748b">Office hours</label>
				<textarea class="lang-card-hours" rows={3} placeholder="Mon – Fri | 9:00 – 18:00&#10;Saturday | 10:00 – 14:00&#10;Sunday | Closed" style={TS}>{l.ticketCardOfficeHours ?? ''}</textarea>
				<p style="font-size:11.5px;color:#94a3b8;margin:4px 0 0">One row per line, use <code>|</code> to separate label from hours (e.g. <code>Mon – Fri | 9:00 – 18:00</code>). Leave empty to hide.</p>
			</div>
			<div>
				<label style="font-size:12px;color:#64748b">Conversation limit message</label>
				<input type="text" class="lang-conv-limit" value={l.conversationLimitMessage ?? ''} placeholder="Conversation limit reached." style={IS} />
				<p style="font-size:11.5px;color:#94a3b8;margin:4px 0 0">Shown when a conversation is blocked by any rate limit. Leave empty to use the default.</p>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function widgetConfigView(host: string, saved = false, csrfToken = '', error?: string): string {
	const agent = getAgent();
	const config = getConfig();
	const allowedDomains = JSON.parse(agent.allowed_domains) as string[];
	const widgetActive = config['widget_active'] === '1';
	const isProduction = process.env.NODE_ENV !== 'development';
	const productionNeedsDomainsWarning = isProduction && allowedDomains.length === 0;

	let languages: LangEntry[] = [];
	try { languages = JSON.parse(config['languages'] ?? '[]'); } catch { languages = []; }

	const snippet = `<script\n  src="${host}/widget.js"\n  data-agent-id="${agent.id}"\n></script>`;

	return '<!DOCTYPE html>' + String(
		<Layout title="Widget" currentPath="/admin/widget" showTitle={false}>
			<style>{raw(WIDGET_CSS)}</style>
			<PageWrap>
				<PageHeader
					title="Widget"
					subtitle="The embeddable chat surface that visitors see on your site. Changes apply within ~60 seconds of save."
				/>

				{(saved || !!error) && (
					<div style="margin-bottom:20px">
						{saved && <Flash variant="ok">Config saved.</Flash>}
						{error && <Flash variant="err">{error}</Flash>}
					</div>
				)}

				<div class="wg-layout">

					{/* ── Left column — form cards ── */}
					<div>
						<form method="post" action="/admin/widget" id="widget-form">
							<input type="hidden" name="_csrf" value={csrfToken} />

							{/* 01 — Install */}
							<Card id="install">
								<CardHead
									num="01"
									title="Install"
									desc="Drop this snippet into the <head> of every page where the widget should appear. The script is async and non-blocking."
								>
									{widgetActive
										? <span class="wg-pill-active"><span class="d"></span> Active</span>
										: <span class="wg-pill-inactive"><span class="d"></span> Inactive</span>
									}
								</CardHead>
								<CardBody>
									<div class="field-row">
										<div class="field-lbl">Embed snippet</div>
										<div class="field-hint">Paste into the <code>&lt;head&gt;</code> of your website to load the widget runtime.</div>
										<div class="snippet-block">
											<button
												type="button"
												class="snippet-copy"
												onclick="navigator.clipboard.writeText(document.getElementById('snippet-txt').textContent).then(()=>{this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',2000)})"
											>Copy</button>
											<span id="snippet-txt">{snippet}</span>
										</div>
									</div>

									<div class="field-row">
										<div class="field-lbl">Allowed domains</div>
										<div class="field-hint">Origins the widget loads on, one per line. Leave empty to allow all origins (development only).</div>
										<textarea
											class="wg-input"
											name="allowed_domains"
											rows={4}
											placeholder="example.com&#10;app.example.com"
										>{allowedDomains.join('\n')}</textarea>
									</div>

									<div class="field-row">
										<div class="field-lbl">Widget status</div>
										{productionNeedsDomainsWarning
											? <div class="field-hint" style="color:var(--danger)">Set at least one allowed domain before enabling the widget in production.</div>
											: <div class="field-hint">When off, the chat widget is hidden and the API returns 503.</div>
										}
										<label class="toggle-label">
											<input
												type="checkbox"
												name="widget_active"
												value="1"
												checked={widgetActive}
												disabled={productionNeedsDomainsWarning}
											/>
											<span class="toggle-text">{widgetActive ? 'Active' : 'Inactive'}</span>
										</label>
									</div>
								</CardBody>
							</Card>

							{/* 02 — Appearance */}
							<Card id="appearance">
								<CardHead
									num="02"
									title="Appearance"
									desc="Brand colour applied to the chat button, message bubbles, and accent elements."
								/>
								<CardBody>
									<div class="field-row">
										<div class="field-lbl">Brand colour</div>
										<div class="field-hint">Pick a high-contrast tone — text on top is always white.</div>
										<div class="color-row">
											<input
												type="color"
												name="primary_color"
												value={config['primary_color'] ?? '#2563eb'}
												oninput="document.getElementById('primary_color_hex').value=this.value"
											/>
											<input
												type="text"
												id="primary_color_hex"
												class="wg-input color-hex"
												value={config['primary_color'] ?? '#2563eb'}
												readonly
											/>
										</div>
									</div>
								</CardBody>
							</Card>

							{/* 03 — Launcher */}
							<Card id="launcher">
								<CardHead
									num="03"
									title="Launcher"
									desc="The closed-state button that visitors click to open the widget."
								/>
								<CardBody>
									<div class="field-row">
										<div class="field-lbl">Button label</div>
										<div class="field-hint">Text shown next to the chat icon. Leave empty for icon-only mode.</div>
										<input
											type="text"
											class="wg-input"
											name="widget_button_text"
											value={config['widget_button_text'] ?? ''}
											placeholder="Need help? Chat with us"
										/>
									</div>
								</CardBody>
							</Card>

							{/* 04 — Languages */}
							<Card id="languages">
								<CardHead
									num="04"
									title="Languages"
									desc="Add one or more languages. With a single language no language selector is shown to visitors. You can include flag emojis in the label (e.g. 🇬🇧 English)."
								/>
								<CardBody>
									<div id="lang-rows" style="display:flex;flex-direction:column;gap:14px">
										{languages.map(l => <LangRow l={l} />)}
									</div>
									<div style="margin-top:14px">
										<button type="button" onclick="addLangRow()" class="btn">+ Add language</button>
									</div>
									<input type="hidden" name="languages" id="lang-json" />
								</CardBody>
							</Card>

							<div class="form-actions">
								<button class="btn btn-primary" type="submit">Save changes</button>
							</div>
						</form>

						{/* 05 — Logo (own POST action, separate from main form) */}
						<Card id="logo" style="margin-top:18px">
							<CardHead
								num="05"
								title="Logo"
								desc="Replaces the sparkle icon in the widget header and message avatars. PNG, JPG, SVG or WebP · max 500 KB."
							/>
							<CardBody>
								<div class="field-row">
									{config['logo_data']
										? <>
											<div class="field-lbl">Current logo</div>
											<div class="logo-current">
												<img src="/api/logo" alt="Current logo" />
												<form method="post" action="/admin/widget/logo/delete" style="margin:0">
													<input type="hidden" name="_csrf" value={csrfToken} />
													<button type="submit" class="btn btn-danger">Remove logo</button>
												</form>
											</div>
										</>
										: <>
											<div class="field-lbl">Upload logo</div>
											<form method="post" action="/admin/widget/logo" enctype="multipart/form-data" style="margin:0">
												<input type="hidden" name="_csrf" value={csrfToken} />
												<div style="display:flex;align-items:center;gap:8px">
													<input type="file" name="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
														style="font-size:13px;flex:1" required />
													<button type="submit" class="btn btn-secondary" style="white-space:nowrap">Upload</button>
												</div>
											</form>
										</>
									}
								</div>
							</CardBody>
						</Card>
					</div>

					{/* ── Right column — live preview ── */}
					<div class="wg-preview">
						<div class="wg-preview-frame">
							<iframe
								id="preview-iframe"
								src="/admin/widget/preview-frame"
								style="width:100%;height:100%;border:none;display:block"
							/>
						</div>
						<p class="wg-preview-hint">Live preview — open the widget in the bottom-right corner</p>
					</div>

				</div>
			</PageWrap>
			<script>{raw(LANG_JS)}</script>
		</Layout>,
	);
}

// ---------------------------------------------------------------------------
// Preview frame (unchanged)
// ---------------------------------------------------------------------------

export function widgetPreviewFrame(host: string, agentId: string): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #f0eee9; min-height: 100vh; padding: 32px 24px; color: #64748b; }
    h2 { font-size: 18px; color: #1e293b; margin-bottom: 8px; }
    p { font-size: 14px; line-height: 1.6; }
  </style>
</head>
<body>
  <h2>Preview page</h2>
  <p>Open the widget in the bottom-right corner to test your configuration.</p>
  <script src="${host}/widget.js" data-agent-id="${agentId}" data-api-base="${host}/admin/preview"></script>
</body>
</html>`;
}
