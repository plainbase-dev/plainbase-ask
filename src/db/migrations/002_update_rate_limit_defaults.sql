-- Update defaults only if still at the old default value (respect user customisations)
UPDATE config SET value = '20' WHERE key = 'rate_limit_max_conversations_per_ip' AND value = '5';
UPDATE config SET value = '25' WHERE key = 'rate_limit_max_messages_per_conv'    AND value = '50';

-- New config key: 0 = disabled
INSERT OR IGNORE INTO config VALUES ('rate_limit_max_cost_per_conv', '0');

-- Track why a conversation was blocked
ALTER TABLE conversations ADD COLUMN blocked_reason TEXT;
