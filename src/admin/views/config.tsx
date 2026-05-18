import { raw } from 'hono/html';
import { getAgent, getConfig } from '../../db/client.js';
import { Layout } from './layout.js';
import {
	PageWrap, PageHeader, TwoColToc, TocNav,
	Card, CardHead, CardBody,
	Flash, Pill,
	IcnLock, IcnCheck, IcnWarn, IcnRefresh,
} from './components.js';

const PAGE_CSS = `
  /* config form layout */
  .row {
    display: grid; grid-template-columns: 240px 1fr;
    align-items: start; gap: 24px;
    padding: 14px 0; border-bottom: 1px dashed var(--line-2);
  }
  .row:last-child { border-bottom: 0; }
  .row-label { padding-top: 9px; }
  .row-label .lbl { font-size: 13px; font-weight: 500; color: var(--ink); display: flex; align-items: center; gap: 8px; }
  .row-label .hint { font-size: 12px; color: var(--ink-3); margin-top: 3px; line-height: 1.42; }
  .row-label .env { margin-top: 6px; font-size: 11px; color: var(--ink-3); display: inline-flex; align-items: center; gap: 5px; }
  .row-label .env code {
    font-family: 'Geist Mono', monospace;
    background: oklch(96% 0.004 85); border: 1px solid var(--line-2);
    padding: 1px 5px; border-radius: 4px; color: var(--ink-2);
  }

  /* inputs */
  .input {
    height: var(--row); padding: 0 11px;
    border: 1px solid var(--line-strong); border-radius: var(--radius-sm);
    background: var(--panel); font: inherit; font-size: 13.5px; color: var(--ink);
    width: 100%; transition: border-color .12s ease, box-shadow .12s ease;
  }
  .input.mono { font-family: 'Geist Mono', monospace; font-size: 13px; }
  .input::placeholder { color: var(--ink-4); }
  .input:hover { border-color: oklch(78% 0.005 85); }
  .input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px oklch(85% 0.06 250 / .35); }
  .input.locked { background: var(--panel-2); color: var(--ink-2); border-color: var(--line); border-style: dashed; cursor: not-allowed; }
  .input.locked:hover { border-color: var(--line); }

  .field { position: relative; }
  .field .suffix { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--ink-4); font-family: 'Geist Mono', monospace; pointer-events: none; background: linear-gradient(to right, transparent 0, var(--panel) 8px); padding-left: 8px; }
  .field .prefix { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--ink-4); font-family: 'Geist Mono', monospace; pointer-events: none; }
  .field.has-prefix .input { padding-left: 32px; }

  /* provider tiles */
  .providers { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .provider { border: 1px solid var(--line); border-radius: 8px; padding: 10px 10px 9px; background: var(--panel-2); display: flex; flex-direction: column; gap: 6px; cursor: default; position: relative; }
  .provider .p-name { font-size: 12.5px; font-weight: 500; color: var(--ink-2); }
  .provider .p-id { font-size: 10.5px; color: var(--ink-4); font-family: 'Geist Mono', monospace; }
  .provider .p-mark { width: 16px; height: 16px; border-radius: 4px; background: oklch(90% 0.005 80); display: flex; align-items: center; justify-content: center; font-size: 9.5px; font-weight: 700; color: var(--ink-2); margin-bottom: 2px; }
  .provider.is-active { background: var(--panel); border-color: oklch(72% 0.005 85); box-shadow: inset 0 0 0 1px oklch(72% 0.005 85); }
  .provider.is-active::after { content: ""; position: absolute; top: 8px; right: 8px; width: 6px; height: 6px; border-radius: 50%; background: var(--ink); }

  /* cost grid */
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
  .field-stack { display: flex; flex-direction: column; gap: 6px; }
  .field-stack > .lbl { font-size: 11.5px; color: var(--ink-3); font-weight: 500; letter-spacing: .005em; }
  .field-stack > .lbl .unit { font-family: 'Geist Mono', monospace; color: var(--ink-4); font-weight: 400; margin-left: 4px; }

  /* rate rows */
  .rate-row { display: grid; grid-template-columns: 1fr 140px 80px; align-items: center; gap: 18px; padding: 11px 0; border-bottom: 1px dashed var(--line-2); }
  .rate-row:last-child { border-bottom: 0; }
  .rate-name { font-size: 13px; font-weight: 450; color: var(--ink); display: flex; flex-direction: column; gap: 2px; }
  .rate-name .h { font-size: 11.5px; color: var(--ink-3); font-weight: 400; line-height: 1.35; }
  .rate-default { font-size: 11.5px; color: var(--ink-4); font-family: 'Geist Mono', monospace; text-align: right; }
  .rate-default em { font-style: normal; color: var(--ink-3); }

  /* warning banner */
  .banner { margin-top: 10px; display: flex; align-items: flex-start; gap: 10px; padding: 9px 12px; border-radius: 8px; font-size: 12.5px; background: var(--warn-soft); border: 1px solid var(--warn-line); color: oklch(36% 0.08 75); }
  .banner svg { margin-top: 1px; flex-shrink: 0; }

  /* email validation tip */
  .err-tip { margin-top: 6px; font-size: 12px; color: oklch(40% 0.12 25); display: none; align-items: center; gap: 6px; }

  /* ticket toggle */
  .toggle-wrap { display: inline-flex; align-items: center; gap: 10px; cursor: pointer; user-select: none; }
  .toggle-cb { position: absolute; opacity: 0; width: 0; height: 0; pointer-events: none; }
  .toggle-track {
    width: 36px; height: 20px; border-radius: 10px; flex-shrink: 0;
    background: var(--line-strong); position: relative; transition: background .15s ease;
    border: 1px solid transparent;
  }
  .toggle-cb:checked ~ .toggle-track { background: oklch(55% 0.16 145); }
  .toggle-thumb {
    position: absolute; top: 2px; left: 2px;
    width: 14px; height: 14px; border-radius: 50%;
    background: white; box-shadow: 0 1px 3px rgba(0,0,0,.25);
    transition: transform .15s ease;
  }
  .toggle-cb:checked ~ .toggle-track .toggle-thumb { transform: translateX(16px); }
  .toggle-lbl { font-size: 13px; color: var(--ink-2); }

  /* save bar */
  .savebar { position: sticky; bottom: 18px; margin: 30px 0 0; background: oklch(20% 0.005 80); color: oklch(98% 0.004 80); border-radius: 10px; display: flex; align-items: center; gap: 14px; padding: 10px 12px 10px 18px; box-shadow: 0 8px 24px rgba(20,18,14,.18), 0 1px 0 rgba(255,255,255,.06) inset; transition: opacity .2s ease, transform .2s ease; }
  .savebar.hidden { opacity: 0; transform: translateY(8px); pointer-events: none; }
  .savebar .dot { width: 7px; height: 7px; border-radius: 50%; background: oklch(72% 0.13 75); box-shadow: 0 0 0 4px oklch(72% 0.13 75 / .18); flex-shrink: 0; }
  .savebar .msg { font-size: 13px; font-weight: 450; color: oklch(95% 0 0); }
  .savebar .msg b { font-weight: 600; color: oklch(99% 0 0); }
  .savebar .actions { margin-left: auto; display: flex; gap: 6px; }
  .savebar .btn { height: 30px; font-size: 12.5px; background: transparent; border-color: oklch(35% 0.005 80); color: oklch(92% 0 0); }
  .savebar .btn:hover { background: oklch(28% 0.005 80); }
  .savebar .btn.primary { background: oklch(96% 0 0); color: oklch(20% 0.005 80); border-color: oklch(96% 0 0); }
  .savebar .btn.primary:hover { background: oklch(99% 0 0); }
`;

const CONFIG_JS = `
(function () {
  var form = document.getElementById('config-form');
  var savebar = document.getElementById('savebar');
  var savebarMsg = document.getElementById('savebar-msg');
  var inputs = Array.from(form.querySelectorAll('input:not([type=hidden]), select, textarea'));

  function getVal(el) {
    return el.type === 'checkbox' ? (el.checked ? '1' : '0') : el.value;
  }

  var initial = {};
  inputs.forEach(function (el) { initial[el.name || el.id] = getVal(el); });

  function countDirty() {
    return inputs.filter(function (el) { return getVal(el) !== initial[el.name || el.id]; }).length;
  }

  function updateSavebar() {
    var n = countDirty();
    if (n > 0) {
      savebar.classList.remove('hidden');
      savebarMsg.innerHTML = '<b>' + n + '</b> unsaved ' + (n === 1 ? 'change' : 'changes');
    } else {
      savebar.classList.add('hidden');
    }
  }

  inputs.forEach(function (el) {
    el.addEventListener('input', updateSavebar);
    el.addEventListener('change', updateSavebar);
  });

  function applyTicketState(enabled) {
    var emailInput = document.getElementById('ticket-email');
    var errTip = document.getElementById('email-err');
    var lbl = document.getElementById('ticket-enabled-lbl');
    if (emailInput) {
      emailInput.disabled = !enabled;
      emailInput.classList.toggle('locked', !enabled);
    }
    if (errTip && !enabled) errTip.style.display = 'none';
    if (lbl) lbl.textContent = enabled ? 'Enabled' : 'Disabled';
  }

  var ticketCb = document.getElementById('ticket-enabled-cb');
  if (ticketCb) {
    ticketCb.addEventListener('change', function () {
      applyTicketState(ticketCb.checked);
      updateSavebar();
    });
  }

  document.getElementById('btn-discard').addEventListener('click', function () {
    inputs.forEach(function (el) {
      if (el.type === 'checkbox') {
        el.checked = initial[el.name || el.id] === '1';
      } else {
        el.value = initial[el.name || el.id];
      }
    });
    if (ticketCb) applyTicketState(ticketCb.checked);
    updateSavebar();
  });

  var rateDefaults = {
    rate_limit_messages_per_second: '0.2',
    rate_limit_max_conversations_per_ip: '5',
    rate_limit_max_messages_per_conv: '50',
    conversation_memory_window: '10',
    max_response_tokens: '1000'
  };
  document.getElementById('btn-reset-defaults').addEventListener('click', function () {
    Object.keys(rateDefaults).forEach(function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      if (el) el.value = rateDefaults[name];
    });
    updateSavebar();
  });

  var emailInput = document.getElementById('ticket-email');
  var errTip = document.getElementById('email-err');
  if (emailInput) {
    emailInput.addEventListener('input', function () {
      if (emailInput.disabled) return;
      var valid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(emailInput.value);
      errTip.style.display = emailInput.value && !valid ? 'flex' : 'none';
    });
  }

  var tocAnchors = ['llm', 'cost', 'smtp', 'rate', 'crawl'];
  var sections = tocAnchors.map(function (id) { return document.getElementById(id); }).filter(Boolean);
  var tocLinks = {};
  tocAnchors.forEach(function (id) {
    tocLinks[id] = document.querySelector('.toc-nav a[href="#' + id + '"]');
  });

  var io = new IntersectionObserver(function (entries) {
    var visible = entries
      .filter(function (e) { return e.isIntersecting; })
      .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
    if (visible[0]) {
      tocAnchors.forEach(function (id) { if (tocLinks[id]) tocLinks[id].classList.remove('active'); });
      if (tocLinks[visible[0].target.id]) tocLinks[visible[0].target.id].classList.add('active');
    }
  }, { rootMargin: '-100px 0px -60% 0px', threshold: 0.01 });

  sections.forEach(function (el) { io.observe(el); });
})();

`;

const TOC_LINKS = [
	{ href: '#llm',   label: 'LLM provider' },
	{ href: '#cost',  label: 'Cost tracking' },
	{ href: '#smtp',  label: 'Ticket feature' },
	{ href: '#rate',  label: 'Rate limits' },
	{ href: '#crawl', label: 'Crawl schedule' },
];

export function configView(saved = false, csrfToken = '', error?: string): string {
	const agent = getAgent();
	const config = getConfig();

	const ticketEnabled = config['ticket_enabled'] !== '0';

	const provider   = process.env.AI_PROVIDER ?? 'openai';
	const chatModel  = process.env.AI_MODEL ?? 'gpt-4o';
	const embedModel = process.env.EMBEDDING_MODEL ?? 'text-embedding-3-small';

	const providers = [
		{ id: 'openai',    name: 'OpenAI',    short: 'AI' },
		{ id: 'anthropic', name: 'Anthropic', short: 'An' },
		{ id: 'mistral',   name: 'Mistral',   short: 'Mi' },
		{ id: 'google',    name: 'Google',    short: 'G',  desc: 'Gemini' },
	];

	return '<!DOCTYPE html>' + String(
		<Layout title="Config" currentPath="/admin/config" section="Settings" showTitle={false}>
			<style>{raw(PAGE_CSS)}</style>
			<PageWrap>
				{saved && <Flash variant="ok">Config saved successfully.</Flash>}
				{error && <Flash variant="err">{error}</Flash>}
				<PageHeader
					title="Config"
					subtitle="Runtime settings for the assistant. Provider details are managed via environment variables; everything else is editable here and applies on save."
				/>
				<form method="post" action="/admin/config" id="config-form">
					<input type="hidden" name="_csrf" value={csrfToken} />
					<TwoColToc toc={<TocNav links={TOC_LINKS} />}>
						{/* 01 LLM Provider */}
						<Card id="llm">
							<CardHead num="01" title="LLM Provider" desc="The model backend the assistant calls. These values are read from environment variables on boot — change them in your deploy config and restart the server.">
								<Pill>{IcnLock} read-only</Pill>
							</CardHead>
							<CardBody>
								<input type="hidden" name="ai_provider" value={provider} />
								<input type="hidden" name="ai_model" value={chatModel} />
								<input type="hidden" name="embedding_model" value={embedModel} />

								<div class="row">
									<div class="row-label">
										<div class="lbl">Provider <Pill variant="warn">{IcnLock} env-driven</Pill></div>
										<div class="hint">Active model backend. Switching providers usually means rotating an API key as well.</div>
										<div class="env">reads from <code>AI_PROVIDER</code></div>
									</div>
									<div class="providers">
										{providers.map(p => (
											<div class={`provider${p.id === provider ? ' is-active' : ''}`}>
												<div class="p-mark">{p.short}</div>
												<div class="p-name">{p.name}</div>
												<div class="p-id mono">{p.id}{p.desc ? ` · ${p.desc}` : ''}</div>
											</div>
										))}
									</div>
								</div>

								<div class="row">
									<div class="row-label">
										<div class="lbl">Chat model <Pill variant="warn">{IcnLock} env-driven</Pill></div>
										<div class="hint">Identifier passed to the provider's chat completion endpoint.</div>
										<div class="env">reads from <code>AI_MODEL</code></div>
									</div>
									<div>
										<input class="input mono locked" value={chatModel} readonly />
									</div>
								</div>

								<div class="row">
									<div class="row-label">
										<div class="lbl">Embedding model <Pill variant="warn">{IcnLock} env-driven</Pill></div>
										<div class="hint">Used to vectorise knowledge base chunks. Changing this requires re-indexing existing documents.</div>
										<div class="env">reads from <code>EMBEDDING_MODEL</code></div>
									</div>
									<div>
										<input class="input mono locked" value={embedModel} readonly />
									</div>
								</div>

								<div class="banner" style="margin-top:14px">
									{IcnWarn}
									<div>
										<b style="font-weight:600">Restart required to change.</b>
										{' '}Update these values in <code style="font-family:'Geist Mono',monospace;font-size:11.5px">.env.production</code> and redeploy. The currently-loaded process is pinned to the values shown above.
									</div>
								</div>
							</CardBody>
						</Card>

						{/* 02 Cost Tracking */}
						<Card id="cost">
							<CardHead num="02" title="Cost tracking" desc="Per-million-token rates used to estimate spend in AI Logs. Set these to match your provider's published pricing for the active model." />
							<CardBody>
								<div class="row">
									<div class="row-label">
										<div class="lbl">Token pricing</div>
										<div class="hint">USD per 1M tokens. Used purely for display — does not affect what the provider bills you.</div>
									</div>
									<div class="grid-3">
										<div class="field-stack">
											<div class="lbl">Input<span class="unit">USD / 1M tok</span></div>
											<div class="field has-prefix">
												<span class="prefix">$</span>
												<input class="input mono" name="cost_input_per_1m" type="number" inputmode="decimal" step="0.01" min="0"
													value={String(config['cost_input_per_1m'] ?? '0')} placeholder="e.g. 2.50" />
											</div>
										</div>
										<div class="field-stack">
											<div class="lbl">Output<span class="unit">USD / 1M tok</span></div>
											<div class="field has-prefix">
												<span class="prefix">$</span>
												<input class="input mono" name="cost_output_per_1m" type="number" inputmode="decimal" step="0.01" min="0"
													value={String(config['cost_output_per_1m'] ?? '0')} placeholder="e.g. 10.00" />
											</div>
										</div>
										<div class="field-stack">
											<div class="lbl">Embedding<span class="unit">USD / 1M tok</span></div>
											<div class="field has-prefix">
												<span class="prefix">$</span>
												<input class="input mono" name="cost_embedding_per_1m" type="number" inputmode="decimal" step="0.0001" min="0"
													value={String(config['cost_embedding_per_1m'] ?? '0')} placeholder="e.g. 0.02" />
											</div>
										</div>
									</div>
								</div>
							</CardBody>
						</Card>

						{/* 03 Ticket Feature */}
						<Card id="smtp">
							<CardHead num="03" title="Ticket feature" desc="Allow the AI to offer a support ticket button to users. When disabled the offer_ticket tool is removed from the AI and ticket-related settings are inactive." />
							<CardBody>
								<div class="row">
									<div class="row-label">
										<div class="lbl">Feature enabled</div>
										<div class="hint">Toggle off to fully disable ticket creation. The AI will not offer tickets and the fields below will be inactive.</div>
									</div>
									<div>
										<label class="toggle-wrap">
											<input type="checkbox" class="toggle-cb" name="ticket_enabled" value="1" id="ticket-enabled-cb"
												checked={ticketEnabled} />
											<span class="toggle-track"><span class="toggle-thumb" /></span>
											<span class="toggle-lbl" id="ticket-enabled-lbl">{ticketEnabled ? 'Enabled' : 'Disabled'}</span>
										</label>
									</div>
								</div>
								<div class="row">
									<div class="row-label">
										<div class="lbl">Support inbox</div>
										<div class="hint">Tickets are forwarded as plain-text emails with the conversation transcript attached.</div>
									</div>
									<div style="max-width:420px">
										<input class={`input mono${!ticketEnabled ? ' locked' : ''}`} name="ticket_email" type="email" id="ticket-email"
											value={agent.ticket_email}
											placeholder="support@yourcompany.com"
											disabled={!ticketEnabled} />
										<div class="err-tip" id="email-err">{IcnWarn} Doesn't look like a valid email address.</div>
									</div>
								</div>
							</CardBody>
						</Card>

						{/* 04 Rate Limits */}
						<Card id="rate">
							<CardHead num="04" title="Rate limits" desc="Guardrails that protect the model budget and the embedded widget. Conservative defaults are noted on the right; loosen with care.">
								<button type="button" class="btn ghost" id="btn-reset-defaults">{IcnRefresh} Reset to defaults</button>
							</CardHead>
							<CardBody>
								<div class="rate-row">
									<div class="rate-name">Messages per second per IP<span class="h">Soft throttle. Burst above this is rejected with HTTP 429.</span></div>
									<div class="field">
										<input class="input mono" name="rate_limit_messages_per_second" type="number" inputmode="decimal" step="0.1" min="0.1"
											value={String(config['rate_limit_messages_per_second'] ?? '0.2')} />
										<span class="suffix">msg/s</span>
									</div>
									<div class="rate-default"><em>def</em> 0.2</div>
								</div>
								<div class="rate-row">
									<div class="rate-name">Max active conversations per IP<span class="h">Caps how many parallel sessions a single IP can hold open.</span></div>
									<div class="field">
										<input class="input mono" name="rate_limit_max_conversations_per_ip" type="number" min="1"
											value={String(config['rate_limit_max_conversations_per_ip'] ?? '5')} />
										<span class="suffix">convs</span>
									</div>
									<div class="rate-default"><em>def</em> 5</div>
								</div>
								<div class="rate-row">
									<div class="rate-name">Max messages per conversation<span class="h">After this, the conversation is sealed and a new one must be started.</span></div>
									<div class="field">
										<input class="input mono" name="rate_limit_max_messages_per_conv" type="number" min="1"
											value={String(config['rate_limit_max_messages_per_conv'] ?? '50')} />
										<span class="suffix">msg</span>
									</div>
									<div class="rate-default"><em>def</em> 50</div>
								</div>
								<div class="rate-row">
									<div class="rate-name">Conversation memory window<span class="h">How many recent messages are included as context on each LLM call.</span></div>
									<div class="field">
										<input class="input mono" name="conversation_memory_window" type="number" min="1" max="50"
											value={String(config['conversation_memory_window'] ?? '10')} />
										<span class="suffix">msg</span>
									</div>
									<div class="rate-default"><em>def</em> 10</div>
								</div>
								<div class="rate-row">
									<div class="rate-name">Max response tokens<span class="h">Hard cap on the assistant's reply length per turn.</span></div>
									<div class="field">
										<input class="input mono" name="max_response_tokens" type="number" min="100" max="4000"
											value={String(config['max_response_tokens'] ?? '1000')} />
										<span class="suffix">tokens</span>
									</div>
									<div class="rate-default"><em>def</em> 1000</div>
								</div>
							</CardBody>
						</Card>

						{/* 05 Crawl Schedule */}
						<Card id="crawl">
							<CardHead num="05" title="Crawl schedule" desc="Controls when the automatic re-crawler runs each day. All scheduled sources are checked once per hour; crawls only fire during the configured run hour in the configured timezone." />
							<CardBody>
								<div class="row">
									<div class="row-label">
										<div class="lbl">Timezone</div>
										<div class="hint">IANA timezone name used for scheduled crawls and timestamp display throughout the admin. Examples: <code style="font-family:'Geist Mono',monospace;font-size:11px">Europe/Brussels</code>, <code style="font-family:'Geist Mono',monospace;font-size:11px">America/New_York</code>, <code style="font-family:'Geist Mono',monospace;font-size:11px">Asia/Tokyo</code>.</div>
									</div>
									<div style="max-width:340px">
										<input class="input mono" name="timezone" type="text"
											value={config['timezone'] ?? 'UTC'}
											placeholder="UTC" />
									</div>
								</div>
								<div class="row">
									<div class="row-label">
										<div class="lbl">Run hour</div>
										<div class="hint">Hour of the day (in the timezone above) at which scheduled crawls are triggered. Defaults to midnight (0).</div>
									</div>
									<div style="max-width:200px">
										<div class="field">
											<input class="input mono" name="crawl_run_hour" type="number" min="0" max="23"
												value={String(config['crawl_run_hour'] ?? '0')} />
											<span class="suffix">:00</span>
										</div>
									</div>
								</div>
							</CardBody>
						</Card>

						{/* save bar */}
						<div class="savebar hidden" id="savebar">
							<span class="dot" />
							<span class="msg" id="savebar-msg"><b>0</b> unsaved changes</span>
							<div class="actions">
								<button type="button" class="btn" id="btn-discard">Discard</button>
								<button type="submit" class="btn primary" id="btn-save">{IcnCheck} Save config</button>
							</div>
						</div>
					</TwoColToc>
				</form>
			</PageWrap>
			<script>{raw(CONFIG_JS)}</script>
		</Layout>,
	);
}
