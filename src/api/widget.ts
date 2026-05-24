import { Hono } from 'hono';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getAgent, getConfigValue } from '../db/client.js';
import { isOriginAllowed } from './chat.js';

type WidgetEnv = { Variables: { adminPreview: boolean } };
export const widgetRouter = new Hono<WidgetEnv>();

widgetRouter.get('/api/widget-config', (c) => {
  const agent = getAgent();
  const allowedDomains = JSON.parse(agent.allowed_domains) as string[];

  if (!c.get('adminPreview')) {
    const origin = c.req.header('Origin') ?? '';
    if (isOriginAllowed(origin, allowedDomains)) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
      c.res.headers.set('Vary', 'Origin');
    } else if (allowedDomains.length > 0) {
      return c.json({ error: 'Domain not allowed' }, 403);
    }
  }

  if (!c.get('adminPreview') && getConfigValue('widget_active', '0') !== '1') {
    return c.json({ error: 'Widget is disabled' }, 503);
  }

  let languages: {
    code: string; label: string;
    widgetTitle?: string; widgetSubtitle?: string; chatInputPlaceholder?: string;
    starterMessage: string; ticketButtonLabel?: string;
    ticketCardTitle?: string; ticketCardText?: string; ticketCardOfficeHours?: string;
  }[] = [];
  try { languages = JSON.parse(getConfigValue('languages', '[]')); } catch { languages = []; }

  const logoData = getConfigValue('logo_data', '');
  const primaryColor = getConfigValue('primary_color', '#2563eb');
  const proto = c.req.header('x-forwarded-proto') ?? 'http';
  const host = c.req.header('host') ?? 'localhost';
  const apiBase = `${proto}://${host}`;

  return c.json({
    widgetButtonText: getConfigValue('widget_button_text', ''),
    languages,
    primaryColor,
    logoUrl: logoData ? `${apiBase}/api/logo` : null,
  });
});

widgetRouter.get('/api/logo', (c) => {
  const agent = getAgent();
  const allowedDomains = JSON.parse(agent.allowed_domains) as string[];

  if (!c.get('adminPreview')) {
    const origin = c.req.header('Origin') ?? '';
    if (origin && isOriginAllowed(origin, allowedDomains)) {
      c.res.headers.set('Access-Control-Allow-Origin', origin);
      c.res.headers.set('Vary', 'Origin');
    } else if (origin && allowedDomains.length > 0) {
      return c.body(null, 403);
    }
  }

  const logoData = getConfigValue('logo_data', '');
  const logoMime = getConfigValue('logo_mime', '');
  if (!logoData || !logoMime) return c.body(null, 404);

  const buffer = Buffer.from(logoData, 'base64');
  return c.body(buffer, 200, {
    'Content-Type': logoMime,
    'Cache-Control': 'public, max-age=3600',
    'Cross-Origin-Resource-Policy': 'cross-origin',
  });
});

widgetRouter.get('/widget.js', (c) => {
  const widgetPath = join(dirname(fileURLToPath(import.meta.url)), '../../public/widget.js');
  let js: string;
  try {
    js = readFileSync(widgetPath, 'utf-8');
  } catch {
    return c.text('// widget not built yet', 503, { 'Content-Type': 'application/javascript' });
  }

  return c.text(js, 200, {
    'Content-Type': 'application/javascript; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
});
