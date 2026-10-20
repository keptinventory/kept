-- Custom SQL migration file, put your code below! --
-- 1.x, #138: a thing on a wall's height (0140's map_nodes.height_cm). kept_app reads and writes
-- it as it does the rest of a node's layout (0131): column grants, so a new column is granted on
-- purpose. kept_system still gets nothing.
--
-- And the id and created_at, which 0131 left to the table's defaults: a Kept import writes every
-- row with its new id and its export's created_at (imports/kept/apply.ts), and without them a
-- location's map never came through an export and an import (permission denied, every node
-- skipped). The arrange session's PUT still leaves both to the defaults (map/service.ts).
GRANT SELECT (height_cm) ON public.map_nodes TO kept_app;
--> statement-breakpoint
GRANT INSERT (id, height_cm, created_at) ON public.map_nodes TO kept_app;
