-- Rooms from 50 cm a side (#372, 1.14.4): a narrow balcony, 0.8 × 3.58 m, fits on the map. The
-- check is dropped and added again with the lower bound (MAP_LIMITS.minRoom); every row already
-- in it is at least 100 cm, so it holds. Additive: the release before reads these rows as they are.
ALTER TABLE "map_nodes" DROP CONSTRAINT "map_nodes_size_chk";--> statement-breakpoint
ALTER TABLE "map_nodes" ADD CONSTRAINT "map_nodes_size_chk" CHECK ((w_cm IS NULL AND d_cm IS NULL) OR (w_cm BETWEEN 50 AND 10000 AND d_cm BETWEEN 50 AND 10000));