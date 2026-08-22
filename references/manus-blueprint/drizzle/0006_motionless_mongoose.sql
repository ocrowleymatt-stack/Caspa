CREATE TABLE `draftPreviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceVersionId` int,
	`chapterTitle` varchar(240) NOT NULL,
	`mode` enum('opening','append-chapter','replace-chapter') NOT NULL,
	`chapterNumber` int,
	`targetWords` int NOT NULL,
	`briefJson` longtext NOT NULL,
	`content` longtext NOT NULL,
	`groundingSummary` text NOT NULL,
	`status` enum('previewed','accepted','rejected') NOT NULL DEFAULT 'previewed',
	`traceId` varchar(64) NOT NULL,
	`createdByUserId` int NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `draftPreviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `manuscriptVersions` MODIFY COLUMN `trigger` enum('project-created','manual-save','upload','auto-draft','diagnosis','revision','restore') NOT NULL;--> statement-breakpoint
ALTER TABLE `draftPreviews` ADD CONSTRAINT `draftPreviews_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `draftPreviews` ADD CONSTRAINT `draftPreviews_sourceVersionId_manuscriptVersions_id_fk` FOREIGN KEY (`sourceVersionId`) REFERENCES `manuscriptVersions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `draftPreviews` ADD CONSTRAINT `draftPreviews_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `draft_previews_project_created_idx` ON `draftPreviews` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `draft_previews_project_status_idx` ON `draftPreviews` (`projectId`,`status`);