/**
 * Shared admin UI components.
 *
 * Every view imports from here instead of duplicating icons, CSS class names,
 * and structural patterns. The corresponding CSS lives in layout.tsx GLOBAL_CSS
 * so it is always available — no per-page injection needed.
 */

import { raw } from 'hono/html';
import type { FC, Child } from 'hono/jsx';

// ---------------------------------------------------------------------------
// Icons — static SVG strings, safe to inject raw (no user data)
// ---------------------------------------------------------------------------

export const IcnLock     = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="11" height="11" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`);
export const IcnCheck    = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="11" height="11" stroke-width="2"><polyline points="5 12.5 10 17.5 19 7.5"/></svg>`);
export const IcnWarn     = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14" stroke-width="1.8"><path d="M12 3l10 18H2L12 3z"/><line x1="12" y1="10" x2="12" y2="14"/><circle cx="12" cy="17.5" r=".8" fill="currentColor"/></svg>`);
export const IcnRefresh  = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.8"><path d="M4 12a8 8 0 0 1 14-5.3L20 9"/><polyline points="20 4 20 9 15 9"/><path d="M20 12a8 8 0 0 1-14 5.3L4 15"/><polyline points="4 20 4 15 9 15"/></svg>`);
export const IcnReset    = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="12" height="12" stroke-width="1.8"><path d="M4 12a8 8 0 1 0 2.5-5.8"/><polyline points="3 4 6 7 9 4"/></svg>`);
export const IcnEye      = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>`);
export const IcnPlus     = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`);
export const IcnTrash    = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.8"><polyline points="4 7 20 7"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg>`);
export const IcnSearch   = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.7"><circle cx="11" cy="11" r="6"/><line x1="20" y1="20" x2="15.5" y2="15.5"/></svg>`);
export const IcnExternal = raw(`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="13" height="13" stroke-width="1.8"><path d="M14 4h6v6"/><line x1="20" y1="4" x2="11" y2="13"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/></svg>`);

// ---------------------------------------------------------------------------
// Flash — inline feedback banner
//
// Usage:
//   {saved && <Flash variant="ok">Config saved.</Flash>}
//   {error && <Flash variant="err">{error}</Flash>}
// ---------------------------------------------------------------------------

type FlashVariant = 'ok' | 'err' | 'warn';

export const Flash: FC<{ variant: FlashVariant; children?: Child }> = ({ variant, children }) => (
	<div class={`flash flash-${variant}`}>{children}</div>
);

// ---------------------------------------------------------------------------
// Pill — small inline badge (e.g. "read-only", "env-driven")
//
// Usage:
//   <Pill>{IcnLock} read-only</Pill>
//   <Pill variant="warn">{IcnWarn} env-driven</Pill>
// ---------------------------------------------------------------------------

type PillVariant = 'default' | 'warn';

export const Pill: FC<{ variant?: PillVariant; children?: Child }> = ({ variant = 'default', children }) => (
	<span class={`pill${variant !== 'default' ? ` pill-${variant}` : ''}`}>{children}</span>
);

// ---------------------------------------------------------------------------
// Card — white bordered container (the foundational page building block)
//
// Usage:
//   <Card id="overview">
//     <CardHead num="01" title="Prompt stack" desc="..." />
//     <CardBody>...</CardBody>
//   </Card>
// ---------------------------------------------------------------------------

export const Card: FC<{ id?: string; style?: string; children?: Child }> = ({ id, style, children }) => (
	<div class="card" id={id} style={style}>{children}</div>
);

// CardHead — header inside a Card
// `children` is the optional right-side slot (for pills, buttons, etc.)
//
// Usage:
//   <CardHead num="01" title="LLM Provider" desc="...">
//     <Pill variant="warn">{IcnLock} env-driven</Pill>
//   </CardHead>
export const CardHead: FC<{ num?: string; title: string; desc?: Child; children?: Child }> = ({
	num,
	title,
	desc,
	children,
}) => (
	<div class="card-head">
		{num && <div class="card-num mono">{num}</div>}
		<div>
			<h2>{title}</h2>
			{desc && <p class="desc">{desc}</p>}
		</div>
		{children && <div class="card-head-meta">{children}</div>}
	</div>
);

// CardBody — content area inside a Card
// `flush` removes padding (use for tables that should bleed to the card edges)
//
// Usage:
//   <CardBody>...</CardBody>
//   <CardBody flush>...</CardBody>
export const CardBody: FC<{ flush?: boolean; children?: Child }> = ({ flush, children }) => (
	<div class={`card-body${flush ? ' flush' : ''}`}>{children}</div>
);

// ---------------------------------------------------------------------------
// PageWrap — outer page wrapper used by pages that manage their own padding
//
// Sets `#main-content { padding: 0 }` and wraps content in `.page`.
// Do NOT use on pages with unique full-height layouts (conversations).
//
// Usage:
//   <PageWrap>
//     <PageHeader title="Config" subtitle="..." />
//     ...cards...
//   </PageWrap>
// ---------------------------------------------------------------------------

const PAGE_WRAP_CSS = `#main-content { padding: 0; }`;

export const PageWrap: FC<{ children?: Child }> = ({ children }) => (
	<>
		<style>{raw(PAGE_WRAP_CSS)}</style>
		<div class="page">{children}</div>
	</>
);

// ---------------------------------------------------------------------------
// PageHeader — h1 + subtitle line, with optional right-side actions
//
// Usage:
//   <PageHeader title="Knowledge Base" subtitle="Documents and pages the assistant can cite." />
//   <PageHeader title="Config" subtitle="..."><SaveButton /></PageHeader>
// ---------------------------------------------------------------------------

export const PageHeader: FC<{ title: string; subtitle?: string; children?: Child }> = ({
	title,
	subtitle,
	children,
}) => (
	<div class="page-head">
		<div>
			<h1>{title}</h1>
			{subtitle && <p class="sub">{subtitle}</p>}
		</div>
		{children && <div class="page-head-actions">{children}</div>}
	</div>
);

// ---------------------------------------------------------------------------
// TocNav + TwoColToc — sticky "On this page" navigation and its layout wrapper
//
// Usage:
//   <TwoColToc toc={
//     <TocNav links={[
//       { href: '#overview', label: 'Prompt stack' },
//       { href: '#system',   label: 'System rules' },
//     ]} />
//   }>
//     ...cards...
//   </TwoColToc>
// ---------------------------------------------------------------------------

type TocLink = { href: string; label: string };

export const TocNav: FC<{ links: TocLink[]; linkClass?: string }> = ({
	links,
	linkClass = '',
}) => (
	<nav class="toc-nav" aria-label="On this page">
		<div class="toc-nav-label">On this page</div>
		{links.map(l => (
			<a href={l.href} class={linkClass || undefined}>{l.label}</a>
		))}
	</nav>
);

export const TwoColToc: FC<{ toc: Child; children?: Child }> = ({ toc, children }) => (
	<div class="two-col-toc">
		<div>{children}</div>
		{toc}
	</div>
);

// ---------------------------------------------------------------------------
// StatCard + StatStrip — metric tiles used on dashboard, knowledge, conversations
//
// Usage:
//   <StatStrip>
//     <StatCard label="Conversations" value={42} />
//     <StatCard label="Corpus" value="1.2" unit="M chars" />
//   </StatStrip>
// ---------------------------------------------------------------------------

export const StatCard: FC<{ label: string; value: Child; unit?: string }> = ({
	label,
	value,
	unit,
}) => (
	<div class="stat-cell">
		<div class="stat-lbl">{label}</div>
		<div class="stat-val">
			{value}
			{unit && <span class="stat-unit">{unit}</span>}
		</div>
	</div>
);

// `cols` controls the grid column count (defaults to the number of children if omitted,
// but explicit is clearer). Use 2, 3, or 4.
export const StatStrip: FC<{ cols?: 2 | 3 | 4; children?: Child }> = ({ cols = 4, children }) => (
	<div class={`stat-strip cols-${cols}`}>{children}</div>
);
