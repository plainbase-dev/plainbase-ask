import { raw } from 'hono/html';
import type { FC } from 'hono/jsx';
import { getInstructions, getAgent, getConfig } from '../../db/client.js';
import { LAYER_1 } from '../../llm/prompt.js';
import { Layout } from './layout.js';
import {
	Card, CardHead, CardBody,
	Flash, Pill,
	PageWrap, PageHeader, TwoColToc, TocNav,
	IcnLock, IcnCheck, IcnReset,
} from './components.js';

// --- Defaults & types ---

const DEFAULTS = {
	tone_persona:       'You are a friendly and concise support assistant.',
	scope_guardrails:   "Only answer questions related to our product. For anything else, let the user know you can't help with that.",
	escalation_hints:   "Always offer a ticket for billing or account access issues, even if the user doesn't ask.",
	additional_context: '',
};

type FieldKey = keyof typeof DEFAULTS;

type FieldDef = {
	key:         FieldKey;
	label:       string;
	hint:        string;
	placeholder: string;
};

const FIELDS: FieldDef[] = [
	{
		key:         'tone_persona',
		label:       'Tone & Persona',
		hint:        'How the bot sounds and what name it uses. Keep it short — 1–3 sentences is plenty.',
		placeholder: "You're our friendly product expert. Warm, concise, never pushy…",
	},
	{
		key:         'scope_guardrails',
		label:       'Scope & Guardrails',
		hint:        'What topics the assistant should answer, and what it should politely decline.',
		placeholder: 'Answer questions about our products, billing, and warranty. Decline to discuss competitors or legal advice…',
	},
	{
		key:         'escalation_hints',
		label:       'Escalation Hints',
		hint:        'When to proactively offer to file a ticket. Match against user intent, not specific phrases.',
		placeholder: 'Offer a ticket if the user mentions a broken device, a missing shipment, or asks to speak to a person…',
	},
	{
		key:         'additional_context',
		label:       'Additional Context',
		hint:        'Free-form catch-all. Useful for current promotions, store hours, or temporary policy notes.',
		placeholder: "We're currently running a Spring sale through 31 May…",
	},
];

// --- Page-specific CSS (only what's not in the shared stylesheet) ---

const PAGE_CSS = `
  .inst-field {
    display: grid; grid-template-columns: 200px 1fr;
    gap: 0 20px; padding: 18px 0; border-top: 1px solid var(--line-2);
  }
  .inst-field-first { border-top: none; padding-top: 0; }
  .if-key { display: inline-block; font-family: 'Geist Mono', monospace; font-size: 10.5px; color: var(--ink-4); margin-bottom: 5px; }
  .if-name { font-size: 13.5px; font-weight: 600; color: var(--ink); margin-bottom: 4px; }
  .if-hint { font-size: 12px; color: var(--ink-3); line-height: 1.45; }
  .ta {
    width: 100%; padding: 9px 11px;
    border: 1px solid var(--line-strong); border-radius: 7px;
    font-size: 13.5px; font-family: inherit; line-height: 1.5;
    outline: none; background: var(--panel); color: var(--ink);
    resize: vertical; min-height: 90px; transition: border-color .12s ease;
  }
  .ta:focus { border-color: var(--accent); box-shadow: 0 0 0 3px oklch(85% 0.06 250 / .35); }
  .ta:disabled { opacity: 0.45; cursor: not-allowed; background: var(--panel-2); resize: none; }
  .ticket-off-note { margin-top: 7px; font-size: 12px; color: var(--ink-4); font-style: italic; }
  .ta-foot { display: flex; align-items: center; gap: 7px; margin-top: 6px; font-size: 12px; }
  .ta-foot-right { margin-left: auto; }
  .at-default { display: inline-flex; align-items: center; gap: 4px; color: oklch(45% 0.12 145); font-size: 11.5px; }
  .ta-changed { display: inline-flex; align-items: center; gap: 5px; color: oklch(45% 0.12 70); font-size: 11.5px; }
  .ta-dot { width: 6px; height: 6px; border-radius: 50%; background: oklch(65% 0.13 70); flex-shrink: 0; }
  .btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }

  .stack-diag { display: flex; flex-direction: column; }
  .stack-layer {
    display: flex; align-items: center; gap: 12px;
    padding: 11px 14px; border: 1px solid var(--line);
    border-radius: 8px; background: var(--panel-2);
  }
  .stack-layer.is-active { background: var(--accent-soft); border-color: var(--accent-line); }
  .sl-num { font-family: 'Geist Mono', monospace; font-size: 11px; color: var(--ink-4); flex-shrink: 0; }
  .stack-layer.is-active .sl-num { color: var(--accent); }
  .sl-info { flex: 1; min-width: 0; }
  .sl-name { font-size: 13px; font-weight: 500; color: var(--ink-2); margin-bottom: 1px; }
  .stack-layer.is-active .sl-name { color: var(--ink); }
  .sl-desc { font-size: 12px; color: var(--ink-4); line-height: 1.4; }
  .sl-tag {
    font-size: 10.5px; color: var(--ink-4); font-family: 'Geist Mono', monospace;
    background: var(--panel); border: 1px solid var(--line);
    border-radius: 4px; padding: 1px 6px; flex-shrink: 0;
  }
  .stack-layer.is-active .sl-tag { color: var(--accent); border-color: var(--accent-line); background: oklch(100% 0 0); }
  .stack-arrow { text-align: center; color: var(--ink-4); font-size: 14px; padding: 3px 0; }

  .prompt-block { border: 1px solid var(--line); border-radius: 8px; overflow: hidden; font-family: 'Geist Mono', monospace; }
  .pb-head {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 12px; background: var(--panel-2); border-bottom: 1px solid var(--line);
    font-size: 12px; color: var(--ink-3);
  }
  .pb-dot { width: 8px; height: 8px; border-radius: 50%; background: oklch(72% 0.12 75); flex-shrink: 0; }
  .pb-sep { color: var(--ink-4); }
  .pb-pre {
    margin: 0; padding: 12px 0; font-size: 12px; line-height: 1.65;
    background: var(--panel); overflow: auto; max-height: 320px;
    white-space: pre; color: var(--ink-2);
  }
  .pb-pre > div { display: flex; padding: 0 12px; }
  .pb-pre > div:hover { background: var(--panel-2); }
  .ln { flex-shrink: 0; width: 28px; color: var(--ink-4); font-size: 11px; padding-right: 10px; user-select: none; }
  .tok-comment { color: var(--ink-4); }
  .tok-var { color: var(--accent); }
  .pb-foot {
    display: flex; align-items: center; gap: 7px;
    padding: 7px 12px; background: var(--panel-2); border-top: 1px solid var(--line);
    font-size: 11.5px; color: var(--ink-4);
  }
  .stat b { color: var(--ink-3); font-weight: 500; }

  .inst-savebar {
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    display: flex; align-items: center; gap: 12px;
    background: var(--panel); border: 1px solid var(--line-strong);
    border-radius: 10px; padding: 10px 14px;
    box-shadow: 0 4px 16px rgba(20,18,14,.1), 0 1px 3px rgba(20,18,14,.06);
    font-size: 13px; z-index: 50; white-space: nowrap;
    opacity: 0; pointer-events: none; transition: opacity .18s ease;
  }
  .inst-savebar.visible { opacity: 1; pointer-events: auto; }
  .savebar-dot { width: 7px; height: 7px; border-radius: 50%; background: oklch(65% 0.13 70); flex-shrink: 0; }
  .savebar-msg { color: var(--ink-2); }
  .savebar-msg b { font-weight: 600; }
  .savebar-actions { display: flex; gap: 6px; }
`;

// --- Save bar / TOC script ---

const SAVE_SCRIPT = `
(function() {
  var form = document.getElementById('inst-form');
  var savebar = document.getElementById('inst-savebar');
  var countEl = document.getElementById('savebar-count');
  var wordEl = document.getElementById('savebar-word');
  var discardBtn = document.getElementById('savebar-discard');
  if (!form || !savebar) return;

  var initials = {};
  form.querySelectorAll('textarea[data-initial]').forEach(function(ta) {
    initials[ta.name] = ta.getAttribute('data-initial');
  });

  function countDirty() {
    var n = 0;
    form.querySelectorAll('textarea[name]').forEach(function(ta) {
      if (ta.value !== initials[ta.name]) n++;
    });
    return n;
  }

  function updateSavebar() {
    var n = countDirty();
    savebar.classList.toggle('visible', n > 0);
    countEl.textContent = n;
    wordEl.textContent = n === 1 ? 'change' : 'changes';
  }

  function updateFieldStatus(ta) {
    var foot = ta.closest('.if-body') && ta.closest('.if-body').querySelector('.ta-foot');
    if (!foot) return;
    var statusEl = foot.querySelector('.at-default, .ta-changed');
    if (!statusEl) return;
    var isModified = ta.value !== initials[ta.name];
    var span = document.createElement('span');
    if (isModified) {
      span.className = 'ta-changed';
      span.innerHTML = '<span class="ta-dot"></span> modified';
    } else {
      span.className = 'at-default';
      span.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="11" height="11" stroke-width="2"><polyline points="5 12.5 10 17.5 19 7.5"/></svg> at default';
    }
    statusEl.replaceWith(span);
    var resetBtn = foot.querySelector('button[name="reset_field"]');
    if (resetBtn) {
      resetBtn.disabled = !isModified;
      resetBtn.style.opacity = isModified ? '' : '0.45';
    }
  }

  form.querySelectorAll('textarea[name]').forEach(function(ta) {
    ta.addEventListener('input', function() {
      updateFieldStatus(ta);
      updateSavebar();
    });
  });

  discardBtn.addEventListener('click', function() {
    form.querySelectorAll('textarea[name]').forEach(function(ta) {
      ta.value = initials[ta.name];
      updateFieldStatus(ta);
    });
    updateSavebar();
  });

  var sections = document.querySelectorAll('#overview, #system, #instructions');
  var tocLinks = document.querySelectorAll('.toc-link');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries) {
      var visible = entries.filter(function(e) { return e.isIntersecting; })
        .sort(function(a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      if (visible[0]) {
        tocLinks.forEach(function(a) { a.classList.remove('toc-active'); });
        var active = document.querySelector('.toc-link[href="#' + visible[0].target.id + '"]');
        if (active) active.classList.add('toc-active');
      }
    }, { rootMargin: '-100px 0px -60% 0px', threshold: 0.01 });
    sections.forEach(function(el) { io.observe(el); });
  }
})();
`;

// --- Sub-components ---

type StackLayerDef = { n: string; name: string; desc: string; tag: string; active: boolean };

const STACK_LAYERS: StackLayerDef[] = [
	{ n: '01', name: 'System Rules',         desc: 'Hardcoded directives, tools, response format. Shipped with the release.',              tag: 'locked',    active: false },
	{ n: '02', name: 'Company Instructions', desc: 'The four editable fields below. Substituted into the system prompt at request time.',  tag: 'editable',  active: true },
	{ n: '03', name: 'Knowledge Base',       desc: 'Top-k chunks retrieved per turn from indexed documents.',                             tag: 'retrieved', active: false },
	{ n: '04', name: 'Conversation memory',  desc: 'Last 10 messages of the current conversation, included as chat history.',             tag: 'runtime',   active: false },
];

const StackDiagram: FC = () => (
	<div class="stack-diag">
		{STACK_LAYERS.map((l, i) => (
			<>
				<div class={`stack-layer${l.active ? ' is-active' : ''}`}>
					<div class="sl-num">{l.n}</div>
					<div class="sl-info">
						<div class="sl-name">{l.name}</div>
						<div class="sl-desc">{l.desc}</div>
					</div>
					<div class="sl-tag">{l.tag}</div>
				</div>
				{i < STACK_LAYERS.length - 1 && <div class="stack-arrow">↓</div>}
			</>
		))}
	</div>
);

const PromptBlock: FC = () => {
	const lines = LAYER_1.split('\n');
	const tokenEstimate = Math.round(LAYER_1.length / 4);
	return (
		<div class="prompt-block">
			<div class="pb-head">
				<span class="pb-dot" />
				<span>system_prompt.tmpl</span>
				<span class="pb-sep">·</span>
				<span>read-only</span>
			</div>
			<pre class="pb-pre">
				{lines.map((line, i) => {
					const num = String(i + 1).padStart(2, '0');
					if (line.startsWith('##')) {
						return <div><span class="ln">{num}</span><span class="tok-comment">{line}</span></div>;
					}
					if (line.includes('{')) {
						const parts = line.split(/(\{[^}]+\})/g);
						return (
							<div>
								<span class="ln">{num}</span>
								{parts.map(p => /^\{[^}]+\}$/.test(p) ? <span class="tok-var">{p}</span> : p)}
							</div>
						);
					}
					return <div><span class="ln">{num}</span>{line || ' '}</div>;
				})}
			</pre>
			<div class="pb-foot">
				<span class="stat"><b>{lines.length}</b> lines</span>
				<span class="pb-sep">·</span>
				<span class="stat">~<b>{tokenEstimate}</b> tokens</span>
			</div>
		</div>
	);
};

const InstructionField: FC<{ field: FieldDef; value: string; isFirst: boolean; disabled?: boolean }> = ({
	field,
	value,
	isFirst,
	disabled,
}) => {
	const isDefault = value === DEFAULTS[field.key];
	return (
		<div class={`inst-field${isFirst ? ' inst-field-first' : ''}`}>
			<div class="if-meta">
				<span class="if-key">{field.key}</span>
				<div class="if-name">{field.label}</div>
				<div class="if-hint">{field.hint}</div>
			</div>
			<div class="if-body">
				{disabled
					? <input type="hidden" name={field.key} value={value} />
					: null
				}
				<textarea class="ta" name={disabled ? undefined : field.key} data-initial={value} placeholder={field.placeholder} spellcheck={true} disabled={disabled}>
					{value}
				</textarea>
				{disabled
					? <div class="ticket-off-note">Ticket feature is disabled — enable it in Config to edit this field.</div>
					: <div class="ta-foot">
						{isDefault
							? <span class="at-default">{IcnCheck} at default</span>
							: <span class="ta-changed"><span class="ta-dot" /> modified</span>
						}
						<div class="ta-foot-right">
							<button
								type="submit"
								name="reset_field"
								value={field.key}
								class="btn ghost btn-sm"
								disabled={isDefault}
								style={isDefault ? 'opacity:0.45' : undefined}
							>
								{IcnReset} Reset to default
							</button>
						</div>
					</div>
				}
			</div>
		</div>
	);
};

const TriggerPhrasesField: FC<{ value: string; isFirst?: boolean; disabled?: boolean }> = ({ value, isFirst, disabled }) => (
	<div class={`inst-field${isFirst ? ' inst-field-first' : ''}`}>
		<div class="if-meta">
			<span class="if-key">trigger_phrases</span>
			<div class="if-name">Ticket Trigger Phrases</div>
			<div class="if-hint">Phrases that immediately surface the ticket button when matched in user input (case-insensitive, one per line). Complements the AI's contextual judgement.</div>
		</div>
		<div class="if-body">
			{disabled
				? <input type="hidden" name="trigger_phrases" value={value} />
				: null
			}
			<textarea class="ta" name={disabled ? undefined : 'trigger_phrases'} data-initial={value}
				placeholder={'talk to a human\nspeak to someone\nreal person\ncontact support'}
				spellcheck={false} disabled={disabled}>
				{value}
			</textarea>
			{disabled
				? <div class="ticket-off-note">Ticket feature is disabled — enable it in Config to edit this field.</div>
				: <div class="ta-foot">
					<span class="ta-changed" style="visibility:hidden"><span class="ta-dot" /> modified</span>
				</div>
			}
		</div>
	</div>
);

// --- Page ---

const TOC_LINKS = [
	{ href: '#overview',     label: 'Prompt stack' },
	{ href: '#system',       label: 'System rules' },
	{ href: '#instructions', label: 'Company instructions' },
];

const InstructionsPage: FC<{ saved: boolean; csrfToken: string }> = ({ saved, csrfToken }) => {
	const instr = getInstructions();
	const config = getConfig();
	const agent = getAgent();
	const ticketEnabled = config['ticket_enabled'] !== '0';
	const triggerPhrases = (JSON.parse(agent.trigger_phrases || '[]') as string[]).join('\n');
	return (
		<Layout title="Instructions" currentPath="/admin/instructions" section="Settings" showTitle={false}>
			<style>{raw(PAGE_CSS)}</style>
			<PageWrap>
				{saved && <Flash variant="ok">{IcnCheck} Instructions saved successfully.</Flash>}

				<PageHeader
					title="Instructions"
					subtitle="Steer the assistant's tone, scope, and escalation behaviour. Edits apply on save — no redeploy needed."
				/>

				<TwoColToc toc={<TocNav links={TOC_LINKS} linkClass="toc-link" />}>

					<Card id="overview">
						<CardHead num="00" title="Prompt stack" desc="Each turn, the assistant assembles its prompt from four layers in this order. Layer 02 is what you edit on this page; the others are managed elsewhere." />
						<CardBody>
							<StackDiagram />
						</CardBody>
					</Card>

					<Card id="system">
						<CardHead
							num="01"
							title="System rules"
							desc={<>The base prompt shipped with the platform release. It defines tools, hard guardrails, and response format. Variables in <span class="mono" style="font-size:11.5px">{'{'+'curly_braces'+'}'}</span> are filled in from your Company Instructions on each request.</>}
						>
							<Pill>{IcnLock} read-only</Pill>
						</CardHead>
						<CardBody>
							<PromptBlock />
						</CardBody>
					</Card>

					<Card id="instructions">
						<CardHead num="02" title="Company instructions" desc="Four free-form fields that shape every reply. Edits apply immediately on save — no redeploy needed. Leave a field blank to fall back to the default for that variable." />
						<CardBody>
							<form method="post" action="/admin/instructions" id="inst-form">
								<input type="hidden" name="_csrf" value={csrfToken} />
								{FIELDS.map((f, i) => (
									<>
										<InstructionField
											field={f}
											value={instr[f.key] ?? ''}
											isFirst={i === 0}
											disabled={!ticketEnabled && f.key === 'escalation_hints'}
										/>
										{f.key === 'escalation_hints' && (
											<TriggerPhrasesField value={triggerPhrases} disabled={!ticketEnabled} />
										)}
									</>
								))}
							</form>
						</CardBody>
					</Card>

				</TwoColToc>
			</PageWrap>

			<div class="inst-savebar" id="inst-savebar">
				<span class="savebar-dot" />
				<span class="savebar-msg">
					<b id="savebar-count">0</b> unsaved <span id="savebar-word">changes</span>
				</span>
				<div class="savebar-actions">
					<button class="btn" type="button" id="savebar-discard">Discard</button>
					<button class="btn primary btn-sm" type="submit" form="inst-form" name="action" value="save">
						{IcnCheck} Save instructions
					</button>
				</div>
			</div>

			<script>{raw(SAVE_SCRIPT)}</script>
		</Layout>
	);
};

export function instructionsView(saved = false, csrfToken = ''): string {
	return '<!DOCTYPE html>' + String(<InstructionsPage saved={saved} csrfToken={csrfToken} />);
}
