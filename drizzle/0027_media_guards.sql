CREATE TABLE admin_mutation_guards(id TEXT PRIMARY KEY NOT NULL,valid INTEGER NOT NULL CHECK(valid=1));

--> statement-breakpoint
CREATE TABLE media_library_hidden(id TEXT PRIMARY KEY NOT NULL);
