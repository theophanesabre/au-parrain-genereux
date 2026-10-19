CREATE TABLE consumer_requests (
 id TEXT PRIMARY KEY NOT NULL,
 name TEXT NOT NULL,
 email TEXT NOT NULL,
 order_reference TEXT NOT NULL,
 products TEXT NOT NULL,
 created_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed')),
 requester_hash TEXT,
 version INTEGER NOT NULL DEFAULT 1
);
--> statement-breakpoint
CREATE INDEX consumer_requests_created ON consumer_requests(created_at);
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD terms_version TEXT;
--> statement-breakpoint
ALTER TABLE checkout_attempts ADD terms_accepted_at TEXT;
