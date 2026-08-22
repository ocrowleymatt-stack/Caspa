ALTER TABLE `diagnoses` ADD `mode` enum('ai','deterministic-fallback') DEFAULT 'ai' NOT NULL;--> statement-breakpoint
ALTER TABLE `diagnoses` ADD `warningCode` varchar(80);