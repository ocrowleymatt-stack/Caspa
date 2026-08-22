CREATE TABLE `accountBackups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`status` enum('created','failed') NOT NULL DEFAULT 'created',
	`storageKey` varchar(700) NOT NULL,
	`storageUrl` varchar(900) NOT NULL,
	`projectCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accountBackups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chapterCheckpoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` int NOT NULL,
	`chapterIndex` int NOT NULL,
	`chapterTitle` varchar(240) NOT NULL,
	`status` enum('queued','running','succeeded','warning','failed') NOT NULL DEFAULT 'queued',
	`beforeText` longtext NOT NULL,
	`afterText` longtext,
	`beforeWordCount` int NOT NULL DEFAULT 0,
	`afterWordCount` int NOT NULL DEFAULT 0,
	`warningsJson` text,
	`traceId` varchar(64) NOT NULL,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chapterCheckpoints_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_chapter_unique` UNIQUE(`jobId`,`chapterIndex`)
);
--> statement-breakpoint
CREATE TABLE `diagnoses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`versionId` int NOT NULL,
	`rubricVersion` varchar(40) NOT NULL,
	`overallSummary` text NOT NULL,
	`overallConfidence` int NOT NULL,
	`traceId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `diagnoses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `diagnosisFindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`diagnosisId` int NOT NULL,
	`criterion` varchar(120) NOT NULL,
	`category` varchar(100) NOT NULL,
	`severity` enum('critical','major','moderate','minor') NOT NULL,
	`confidence` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`rationale` text NOT NULL,
	`suggestedFix` text NOT NULL,
	`evidenceQuote` text NOT NULL,
	`citationLabel` varchar(180) NOT NULL,
	`citationStart` int,
	`citationEnd` int,
	`selectedByDefault` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `diagnosisFindings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `exportPreflights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`versionId` int NOT NULL,
	`passed` boolean NOT NULL DEFAULT false,
	`checksJson` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exportPreflights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manuscriptUploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`versionId` int,
	`originalName` varchar(320) NOT NULL,
	`mimeType` varchar(160) NOT NULL,
	`storageKey` varchar(700) NOT NULL,
	`storageUrl` varchar(900) NOT NULL,
	`sizeBytes` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manuscriptUploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `manuscriptVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`trigger` enum('project-created','manual-save','upload','diagnosis','revision','restore') NOT NULL,
	`content` longtext NOT NULL,
	`wordCount` int NOT NULL DEFAULT 0,
	`chapterCount` int NOT NULL DEFAULT 0,
	`sourceVersionId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `manuscriptVersions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`authorName` varchar(180) NOT NULL,
	`format` enum('fiction','non-fiction','picture-book','script','essay','poetry','polish') NOT NULL,
	`premise` text NOT NULL,
	`targetWordCount` int NOT NULL,
	`currentState` enum('draft','diagnosed','plan-approved','revision-running','review','export-ready','archived') NOT NULL DEFAULT 'draft',
	`activeVersionId` int,
	`wordCount` int NOT NULL DEFAULT 0,
	`chapterCount` int NOT NULL DEFAULT 0,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revisionJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`planId` int NOT NULL,
	`sourceVersionId` int NOT NULL,
	`resultVersionId` int,
	`status` enum('queued','running','awaiting-review','succeeded','succeeded-with-warnings','failed') NOT NULL DEFAULT 'queued',
	`currentChapter` int NOT NULL DEFAULT 0,
	`totalChapters` int NOT NULL DEFAULT 0,
	`progress` int NOT NULL DEFAULT 0,
	`beforeWordCount` int NOT NULL DEFAULT 0,
	`afterWordCount` int NOT NULL DEFAULT 0,
	`warningCount` int NOT NULL DEFAULT 0,
	`lastErrorCode` varchar(80),
	`traceId` varchar(64) NOT NULL,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revisionJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revisionPlanItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`findingId` int NOT NULL,
	`selected` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revisionPlanItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `plan_finding_unique` UNIQUE(`planId`,`findingId`)
);
--> statement-breakpoint
CREATE TABLE `revisionPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`diagnosisId` int NOT NULL,
	`sourceVersionId` int NOT NULL,
	`scope` enum('whole-book','chapter-range','single-chapter') NOT NULL,
	`startChapter` int,
	`endChapter` int,
	`status` enum('approved','submitted','completed') NOT NULL DEFAULT 'approved',
	`approvedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `revisionPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accountBackups` ADD CONSTRAINT `accountBackups_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `chapterCheckpoints` ADD CONSTRAINT `chapterCheckpoints_jobId_revisionJobs_id_fk` FOREIGN KEY (`jobId`) REFERENCES `revisionJobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `diagnoses` ADD CONSTRAINT `diagnoses_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `diagnoses` ADD CONSTRAINT `diagnoses_versionId_manuscriptVersions_id_fk` FOREIGN KEY (`versionId`) REFERENCES `manuscriptVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `diagnosisFindings` ADD CONSTRAINT `diagnosisFindings_diagnosisId_diagnoses_id_fk` FOREIGN KEY (`diagnosisId`) REFERENCES `diagnoses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exportPreflights` ADD CONSTRAINT `exportPreflights_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exportPreflights` ADD CONSTRAINT `exportPreflights_versionId_manuscriptVersions_id_fk` FOREIGN KEY (`versionId`) REFERENCES `manuscriptVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `manuscriptUploads` ADD CONSTRAINT `manuscriptUploads_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `manuscriptUploads` ADD CONSTRAINT `manuscriptUploads_versionId_manuscriptVersions_id_fk` FOREIGN KEY (`versionId`) REFERENCES `manuscriptVersions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `manuscriptVersions` ADD CONSTRAINT `manuscriptVersions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `manuscriptVersions` ADD CONSTRAINT `manuscriptVersions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionJobs` ADD CONSTRAINT `revisionJobs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionJobs` ADD CONSTRAINT `revisionJobs_planId_revisionPlans_id_fk` FOREIGN KEY (`planId`) REFERENCES `revisionPlans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionJobs` ADD CONSTRAINT `revisionJobs_sourceVersionId_manuscriptVersions_id_fk` FOREIGN KEY (`sourceVersionId`) REFERENCES `manuscriptVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionJobs` ADD CONSTRAINT `revisionJobs_resultVersionId_manuscriptVersions_id_fk` FOREIGN KEY (`resultVersionId`) REFERENCES `manuscriptVersions`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionPlanItems` ADD CONSTRAINT `revisionPlanItems_planId_revisionPlans_id_fk` FOREIGN KEY (`planId`) REFERENCES `revisionPlans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionPlanItems` ADD CONSTRAINT `revisionPlanItems_findingId_diagnosisFindings_id_fk` FOREIGN KEY (`findingId`) REFERENCES `diagnosisFindings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionPlans` ADD CONSTRAINT `revisionPlans_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionPlans` ADD CONSTRAINT `revisionPlans_diagnosisId_diagnoses_id_fk` FOREIGN KEY (`diagnosisId`) REFERENCES `diagnoses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `revisionPlans` ADD CONSTRAINT `revisionPlans_sourceVersionId_manuscriptVersions_id_fk` FOREIGN KEY (`sourceVersionId`) REFERENCES `manuscriptVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `backups_owner_created_idx` ON `accountBackups` (`ownerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `diagnoses_project_created_idx` ON `diagnoses` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `findings_diagnosis_idx` ON `diagnosisFindings` (`diagnosisId`);--> statement-breakpoint
CREATE INDEX `preflights_project_created_idx` ON `exportPreflights` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `uploads_project_idx` ON `manuscriptUploads` (`projectId`);--> statement-breakpoint
CREATE INDEX `versions_project_created_idx` ON `manuscriptVersions` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `projects_owner_state_idx` ON `projects` (`ownerId`,`currentState`);--> statement-breakpoint
CREATE INDEX `projects_owner_updated_idx` ON `projects` (`ownerId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `jobs_project_status_idx` ON `revisionJobs` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `plans_project_created_idx` ON `revisionPlans` (`projectId`,`createdAt`);