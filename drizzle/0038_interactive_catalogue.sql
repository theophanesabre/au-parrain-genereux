CREATE TABLE catalogue_creations(id TEXT PRIMARY KEY,body TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,archived INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE catalogue_formats(size INTEGER PRIMARY KEY CHECK(size IN (6,12,24,36)),product_id TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE catalogue_ballotins(id TEXT PRIMARY KEY,product_id TEXT NOT NULL REFERENCES products(id),size INTEGER NOT NULL,body TEXT NOT NULL,requester TEXT NOT NULL,created_at INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX catalogue_ballotins_expiry ON catalogue_ballotins(created_at);
--> statement-breakpoint
CREATE INDEX catalogue_ballotins_rate ON catalogue_ballotins(requester,created_at);
