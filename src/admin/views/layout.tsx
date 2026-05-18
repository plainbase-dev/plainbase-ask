import { raw } from "hono/html";
import type { FC, Child } from "hono/jsx";

// --- Icons (static SVG strings — no user data, safe to inject raw) ---
const icnDashboard = raw(
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" stroke-width="1.6"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>`,
);
const icnBook = raw(
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" stroke-width="1.6"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5z"/><path d="M4 5.5v15A2.5 2.5 0 0 0 6.5 18H20"/></svg>`,
);
const icnPencil = raw(
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" stroke-width="1.6"><path d="M14 4l6 6L9 21H3v-6L14 4z"/></svg>`,
);
const icnSliders = raw(
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" stroke-width="1.6"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2.2" fill="currentColor"/><circle cx="15" cy="12" r="2.2" fill="currentColor"/><circle cx="7" cy="18" r="2.2" fill="currentColor"/></svg>`,
);
const icnChat = raw(
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" stroke-width="1.6"><path d="M21 12a8 8 0 1 1-3.5-6.6L21 4l-1 4.5A8 8 0 0 1 21 12z"/></svg>`,
);
const icnWidget = raw(
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" stroke-width="1.6"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>`,
);
const icnInfo = raw(
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><line x1="12" y1="11" x2="12" y2="17"/><circle cx="12" cy="7.5" r=".9" fill="currentColor"/></svg>`,
);
const icnExternal = raw(
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="15" height="15" stroke-width="1.6"><path d="M14 4h6v6"/><line x1="20" y1="4" x2="11" y2="13"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/></svg>`,
);
const icnLogout = raw(
	`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14" stroke-width="1.6"><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 16l-4-4 4-4"/><line x1="6" y1="12" x2="16" y2="12"/></svg>`,
);

// --- Nav ---

type NavEntry = { href: string; label: string; icon: ReturnType<typeof raw> };

const NAV: NavEntry[] = [
	{ href: "/admin", label: "Dashboard", icon: icnDashboard },
	{ href: "/admin/knowledge", label: "Knowledge Base", icon: icnBook },
	{ href: "/admin/instructions", label: "Instructions", icon: icnPencil },
	{ href: "/admin/config", label: "Config", icon: icnSliders },
	{ href: "/admin/conversations", label: "Conversations", icon: icnChat },
	{ href: "/admin/widget", label: "Widget", icon: icnWidget },
];

// --- Global CSS ---

const GLOBAL_CSS = `
  :root {
    --canvas: oklch(97.6% 0.004 85);
    --panel:  oklch(100% 0 0);
    --panel-2: oklch(98.5% 0.003 85);
    --line:   oklch(91% 0.004 85);
    --line-2: oklch(94% 0.004 85);
    --line-strong: oklch(86% 0.005 85);
    --ink:    oklch(20% 0.005 80);
    --ink-2:  oklch(36% 0.005 80);
    --ink-3:  oklch(52% 0.005 80);
    --ink-4:  oklch(66% 0.005 80);
    --accent: oklch(55% 0.13 250);
    --accent-ink: oklch(99% 0 0);
    --accent-soft: oklch(94% 0.03 250);
    --accent-line: oklch(82% 0.06 250);
    --warn: oklch(72% 0.13 75);
    --warn-soft: oklch(95% 0.04 80);
    --warn-line: oklch(85% 0.07 80);
    --danger: oklch(58% 0.18 25);
    --danger-soft: oklch(96% 0.03 25);
    --danger-line: oklch(85% 0.08 25);
    --rail: 232px;
    --gut: 32px;
    --radius: 10px;
    --radius-sm: 7px;
    --row: 36px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: 'Geist', ui-sans-serif, system-ui, -apple-system, sans-serif;
    font-size: 14px;
    line-height: 1.45;
    color: var(--ink);
    background: var(--canvas);
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--ink-2); text-decoration: none; }
  .mono { font-family: 'Geist Mono', ui-monospace, monospace; }

  /* shell */
  .shell { display: grid; grid-template-columns: var(--rail) 1fr; min-height: 100vh; }

  /* sidebar */
  .rail {
    position: sticky; top: 0; height: 100vh;
    border-right: 1px solid var(--line);
    background: var(--canvas);
    display: flex; flex-direction: column;
    padding: 16px 12px 12px;
  }
  .brand {
    display: flex; align-items: center; gap: 9px;
    padding: 6px 8px 18px;
  }
  .brand-logo { flex-shrink: 0; display: block; }
  .brand-env {
    margin-left: auto; font-size: 10px; padding: 2px 6px; border-radius: 4px;
    color: var(--ink-3); background: oklch(94% 0.004 85); border: 1px solid var(--line);
    font-family: 'Geist Mono', monospace; letter-spacing: .02em;
  }
  .nav-group-label {
    font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
    color: var(--ink-4); padding: 14px 10px 6px;
  }
  .nav { display: flex; flex-direction: column; gap: 1px; }
  .nav a {
    display: flex; align-items: center; gap: 10px;
    padding: 6.5px 10px; border-radius: 6px;
    color: var(--ink-2); text-decoration: none; font-size: 13.5px; font-weight: 450;
    transition: background .12s ease;
  }
  .nav a:hover { background: oklch(94% 0.004 85); color: var(--ink); }
  .nav a.active {
    background: var(--panel); color: var(--ink); font-weight: 500;
    box-shadow: 0 0 0 1px var(--line), 0 1px 2px rgba(20,18,14,.04);
  }
  .nav svg { flex-shrink: 0; color: var(--ink-3); }
  .nav a.active svg { color: var(--ink); }
  .rail-foot {
    margin-top: auto; display: flex; flex-direction: column; gap: 1px;
    padding-top: 12px; border-top: 1px dashed var(--line);
  }
  .rail-foot a {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 10px; border-radius: 6px;
    color: var(--ink-3); text-decoration: none; font-size: 13px;
  }
  .rail-foot a:hover { background: oklch(94% 0.004 85); color: var(--ink); }
  .rail-foot svg { flex-shrink: 0; }
  .who {
    display: flex; align-items: center; gap: 9px;
    padding: 8px 8px; margin-top: 6px; border-radius: 8px; cursor: default;
  }
  .who:hover { background: oklch(94% 0.004 85); }
  .who-avatar {
    width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
    background: oklch(85% 0.04 70);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; font-weight: 600; color: oklch(35% 0.04 70);
  }
  .who-meta { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
  .who-name { font-size: 12.5px; font-weight: 500; color: var(--ink); }
  .who-org { font-size: 11px; color: var(--ink-4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* main */
  .main { min-width: 0; display: flex; flex-direction: column; }
  .topbar {
    height: 52px; border-bottom: 1px solid var(--line);
    display: flex; align-items: center;
    padding: 0 var(--gut); gap: 14px;
    background: var(--canvas);
    position: sticky; top: 0; z-index: 5;
  }
  .crumb { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink-3); }
  .crumb .sep { color: var(--ink-4); }
  .crumb .here { color: var(--ink); font-weight: 500; }

  /* page title compatibility (for pages that don't opt-out) */
  .page-title-compat {
    font-size: 20px; font-weight: 600; margin-bottom: 20px; color: var(--ink);
    letter-spacing: -0.01em;
  }

  /* cards */
  .card {
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    margin-bottom: 18px;
    overflow: hidden;
    box-shadow: 0 1px 0 rgba(20,18,14,.02);
  }

  /* tables */
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--line); font-size: 13px; }
  th { background: var(--panel-2); font-weight: 600; color: var(--ink-3); }
  tr:last-child td { border-bottom: none; }

  /* buttons */
  .btn {
    appearance: none; border: 0; cursor: pointer;
    height: 32px; padding: 0 12px;
    font: inherit; font-size: 13px; font-weight: 500;
    border-radius: var(--radius-sm);
    display: inline-flex; align-items: center; gap: 7px;
    background: var(--panel); color: var(--ink);
    border: 1px solid var(--line-strong);
    transition: background .12s ease, border-color .12s ease;
  }
  .btn:hover { background: oklch(98% 0.004 85); }
  .btn.primary, .btn-primary {
    background: var(--accent); color: var(--accent-ink); border-color: var(--accent);
    box-shadow: 0 1px 0 rgba(20,18,14,.06), inset 0 1px 0 rgba(255,255,255,.18);
  }
  .btn.primary:hover, .btn-primary:hover { background: oklch(50% 0.13 250); }
  .btn.ghost { border-color: transparent; background: transparent; color: var(--ink-3); }
  .btn.ghost:hover { background: oklch(94% 0.004 85); color: var(--ink); }
  .btn-secondary {
    background: var(--panel); color: var(--ink-2);
    border: 1px solid var(--line-strong);
  }
  .btn-secondary:hover { background: oklch(98% 0.004 85); }
  .btn-danger {
    background: var(--panel); color: var(--danger);
    border: 1px solid var(--danger-line);
  }
  .btn-danger:hover { background: var(--danger-soft); }
  .btn svg { width: 13px; height: 13px; stroke-width: 1.8; }

  /* forms */
  form label {
    display: block; font-size: 13px; font-weight: 500; color: var(--ink-2);
    margin-bottom: 4px; margin-top: 14px;
  }
  form label:first-child { margin-top: 0; }
  form input[type=text], form input[type=email], form input[type=password],
  form input[type=number], form select, form textarea {
    width: 100%; padding: 8px 10px;
    border: 1px solid var(--line-strong); border-radius: var(--radius-sm);
    font-size: 14px; font-family: inherit; outline: none;
    background: var(--panel); color: var(--ink);
    transition: border-color .12s ease;
  }
  form input:focus, form select:focus, form textarea:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px oklch(85% 0.06 250 / .35);
  }
  form textarea { min-height: 80px; resize: vertical; }
  .form-hint { font-size: 12px; color: var(--ink-3); margin-top: 4px; }
  .form-actions { margin-top: 20px; display: flex; gap: 8px; align-items: center; }

  /* badges */
  .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; }
  .badge-blue { background: oklch(92% 0.05 250); color: oklch(38% 0.12 250); }
  .badge-green { background: oklch(93% 0.05 145); color: oklch(38% 0.12 145); }

  /* page padding for compat views */
  #main-content { padding: 28px var(--gut) 60px; }

  /* ── shared page structure ── */
  .page { padding: 28px var(--gut) 120px; max-width: 1180px; }
  .page-head {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: 28px; gap: 20px;
  }
  .page-head h1 { font-size: 22px; font-weight: 600; letter-spacing: -0.012em; margin: 0 0 4px; }
  .page-head .sub { color: var(--ink-3); font-size: 13.5px; max-width: 62ch; line-height: 1.5; }
  .page-head-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; padding-top: 2px; }

  /* ── card anatomy ── */
  .card-head {
    padding: 16px 20px 14px; border-bottom: 1px solid var(--line-2);
    display: flex; align-items: flex-start; gap: 14px;
  }
  .card-num {
    font-family: 'Geist Mono', monospace; font-size: 11px; color: var(--ink-4);
    padding-top: 1px; min-width: 18px; flex-shrink: 0;
  }
  .card-head h2 { font-size: 14.5px; font-weight: 600; margin: 0 0 3px; letter-spacing: -0.005em; }
  .card-head .desc { color: var(--ink-3); font-size: 12.5px; line-height: 1.4; max-width: 54ch; margin: 0; }
  .card-head-meta { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
  .card-body { padding: 14px 20px 16px; }
  .card-body.flush { padding: 0; }

  /* ── flash messages ── */
  .flash {
    padding: 12px 16px; border-radius: var(--radius); font-size: 13.5px;
    margin-bottom: 18px; display: flex; align-items: center; gap: 8px;
  }
  .flash-ok   { border: 1px solid oklch(75% 0.12 145); background: oklch(96% 0.04 145); color: oklch(32% 0.1 145); }
  .flash-err  { border: 1px solid var(--danger-line); background: var(--danger-soft); color: var(--danger); }
  .flash-warn { border: 1px solid var(--warn-line); background: var(--warn-soft); color: oklch(36% 0.08 75); }

  /* ── pill badge ── */
  .pill {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10.5px; font-weight: 500; letter-spacing: .02em;
    padding: 2.5px 8px 2.5px 6px; border-radius: 999px;
    border: 1px solid var(--line); color: var(--ink-3); background: var(--panel-2);
    white-space: nowrap;
  }
  .pill-warn { color: oklch(40% 0.08 75); background: var(--warn-soft); border-color: var(--warn-line); }

  /* ── stat strip ── */
  .stat-strip {
    display: grid; border: 1px solid var(--line); border-radius: var(--radius);
    background: var(--panel); margin-bottom: 18px; overflow: hidden;
  }
  .stat-strip.cols-2 { grid-template-columns: repeat(2, 1fr); }
  .stat-strip.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .stat-strip.cols-4 { grid-template-columns: repeat(4, 1fr); }
  .stat-cell {
    padding: 14px 18px; border-right: 1px solid var(--line-2);
    display: flex; flex-direction: column; gap: 5px;
  }
  .stat-cell:last-child { border-right: 0; }
  .stat-lbl { font-size: 11px; font-weight: 500; letter-spacing: .04em; text-transform: uppercase; color: var(--ink-4); }
  .stat-val {
    font-size: 22px; font-weight: 600; letter-spacing: -0.015em; color: var(--ink);
    display: flex; align-items: baseline; gap: 6px; font-feature-settings: 'tnum';
  }
  .stat-unit { font-size: 12px; font-weight: 400; color: var(--ink-4); font-family: 'Geist Mono', monospace; }

  /* ── two-col + TOC layout ── */
  .two-col-toc { display: grid; grid-template-columns: 1fr 176px; gap: 0 28px; align-items: start; }
  .two-col-toc > div, .two-col-toc > nav { min-width: 0; }

  /* ── toc nav ── */
  .toc-nav { position: sticky; top: 70px; }
  .toc-nav-label {
    font-size: 10.5px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
    color: var(--ink-4); padding: 0 12px 6px;
  }
  .toc-nav a {
    display: block; padding: 5px 12px; color: var(--ink-3); text-decoration: none;
    border-left: 2px solid transparent; font-size: 12.5px; transition: color .12s, border-color .12s;
  }
  .toc-nav a:hover { color: var(--ink); }
  .toc-nav a.active { color: var(--ink); border-left-color: var(--accent); }
`;

// --- Layout component ---

type LayoutProps = {
	title: string;
	currentPath?: string;
	section?: string;
	showTitle?: boolean;
	children?: Child;
};

export const Layout: FC<LayoutProps> = ({
	title,
	currentPath = "",
	section = "",
	showTitle = true,
	children,
}) => (
	<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<meta
				name="viewport"
				content="width=device-width,initial-scale=1"
			/>
			<title>{title} — plainbase ask</title>
			<link
				rel="icon"
				type="image/svg+xml"
				href="data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Crect width='32' height='32' rx='6' fill='%231a1a1a'/%3E%3Cline x1='8' y1='4' x2='8' y2='28' stroke='white' stroke-width='3.5' stroke-linecap='round'/%3E%3Ccircle cx='16' cy='16' r='7' fill='none' stroke='white' stroke-width='3.5'/%3E%3C/svg%3E"
			/>
			<link rel="preconnect" href="https://fonts.googleapis.com" />
			<link
				rel="preconnect"
				href="https://fonts.gstatic.com"
				crossorigin=""
			/>
			<link
				href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap"
				rel="stylesheet"
			/>
			<style>{raw(GLOBAL_CSS)}</style>
		</head>
		<body>
			<div class="shell">
				<aside class="rail">
					<div class="brand">
						{raw(
							`<svg class="brand-logo" width="80" height="30" viewBox="0 0 80 30" xmlns="http://www.w3.org/2000/svg"><rect width="80" height="30" rx="7" fill="#2a2a2a"/><line x1="15" y1="4" x2="15" y2="26" stroke="white" stroke-width="2.6" stroke-linecap="round"/><circle cx="23" cy="15" r="6.5" fill="none" stroke="white" stroke-width="2.6"/><text x="36" y="20.5" font-family="Geist,ui-sans-serif,system-ui,sans-serif" font-size="16" font-weight="900" fill="white" letter-spacing="0.3">ASK</text></svg>`,
						)}
						<div class="brand-env">{process.env.NODE_ENV === 'development' ? 'dev' : 'prod'}</div>
					</div>
					<div class="nav-group-label">Workspace</div>
					<nav class="nav">
						{NAV.map(({ href, label, icon }) => (
							<a
								href={href}
								class={href === currentPath ? "active" : ""}
							>
								{icon}
								<span>{label}</span>
							</a>
						))}
					</nav>
					<div class="nav-group-label">System</div>
					<nav class="nav">
						<a href="/admin/status" class={currentPath === '/admin/status' ? 'active' : ''}>
							{icnInfo}
							<span>Status</span>
						</a>
						<a href="/docs" target="_blank">
							{icnExternal}
							<span>Docs</span>
						</a>
					</nav>
					<div class="rail-foot">
						<div class="who">
							<div class="who-avatar">AD</div>
							<div class="who-meta">
								<div class="who-name">Admin</div>
								<div class="who-org">plainbase ask</div>
							</div>
						</div>
						<a href="/admin/logout">
							{icnLogout}
							<span>Log out</span>
						</a>
					</div>
				</aside>
				<main class="main">
					<div class="topbar">
						<div class="crumb">
							{section ? (
								<>
									<span>{section}</span>
									<span class="sep">/</span>
									<span class="here">{title}</span>
								</>
							) : (
								<span class="here">{title}</span>
							)}
						</div>
					</div>
					<div id="main-content">
						{showTitle && (
							<h2 class="page-title-compat">{title}</h2>
						)}
						{children}
					</div>
				</main>
			</div>
		</body>
	</html>
);

// Backward-compat string wrapper — views not yet migrated to JSX pass raw HTML strings here.
export function layout(
	title: string,
	content: string,
	currentPath = "",
	section = "",
	showTitle = true,
): string {
	return (
		"<!DOCTYPE html>" +
		String(
			<Layout
				title={title}
				currentPath={currentPath}
				section={section}
				showTitle={showTitle}
			>
				{raw(content)}
			</Layout>,
		)
	);
}
