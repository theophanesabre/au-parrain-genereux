-- Optional LOCAL/manual rollback only, before any use and BEFORE migration 0034. Never run on a used ledger.
-- This transaction intentionally fails when any reference, access grant or journal exists.
BEGIN IMMEDIATE;
CREATE TEMP TABLE sp_rollback_guard(n INTEGER CHECK(n=0));
INSERT INTO sp_rollback_guard SELECT
 (SELECT COUNT(*) FROM sp_references)+(SELECT COUNT(*) FROM sp_users)+
 (SELECT COUNT(*) FROM sp_movements)+(SELECT COUNT(*) FROM sp_access_audit);
DROP TABLE sp_movements;
DROP TABLE sp_lots;
DROP TABLE sp_balances;
DROP TABLE sp_references;
DROP TABLE sp_users;
DROP TABLE sp_access_audit;
DROP TABLE sp_rollback_guard;
COMMIT;
-- The deployment migration registry must also be handled by its own migration tool.
-- Prefer a code rollback that leaves these tables intact when data has been entered.
