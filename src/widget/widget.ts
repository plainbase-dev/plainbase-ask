import { marked } from "marked";
marked.use({ breaks: true });

function sanitizeMarkdown(html: string): string {
	const allowed = new Set([
		"P",
		"STRONG",
		"EM",
		"UL",
		"OL",
		"LI",
		"A",
		"BR",
		"HR",
	]);
	const doc = new DOMParser().parseFromString(html, "text/html");

	function clean(node: Node): Node | null {
		if (node.nodeType === Node.TEXT_NODE) return node.cloneNode(true);
		if (node.nodeType !== Node.ELEMENT_NODE) return null;
		const el = node as Element;
		if (!allowed.has(el.tagName)) {
			const frag = document.createDocumentFragment();
			el.childNodes.forEach((child) => {
				const c = clean(child);
				if (c) frag.appendChild(c);
			});
			return frag;
		}
		const clone = document.createElement(el.tagName.toLowerCase());
		if (el.tagName === "A") {
			const href = el.getAttribute("href") ?? "";
			if (/^https?:\/\//.test(href)) {
				clone.setAttribute("href", href);
				clone.setAttribute("target", "_blank");
				clone.setAttribute("rel", "noopener noreferrer");
			}
		}
		el.childNodes.forEach((child) => {
			const c = clean(child);
			if (c) clone.appendChild(c);
		});
		return clone;
	}

	const wrapper = document.createElement("div");
	doc.body.childNodes.forEach((child) => {
		const c = clean(child);
		if (c) wrapper.appendChild(c);
	});
	return wrapper.innerHTML;
}

function renderMarkdown(text: string): string {
	return sanitizeMarkdown(marked.parse(text) as string);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

(function () {
	const script = document.currentScript as HTMLScriptElement | null;
	if (!script) return;

	const agentId = script.getAttribute("data-agent-id") ?? "";
	const apiBase =
		script.getAttribute("data-api-base") ??
		script.src.replace(/\/widget\.js.*$/, "");

	type State =
		| "idle"
		| "loading"
		| "streaming"
		| "awaiting_ticket_email"
		| "ticket_submitted";

	let state: State = "idle";
	let conversationId: string | null = null;
	let ticketTriggered = false;
	let starterMessageShown = false;
	let selectedLanguage: string | null = null;
	let ticketButtonLabel = "Create a ticket";
	let ticketCardTitle = "Leave us a message";
	let ticketCardText = "";
	let ticketCardOfficeHours = "";
	let brandLogoUrl: string | null = null;

	// SVG constants
	const sparkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>`;
	const closeSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
	const sendSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l14-7-5 18-3-7-6-4z"/></svg>`;
	const chatSvg = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 5h16a2 2 0 012 2v9a2 2 0 01-2 2h-9l-5 4v-4H4a2 2 0 01-2-2V7a2 2 0 012-2z"/></svg>`;
	const mailSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v12H4z"/><path d="M4 7l8 6 8-6"/></svg>`;
	const checkSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>`;

	// --- Styles ---

	const styles = `
    :root{--sb-primary:#2563eb;--sb-primary-rgb:37,99,235;}
    @keyframes sb-typing{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-3px);opacity:1}}
    @keyframes sb-fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}

    #sb-btn-wrapper{
      position:fixed;bottom:24px;right:24px;z-index:9999;
      display:flex;align-items:center;gap:10px;cursor:pointer;
    }
    #sb-btn{
      width:56px;height:56px;border-radius:50%;
      background:var(--sb-primary);border:none;color:#fff;
      box-shadow:0 10px 24px rgba(var(--sb-primary-rgb),.35),0 0 0 1px rgba(0,0,0,.04);
      display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;
      transition:transform .18s cubic-bezier(.2,.7,.3,1);
    }
    #sb-btn:hover{transform:translateY(-1px);}
    #sb-btn svg{width:22px;height:22px;}
    #sb-btn-label{
      display:none;
      background:#fff;color:#0e1116;
      font:500 13px/1 inherit;padding:9px 12px;border-radius:10px;
      box-shadow:0 8px 24px rgba(0,0,0,.10),0 0 0 1px rgba(0,0,0,.04);
      white-space:nowrap;pointer-events:none;
      font-family:"Inter",ui-sans-serif,system-ui,sans-serif;
    }

    #sb-panel{
      position:fixed;bottom:92px;right:24px;z-index:9999;
      width:380px;height:600px;
      background:#fff;border-radius:18px;
      box-shadow:0 24px 60px rgba(15,20,30,.18),0 4px 16px rgba(15,20,30,.06),0 0 0 1px rgba(15,20,30,.04);
      display:flex;flex-direction:column;
      font-family:"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
      font-size:14px;overflow:hidden;
    }

    #sb-header{
      padding:16px 16px 18px;
      background:#fff;border-bottom:1px solid #e7e9ee;
      display:flex;align-items:center;gap:12px;flex-shrink:0;
    }
    #sb-brand-mark{
      width:36px;height:36px;border-radius:10px;
      background:var(--sb-primary);
      display:inline-flex;align-items:center;justify-content:center;
      flex:0 0 auto;color:#fff;
    }
    #sb-brand-mark svg{width:20px;height:20px;}
    #sb-header-text{min-width:0;flex:1;}
    #sb-title{font:600 15px/1.2 inherit;letter-spacing:-.005em;color:#0e1116;}
    #sb-subtitle{
      font:400 12.5px/1.3 inherit;color:#6b7280;margin-top:2px;
      display:flex;align-items:center;gap:6px;
    }
    #sb-subtitle svg{flex:0 0 auto;opacity:.85;}
    #sb-close-btn{
      width:30px;height:30px;border-radius:8px;border:0;
      background:transparent;color:#0e1116;cursor:pointer;
      display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;
    }
    #sb-close-btn:hover{background:rgba(0,0,0,.06);}
    #sb-close-btn svg{width:14px;height:14px;}

    #sb-messages{
      flex:1;overflow-y:auto;padding:16px 14px 14px;
      display:flex;flex-direction:column;gap:10px;
      background:#fff;overscroll-behavior:contain;
    }
    #sb-messages::-webkit-scrollbar{width:6px;}
    #sb-messages::-webkit-scrollbar-thumb{background:rgba(0,0,0,.12);border-radius:3px;}
    #sb-messages::-webkit-scrollbar-track{background:transparent;}

    .sb-bot-row{display:flex;gap:8px;align-items:flex-end;animation:sb-fadein .25s ease-out both;}
    .sb-bot-avatar{
      width:24px;height:24px;border-radius:7px;
      background:var(--sb-primary);flex:0 0 auto;color:#fff;
      display:inline-flex;align-items:center;justify-content:center;
    }
    .sb-bot-avatar svg{width:13px;height:13px;}
    .sb-bot-col{display:flex;flex-direction:column;align-items:flex-start;max-width:78%;}
    .sb-msg-bot{
      background:#f3f4f7;color:#0e1116;
      padding:10px 13px;border-radius:14px 14px 14px 4px;
      font:400 14px/1.45 inherit;letter-spacing:-.003em;
      word-break:break-word;
    }
    .sb-msg-bot p{margin:4px 0;}
    .sb-msg-bot p:first-child{margin-top:0;}
    .sb-msg-bot p:last-child{margin-bottom:0;}
    .sb-msg-bot ul,.sb-msg-bot ol{padding-left:18px;margin:4px 0;}
    .sb-msg-bot li{margin:2px 0;}
    .sb-msg-bot a{color:var(--sb-primary);text-decoration:underline;}
    .sb-msg-bot strong{font-weight:600;}

    .sb-user-row{display:flex;justify-content:flex-end;animation:sb-fadein .25s ease-out both;}
    .sb-user-col{display:flex;flex-direction:column;align-items:flex-end;max-width:78%;}
    .sb-msg-user{
      background:var(--sb-primary);color:#fff;
      padding:10px 13px;border-radius:14px 14px 4px 14px;
      font:400 14px/1.45 inherit;letter-spacing:-.003em;
      white-space:pre-wrap;word-break:break-word;
    }

    .sb-msg-status{
      font:500 11px/1 inherit;color:#6b7280;
      text-align:center;letter-spacing:.04em;
      animation:sb-fadein .25s ease-out both;
    }

    .sb-typing-row{display:flex;gap:8px;align-items:flex-end;animation:sb-fadein .25s ease-out both;}
    .sb-typing-bubble{
      background:#f3f4f7;padding:12px 14px;
      border-radius:14px 14px 14px 4px;
      display:inline-flex;gap:4px;
    }
    .sb-typing-dot{
      width:6px;height:6px;border-radius:50%;background:#6b7280;
      animation:sb-typing 1.2s infinite ease-in-out;
    }
    .sb-typing-dot:nth-child(2){animation-delay:.15s;}
    .sb-typing-dot:nth-child(3){animation-delay:.30s;}

    .sb-lang-picker{
      margin-left:32px;display:flex;flex-direction:column;gap:6px;
      animation:sb-fadein .25s ease-out both;
    }
    .sb-lang-label{font:500 11.5px/1 inherit;color:#6b7280;letter-spacing:.02em;}
    .sb-lang-pills{display:flex;flex-wrap:wrap;gap:6px;}
    .sb-lang-pill{
      font:500 12.5px/1 inherit;color:#0e1116;
      background:#fff;border:1px solid #e7e9ee;
      padding:7px 11px;border-radius:999px;cursor:pointer;
      display:inline-flex;align-items:center;gap:7px;
      transition:background .12s,border-color .12s;
    }
    .sb-lang-pill:hover{background:#f6f7fa;border-color:#d4d7de;}
    .sb-lang-pill.active{background:var(--sb-primary);color:#fff;border-color:var(--sb-primary);}

    .sb-action-card{
      margin-left:32px;
      background:#fff;border:1px solid #e7e9ee;border-radius:14px;padding:14px;
      display:flex;flex-direction:column;gap:10px;
      animation:sb-fadein .25s ease-out both;
    }
    .sb-card-header{display:flex;align-items:flex-start;gap:10px;}
    .sb-card-icon{
      width:28px;height:28px;border-radius:8px;
      background:rgba(var(--sb-primary-rgb),.10);color:var(--sb-primary);
      display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;
    }
    .sb-card-icon.success{background:rgba(14,124,102,.10);color:#0e7c66;}
    .sb-card-body-wrap{min-width:0;flex:1;}
    .sb-card-title{font:600 13.5px/1.25 inherit;color:#0e1116;letter-spacing:-.005em;}
    .sb-card-body{font:400 13px/1.45 inherit;color:#3a414b;margin-top:4px;}
    .sb-card-cta{
      font:600 13.5px/1 inherit;color:#fff;background:var(--sb-primary);
      border:0;padding:11px 14px;border-radius:10px;cursor:pointer;width:100%;
      display:inline-flex;align-items:center;justify-content:center;
      transition:filter .15s;
    }
    .sb-card-cta:hover{filter:brightness(.96);}
    .sb-card-cta:disabled{opacity:.6;cursor:not-allowed;}

    .sb-email-row{
      display:flex;align-items:center;gap:4px;
      background:#f7f8fa;border:1px solid #e7e9ee;border-radius:10px;
      padding:4px 4px 4px 12px;
    }
    .sb-email-input{
      flex:1;min-width:0;height:32px;border:0;background:transparent;
      font:400 13.5px/1.3 inherit;color:#0e1116;outline:none;
      font-family:inherit;
    }
    .sb-email-submit{
      font:600 12.5px/1 inherit;color:#fff;background:var(--sb-primary);
      border:0;height:30px;padding:0 12px;border-radius:7px;cursor:pointer;
      white-space:nowrap;flex:0 0 auto;
    }
    .sb-email-submit:disabled{opacity:.6;cursor:not-allowed;}

    .sb-office-hours{border-top:1px solid #e7e9ee;padding-top:10px;display:flex;flex-direction:column;gap:6px;}
    .sb-office-label{font:600 11px/1 inherit;color:#6b7280;letter-spacing:.06em;text-transform:uppercase;}
    .sb-office-row{display:flex;justify-content:space-between;font:400 12.5px/1.3 inherit;color:#3a414b;}
    .sb-office-val{color:#0e1116;font-variant-numeric:tabular-nums;}

    #sb-footer{
      flex-shrink:0;border-top:1px solid #e7e9ee;background:#fff;
      padding:10px 10px 12px;
      padding-bottom:max(12px,env(safe-area-inset-bottom));
    }
    #sb-input-row{
      display:flex;align-items:center;gap:6px;
      background:#fff;border:1px solid #e7e9ee;border-radius:12px;
      padding:4px 4px 4px 10px;
    }
    #sb-input{
      flex:1;min-width:0;border:0;background:transparent;
      font:400 14px/1.4 inherit;color:#0e1116;outline:none;
      resize:none;overflow-y:auto;max-height:80px;min-height:34px;
      font-family:inherit;padding:7px 0;
    }
    #sb-input::placeholder{color:#6b7280;}
    #sb-input:disabled{color:#9ca3af;}
    #sb-send{
      width:34px;height:34px;border-radius:9px;border:0;
      background:#e7e9ee;color:#6b7280;
      cursor:pointer;flex:0 0 auto;
      display:inline-flex;align-items:center;justify-content:center;
      transition:filter .15s,background .12s,color .12s;
    }
    #sb-send svg{width:15px;height:15px;}
    #sb-send.active{background:var(--sb-primary);color:#fff;}
    #sb-send:disabled{opacity:.5;cursor:not-allowed;}
    #sb-powered{
      font-weight:400;font-size:8px;color:#6b7280;text-align:center;
      margin-top:8px;letter-spacing:.01em;
    }
    #sb-powered strong{color:#3a414b;font-weight:500;}

    @media(max-width:640px){
      #sb-panel{
        top:0;left:0;right:0;bottom:0;
        width:100%;height:100dvh;
        border-radius:0;box-shadow:none;position:fixed;
      }
      #sb-header{padding-top:max(16px,env(safe-area-inset-top));}
      #sb-close-btn{display:inline-flex!important;}
      #sb-input{font-size:16px;}
      .sb-email-input{font-size:16px;}
    }
  `;

	const styleEl = document.createElement("style");
	styleEl.textContent = styles;
	document.head.appendChild(styleEl);

	// --- FAB wrapper ---

	const wrapper = document.createElement("div");
	wrapper.id = "sb-btn-wrapper";

	const btnLabelEl = document.createElement("div");
	btnLabelEl.id = "sb-btn-label";

	const btn = document.createElement("button");
	btn.id = "sb-btn";
	btn.setAttribute("aria-label", "Open support chat");
	btn.innerHTML = chatSvg;

	wrapper.appendChild(btnLabelEl);
	wrapper.appendChild(btn);

	// --- Panel ---

	const panel = document.createElement("div");
	panel.id = "sb-panel";
	panel.style.display = "none";
	panel.innerHTML = `
    <div id="sb-header">
      <div id="sb-brand-mark">${sparkSvg}</div>
      <div id="sb-header-text">
        <div id="sb-title">Support</div>
        <div id="sb-subtitle">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>
          </svg>
          <span id="sb-subtitle-text">AI-powered · answers instantly</span>
        </div>
      </div>
      <button id="sb-close-btn" aria-label="Close chat">${closeSvg}</button>
    </div>
    <div id="sb-messages"></div>
    <div id="sb-footer">
      <div id="sb-input-row">
        <textarea id="sb-input" rows="1" placeholder="Ask a question…"></textarea>
        <button id="sb-send" aria-label="Send">${sendSvg}</button>
      </div>
      <div id="sb-powered">Powered by <a href="https://plainbase.dev" target="_blank" rel="noopener noreferrer"><strong>plainbase ask</strong></a></div>
    </div>
  `;

	function mountToDom() {
		document.body.appendChild(wrapper);
		document.body.appendChild(panel);
	}
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", mountToDom);
	} else {
		mountToDom();
	}

	const messagesEl = panel.querySelector("#sb-messages") as HTMLDivElement;
	const inputEl = panel.querySelector("#sb-input") as HTMLTextAreaElement;
	const sendEl = panel.querySelector("#sb-send") as HTMLButtonElement;
	const closeBtnEl = panel.querySelector(
		"#sb-close-btn",
	) as HTMLButtonElement;

	// --- Helpers ---

	function createAvatar(): HTMLElement {
		const el = document.createElement("div");
		el.className = "sb-bot-avatar";
		if (brandLogoUrl) {
			el.style.background = "transparent";
			const img = document.createElement("img");
			img.src = brandLogoUrl;
			img.alt = "";
			img.style.cssText =
				"width:13px;height:13px;object-fit:contain;border-radius:2px;";
			el.appendChild(img);
		} else {
			el.innerHTML = sparkSvg;
		}
		return el;
	}

	function applyBranding(primaryColor?: string, logoUrl?: string | null) {
		if (primaryColor) {
			const r = parseInt(primaryColor.slice(1, 3), 16);
			const g = parseInt(primaryColor.slice(3, 5), 16);
			const b = parseInt(primaryColor.slice(5, 7), 16);
			const el = document.createElement("style");
			el.textContent = `:root{--sb-primary:${primaryColor};--sb-primary-rgb:${r},${g},${b};}`;
			document.head.appendChild(el);
		}
		if (logoUrl) {
			brandLogoUrl = logoUrl;
			const brandMark = panel.querySelector(
				"#sb-brand-mark",
			) as HTMLElement;
			const img = document.createElement("img");
			img.src = logoUrl;
			img.alt = "";
			img.style.cssText =
				"width:28px;height:28px;object-fit:contain;border-radius:6px;";
			img.onerror = () => {
				brandLogoUrl = null;
				brandMark.style.background = "";
				brandMark.innerHTML = sparkSvg;
			};
			brandMark.style.background = "transparent";
			brandMark.innerHTML = "";
			brandMark.appendChild(img);
		}
	}

	function addBotMessage(text: string, asMarkdown = false): HTMLElement {
		const row = document.createElement("div");
		row.className = "sb-bot-row";
		const avatar = createAvatar();
		const col = document.createElement("div");
		col.className = "sb-bot-col";
		const bubble = document.createElement("div");
		bubble.className = "sb-msg-bot";
		if (asMarkdown) bubble.innerHTML = renderMarkdown(text);
		else bubble.textContent = text;
		col.appendChild(bubble);
		row.appendChild(avatar);
		row.appendChild(col);
		messagesEl.appendChild(row);
		messagesEl.scrollTop = messagesEl.scrollHeight;
		return bubble;
	}

	function addUserMessage(text: string): void {
		const row = document.createElement("div");
		row.className = "sb-user-row";
		const col = document.createElement("div");
		col.className = "sb-user-col";
		const bubble = document.createElement("div");
		bubble.className = "sb-msg-user";
		bubble.textContent = text;
		col.appendChild(bubble);
		row.appendChild(col);
		messagesEl.appendChild(row);
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	function addStatusMessage(text: string): HTMLElement {
		const el = document.createElement("div");
		el.className = "sb-msg-status";
		el.textContent = text;
		messagesEl.appendChild(el);
		messagesEl.scrollTop = messagesEl.scrollHeight;
		return el;
	}

	function showTyping(): HTMLElement {
		const row = document.createElement("div");
		row.className = "sb-typing-row";
		row.id = "sb-typing";
		const avatar = createAvatar();
		const bubble = document.createElement("div");
		bubble.className = "sb-typing-bubble";
		for (let i = 0; i < 3; i++) {
			const dot = document.createElement("span");
			dot.className = "sb-typing-dot";
			bubble.appendChild(dot);
		}
		row.appendChild(avatar);
		row.appendChild(bubble);
		messagesEl.appendChild(row);
		messagesEl.scrollTop = messagesEl.scrollHeight;
		return row;
	}

	// --- State helpers ---

	function setState(s: State) {
		state = s;
		const busy =
			s === "loading" ||
			s === "streaming" ||
			s === "awaiting_ticket_email" ||
			s === "ticket_submitted";
		sendEl.disabled = busy;
		inputEl.disabled = busy;
	}

	// --- Language picker ---

	type LangOption = {
		code: string;
		label: string;
		starterMessage: string;
		widgetTitle?: string;
		widgetSubtitle?: string;
		chatInputPlaceholder?: string;
		ticketButtonLabel?: string;
		ticketCardTitle?: string;
		ticketCardText?: string;
		ticketCardOfficeHours?: string;
	};

	function applyLangConfig(lang: LangOption) {
		const titleEl = panel.querySelector("#sb-title") as HTMLElement;
		const subtitleTextEl = panel.querySelector(
			"#sb-subtitle-text",
		) as HTMLElement;
		if (lang.widgetTitle) titleEl.textContent = lang.widgetTitle;
		if (lang.widgetSubtitle)
			subtitleTextEl.textContent = lang.widgetSubtitle;
		if (lang.chatInputPlaceholder)
			inputEl.placeholder = lang.chatInputPlaceholder;
		ticketButtonLabel = lang.ticketButtonLabel || "Create a ticket";
		ticketCardTitle = lang.ticketCardTitle || "Leave us a message";
		ticketCardText = lang.ticketCardText ?? "";
		ticketCardOfficeHours = lang.ticketCardOfficeHours ?? "";
	}

	function showLangPicker(langs: LangOption[]) {
		let currentStarterRow: HTMLElement | null = messagesEl.querySelector(
			".sb-bot-row",
		) as HTMLElement | null;

		const picker = document.createElement("div");
		picker.className = "sb-lang-picker";
		picker.id = "sb-lang-picker";

		const labelEl = document.createElement("div");
		labelEl.className = "sb-lang-label";
		labelEl.textContent = "Choose a language";

		const pillsEl = document.createElement("div");
		pillsEl.className = "sb-lang-pills";

		langs.forEach((lang, i) => {
			const pill = document.createElement("button");
			pill.className = "sb-lang-pill" + (i === 0 ? " active" : "");
			pill.textContent = lang.label;
			pill.onclick = () => {
				pillsEl
					.querySelectorAll(".sb-lang-pill")
					.forEach((p) => p.classList.remove("active"));
				pill.classList.add("active");
				selectedLanguage = lang.code;
				applyLangConfig(lang);
				// Replace starter message
				if (currentStarterRow) {
					currentStarterRow.remove();
					currentStarterRow = null;
				}
				if (lang.starterMessage) {
					const row = document.createElement("div");
					row.className = "sb-bot-row";
					const avatar = createAvatar();
					const col = document.createElement("div");
					col.className = "sb-bot-col";
					const bubble = document.createElement("div");
					bubble.className = "sb-msg-bot";
					bubble.textContent = lang.starterMessage;
					col.appendChild(bubble);
					row.appendChild(avatar);
					row.appendChild(col);
					messagesEl.insertBefore(row, picker);
					currentStarterRow = row;
				}
				messagesEl.scrollTop = messagesEl.scrollHeight;
			};
			pillsEl.appendChild(pill);
		});

		picker.appendChild(labelEl);
		picker.appendChild(pillsEl);
		messagesEl.appendChild(picker);
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	// --- Ticket flow (E1 → E2 → E3) ---

	function showTicketCard() {
		if (ticketTriggered) return;
		ticketTriggered = true;

		const card = document.createElement("div");
		card.className = "sb-action-card";
		card.id = "sb-ticket-card";

		function renderE1() {
			const bodyHtml = ticketCardText
				? `<div class="sb-card-body">${escapeHtml(ticketCardText)}</div>`
				: "";
			card.innerHTML = `
        <div class="sb-card-header">
          <div class="sb-card-icon">${mailSvg}</div>
          <div class="sb-card-body-wrap">
            <div class="sb-card-title">${escapeHtml(ticketCardTitle)}</div>
            ${bodyHtml}
          </div>
        </div>
        <button class="sb-card-cta" id="sb-card-cta-btn">${escapeHtml(ticketButtonLabel)}</button>
      `;
			card.querySelector("#sb-card-cta-btn")!.addEventListener(
				"click",
				renderE2,
			);
		}

		function renderE2() {
			card.innerHTML = `
        <div class="sb-card-header">
          <div class="sb-card-icon">${mailSvg}</div>
          <div class="sb-card-body-wrap">
            <div class="sb-card-title">What’s your email?</div>
            <div class="sb-card-body">We’ll send our reply here so you can keep track of the conversation.</div>
          </div>
        </div>
        <div class="sb-email-row">
          <input class="sb-email-input" type="email" placeholder="you@example.com" id="sb-email-input" autocomplete="email" />
          <button class="sb-email-submit" id="sb-email-send">Send</button>
        </div>
      `;
			const emailInput = card.querySelector(
				"#sb-email-input",
			) as HTMLInputElement;
			const submitBtn = card.querySelector(
				"#sb-email-send",
			) as HTMLButtonElement;
			setTimeout(() => emailInput.focus(), 50);

			const errorEl = document.createElement("div");
			errorEl.style.cssText =
				"font:400 12px/1.3 inherit;color:#dc2626;padding:0 2px;";
			card.querySelector(".sb-email-row")!.insertAdjacentElement(
				"afterend",
				errorEl,
			);

			const showError = (msg: string) => {
				errorEl.textContent = msg;
			};

			const doSend = async () => {
				const email = emailInput.value.trim();
				if (!email || !email.includes("@")) {
					showError("Please enter a valid email address.");
					emailInput.focus();
					return;
				}
				errorEl.textContent = "";
				submitBtn.disabled = true;
				submitBtn.textContent = "…";
				try {
					console.log("[ticket] submitting", {
						conversationId,
						email,
						apiBase,
					});
					const res = await fetch(`${apiBase}/api/ticket`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							conversationId,
							userEmail: email,
						}),
					});
					const body = await res.text();
					console.log("[ticket] response", res.status, body);
					if (res.ok) {
						renderE3(email);
					} else {
						submitBtn.disabled = false;
						submitBtn.textContent = "Send";
						showError(
							res.status === 409
								? "A ticket was already created for this conversation."
								: `Something went wrong (${res.status}). Please try again.`,
						);
					}
				} catch (err) {
					console.error("[ticket] fetch error", err);
					submitBtn.disabled = false;
					submitBtn.textContent = "Send";
					showError("Connection error. Please try again.");
				}
			};

			submitBtn.onclick = doSend;
			emailInput.onkeydown = (e) => {
				if (e.key === "Enter") doSend();
			};
		}

		function renderE3(email: string) {
			const ohRows = ticketCardOfficeHours
				.split("\n")
				.map((line) => line.trim())
				.filter(Boolean)
				.map((line) => {
					const sep = line.indexOf("|");
					return sep > -1
						? {
								day: line.slice(0, sep).trim(),
								hours: line.slice(sep + 1).trim(),
							}
						: { day: line, hours: "" };
				});

			const ohHtml = ohRows.length
				? `
        <div class="sb-office-hours">
          <div class="sb-office-label">Office hours</div>
          ${ohRows
				.map(
					(r) => `
            <div class="sb-office-row">
              <span>${escapeHtml(r.day)}</span>
              ${r.hours ? `<span class="sb-office-val">${escapeHtml(r.hours)}</span>` : ""}
            </div>`,
				)
				.join("")}
        </div>`
				: "";

			card.innerHTML = `
        <div class="sb-card-header">
          <div class="sb-card-icon success">${checkSvg}</div>
          <div class="sb-card-body-wrap">
            <div class="sb-card-title">Ticket created</div>
            <div class="sb-card-body">We’ve sent a confirmation to <strong style="color:#0e1116">${escapeHtml(email)}</strong>. Our team will reply during office hours.</div>
          </div>
        </div>
        ${ohHtml}
      `;
			setState("ticket_submitted");
		}

		renderE1();
		messagesEl.appendChild(card);
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	// --- Send message ---

	async function sendMessage() {
		const text = inputEl.value.trim();
		if (
			!text ||
			state === "loading" ||
			state === "streaming" ||
			state === "ticket_submitted"
		)
			return;

		inputEl.value = "";
		inputEl.style.height = "auto";
		sendEl.classList.remove("active");
		// Lock language once user sends their first message
		const langPicker = document.getElementById("sb-lang-picker");
		if (langPicker) langPicker.remove();
		addUserMessage(text);
		const typingEl = showTyping();
		setState("loading");

		try {
			const res = await fetch(`${apiBase}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					conversationId,
					agentId,
					message: text,
					language: selectedLanguage,
				}),
			});

			if (!res.ok) {
				typingEl.remove();
				addStatusMessage("Something went wrong. Please try again.");
				setState("idle");
				return;
			}

			const newConvId = res.headers.get("X-Conversation-Id");
			if (newConvId) conversationId = newConvId;

			typingEl.remove();
			setState("streaming");

			const bubble = addBotMessage("");
			let fullText = "";

			const reader = res.body!.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split("\n");
				buffer = lines.pop() ?? "";

				for (const line of lines) {
					if (line.startsWith("0:")) {
						try {
							const token: string = JSON.parse(line.slice(2));
							fullText += token;
							bubble.innerHTML = renderMarkdown(fullText);
							messagesEl.scrollTop = messagesEl.scrollHeight;
						} catch {
							/* skip */
						}
					} else if (line.startsWith("9:") || line.startsWith("a:")) {
						try {
							const data = JSON.parse(line.slice(2));
							const results = Array.isArray(data) ? data : [data];
							for (const item of results) {
								if (
									item?.toolName === "offer_ticket" ||
									item?.result?.action === "offer_ticket"
								) {
									showTicketCard();
								}
							}
						} catch {
							/* skip */
						}
					}
				}
			}

			if (!fullText.trim()) {
				bubble.innerHTML = renderMarkdown(
					"I’m sorry, I couldn’t find an answer. Would you like to create a support ticket?",
				);
				showTicketCard();
			}

			setState("idle");
		} catch {
			addStatusMessage("Connection error. Please try again.");
			setState("idle");
		}
	}

	// --- Config fetch & open ---

	async function maybeShowStarterMessage() {
		if (starterMessageShown) return;
		starterMessageShown = true;
		try {
			const res = await fetch(`${apiBase}/api/widget-config`);
			if (res.status === 503) {
				wrapper.remove();
				panel.remove();
				styleEl.remove();
				return;
			}
			if (!res.ok) return;

			const data = (await res.json()) as {
				widgetButtonText?: string;
				languages?: LangOption[];
				primaryColor?: string;
				logoUrl?: string | null;
			};

			applyBranding(data.primaryColor, data.logoUrl);

			if (data.widgetButtonText) {
				btnLabelEl.textContent = data.widgetButtonText;
				btnLabelEl.style.display = "block";
			}

			const langs = data.languages ?? [];
			if (langs.length >= 2) {
				// Pre-select the first language; visitor can change it until sending a message
				selectedLanguage = langs[0].code;
				applyLangConfig(langs[0]);
				if (langs[0].starterMessage)
					addBotMessage(langs[0].starterMessage);
				showLangPicker(langs);
			} else if (langs.length === 1) {
				selectedLanguage = langs[0].code;
				applyLangConfig(langs[0]);
				if (langs[0].starterMessage)
					addBotMessage(langs[0].starterMessage);
			}
		} catch {
			/* ignore */
		}
	}

	function openPanel() {
		panel.style.display = "flex";
		btnLabelEl.style.display = "none";
		inputEl.focus();
	}

	function closePanel() {
		panel.style.display = "none";
		if (btnLabelEl.textContent) btnLabelEl.style.display = "block";
	}

	function autoResizeInput() {
		inputEl.style.height = "auto";
		inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + "px";
	}

	// --- Event listeners ---

	wrapper.onclick = (e) => {
		if ((e.target as HTMLElement).closest("#sb-panel")) return;
		const isOpen = panel.style.display !== "none";
		if (isOpen) closePanel();
		else openPanel();
	};

	closeBtnEl.onclick = (e) => {
		e.stopPropagation();
		closePanel();
	};

	sendEl.onclick = sendMessage;

	inputEl.oninput = () => {
		autoResizeInput();
		sendEl.classList.toggle("active", inputEl.value.trim().length > 0);
	};

	inputEl.onkeydown = (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	};

	maybeShowStarterMessage();
})();
