-- Custom SQL migration file, put your code below! --
-- A webhook sends only while its creator could still manage it: the fan-out and every delivery
-- attempt (webhooks/fanout.ts, webhooks/deliver.ts) also refuse a creator whose account is
-- disabled (Better Auth's `banned`, as 0109 reads it) and, in a location that requires a second
-- factor, a creator with none enrolled. Background jobs run as kept_system, which reads only
-- auth."user"'s id and created_at (0007); it now reads these three columns too, and nothing else.
GRANT SELECT (banned, ban_expires, two_factor_enabled) ON auth."user" TO kept_system;
