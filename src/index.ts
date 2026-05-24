import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import { chatRouter } from "./api/chat.js";
import { ticketRouter } from "./api/ticket.js";
import { widgetRouter } from "./api/widget.js";
import { registerAdminRoutes } from "./admin/routes.js";

// Import DB to trigger migration + seed on startup
import "./db/client.js";
import { logSystemError } from "./db/client.js";
import type { ErrorSource } from "./db/client.js";
import { startScheduler } from "./crawler/scheduler.js";

const app = new Hono();

// Global error handler — never leak stack traces to clients
app.onError((err, c) => {
	console.error("[error]", err);
	const route = `${c.req.method} ${c.req.path}`;
	const source: ErrorSource = route.startsWith('/admin') ? 'admin'
		: route.includes('/ticket') ? 'ticket'
		: route.includes('/chat')   ? 'chat'
		: route.includes('/widget') ? 'widget'
		: 'admin';
	logSystemError(source, route, err);
	return c.json({ error: "Internal server error" }, 500);
});

// Registered before secureHeaders so its post-next runs after secureHeaders' post-next,
// overriding the default same-origin CORP that secureHeaders applies globally.
app.use("/widget.js", async (c, next) => {
	await next();
	c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
});

app.use("/api/logo", async (c, next) => {
	await next();
	c.res.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
});

app.use(
	"*",
	secureHeaders({
		xFrameOptions: "DENY",
		xContentTypeOptions: "nosniff",
		strictTransportSecurity: "max-age=31536000; includeSubDomains",
		// CSP is set per-route on the admin router (needs unsafe-inline for inline styles)
	}),
);

// Public API
app.route("/api", chatRouter);
app.route("/api", ticketRouter);
app.route("/", widgetRouter);

// Admin UI
registerAdminRoutes(app);

// Health check
app.get("/health", (c) => c.json({ ok: true }));

const port = parseInt(process.env.PORT ?? "3000", 10);

serve({ fetch: app.fetch, port }, () => {
	console.log(`[server] listening on http://localhost:${port}`);
	console.log(`[server] admin UI at http://localhost:${port}/admin`);
	startScheduler();
	console.log(
		"[scheduler] started — checking for due crawls every 60 minutes",
	);
});
