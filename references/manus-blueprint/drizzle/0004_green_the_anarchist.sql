CREATE TABLE `artBriefs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`suitability` enum('required','recommended','optional','not-recommended') NOT NULL,
	`illustrationMode` enum('none','cover-only','limited','fully-illustrated') NOT NULL,
	`rationale` text NOT NULL,
	`audience` text NOT NULL,
	`genreSignals` text NOT NULL,
	`tone` text NOT NULL,
	`motifs` text NOT NULL,
	`exclusions` text NOT NULL,
	`palette` text NOT NULL,
	`medium` varchar(180) NOT NULL,
	`typographyDirection` text NOT NULL,
	`trimSize` varchar(40) NOT NULL,
	`distribution` enum('print','digital','both') NOT NULL DEFAULT 'both',
	`status` enum('draft','approved','superseded') NOT NULL DEFAULT 'draft',
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `artBriefs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coverConcepts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`artBriefId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`name` varchar(200) NOT NULL,
	`direction` text NOT NULL,
	`source` enum('ai','upload') NOT NULL,
	`storageKey` varchar(700) NOT NULL,
	`storageUrl` varchar(900) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`width` int NOT NULL DEFAULT 0,
	`height` int NOT NULL DEFAULT 0,
	`promptProvenance` longtext,
	`status` enum('generated','approved','rejected','superseded') NOT NULL DEFAULT 'generated',
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coverConcepts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `illustrationAssets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`slotId` int,
	`version` int NOT NULL DEFAULT 1,
	`source` enum('ai','upload') NOT NULL,
	`storageKey` varchar(700) NOT NULL,
	`storageUrl` varchar(900) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`width` int NOT NULL DEFAULT 0,
	`height` int NOT NULL DEFAULT 0,
	`promptProvenance` longtext,
	`status` enum('generated','approved','rejected','superseded') NOT NULL DEFAULT 'generated',
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `illustrationAssets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `illustrationPlans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`artBriefId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`consistencyJson` longtext NOT NULL,
	`status` enum('draft','approved','completed','waived') NOT NULL DEFAULT 'draft',
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `illustrationPlans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `illustrationSlots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`planId` int NOT NULL,
	`sequence` int NOT NULL,
	`chapterIndex` int,
	`placement` varchar(160) NOT NULL,
	`purpose` text NOT NULL,
	`sceneBrief` longtext NOT NULL,
	`aspectRatio` varchar(40) NOT NULL,
	`bleed` boolean NOT NULL DEFAULT false,
	`caption` text,
	`altText` text NOT NULL,
	`continuityNotes` text NOT NULL,
	`status` enum('proposed','approved','rejected','waived') NOT NULL DEFAULT 'proposed',
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `illustrationSlots_id` PRIMARY KEY(`id`),
	CONSTRAINT `illustration_slot_sequence_unique` UNIQUE(`planId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `layoutSpecs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`trimSize` varchar(40) NOT NULL,
	`orientation` enum('portrait','landscape') NOT NULL DEFAULT 'portrait',
	`pageWidthPt` int NOT NULL,
	`pageHeightPt` int NOT NULL,
	`marginsJson` text NOT NULL,
	`bleedPt` int NOT NULL DEFAULT 9,
	`bodyFont` varchar(120) NOT NULL,
	`displayFont` varchar(120) NOT NULL,
	`bodySizePt` int NOT NULL DEFAULT 11,
	`lineHeightPct` int NOT NULL DEFAULT 145,
	`paragraphStyle` enum('indent','spaced') NOT NULL DEFAULT 'indent',
	`runningHeads` boolean NOT NULL DEFAULT true,
	`folios` boolean NOT NULL DEFAULT true,
	`chapterOpening` enum('right-hand','next-page','continuous') NOT NULL DEFAULT 'right-hand',
	`imagePlacement` enum('inline','full-page','spread') NOT NULL DEFAULT 'inline',
	`status` enum('draft','approved','superseded') NOT NULL DEFAULT 'draft',
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `layoutSpecs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `layoutVersions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`manuscriptVersionId` int NOT NULL,
	`artBriefId` int NOT NULL,
	`coverConceptId` int,
	`illustrationPlanId` int,
	`layoutSpecId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`name` varchar(200) NOT NULL,
	`pageCount` int NOT NULL DEFAULT 0,
	`pagesJson` longtext NOT NULL,
	`status` enum('draft','proof','approved','superseded') NOT NULL DEFAULT 'draft',
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `layoutVersions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productionExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`layoutVersionId` int NOT NULL,
	`preflightId` int NOT NULL,
	`format` enum('interior-pdf','cover-pdf','epub','package') NOT NULL,
	`status` enum('created','failed') NOT NULL DEFAULT 'created',
	`storageKey` varchar(700) NOT NULL,
	`storageUrl` varchar(900) NOT NULL,
	`checksum` varchar(128) NOT NULL,
	`sizeBytes` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `productionExports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productionPreflights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`layoutVersionId` int NOT NULL,
	`passed` boolean NOT NULL DEFAULT false,
	`checksJson` longtext NOT NULL,
	`authorApproved` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `productionPreflights_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proofAnnotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`layoutVersionId` int NOT NULL,
	`pageNumber` int NOT NULL,
	`xPct` int NOT NULL DEFAULT 50,
	`yPct` int NOT NULL DEFAULT 50,
	`note` text NOT NULL,
	`status` enum('open','resolved','accepted-as-is','deferred') NOT NULL DEFAULT 'open',
	`resolutionNote` text,
	`createdByUserId` int NOT NULL,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proofAnnotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `currentState` enum('draft','diagnosed','plan-approved','revision-running','review','export-ready','art-direction','art-approved','layout','proof-review','production-ready','archived') NOT NULL DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE `artBriefs` ADD CONSTRAINT `artBriefs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coverConcepts` ADD CONSTRAINT `coverConcepts_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `coverConcepts` ADD CONSTRAINT `coverConcepts_artBriefId_artBriefs_id_fk` FOREIGN KEY (`artBriefId`) REFERENCES `artBriefs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `illustrationAssets` ADD CONSTRAINT `illustrationAssets_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `illustrationAssets` ADD CONSTRAINT `illustrationAssets_slotId_illustrationSlots_id_fk` FOREIGN KEY (`slotId`) REFERENCES `illustrationSlots`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `illustrationPlans` ADD CONSTRAINT `illustrationPlans_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `illustrationPlans` ADD CONSTRAINT `illustrationPlans_artBriefId_artBriefs_id_fk` FOREIGN KEY (`artBriefId`) REFERENCES `artBriefs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `illustrationSlots` ADD CONSTRAINT `illustrationSlots_planId_illustrationPlans_id_fk` FOREIGN KEY (`planId`) REFERENCES `illustrationPlans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `layoutSpecs` ADD CONSTRAINT `layoutSpecs_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `layoutVersions` ADD CONSTRAINT `layoutVersions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `layoutVersions` ADD CONSTRAINT `layoutVersions_manuscriptVersionId_manuscriptVersions_id_fk` FOREIGN KEY (`manuscriptVersionId`) REFERENCES `manuscriptVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `layoutVersions` ADD CONSTRAINT `layoutVersions_artBriefId_artBriefs_id_fk` FOREIGN KEY (`artBriefId`) REFERENCES `artBriefs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `layoutVersions` ADD CONSTRAINT `layoutVersions_coverConceptId_coverConcepts_id_fk` FOREIGN KEY (`coverConceptId`) REFERENCES `coverConcepts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `layoutVersions` ADD CONSTRAINT `layoutVersions_illustrationPlanId_illustrationPlans_id_fk` FOREIGN KEY (`illustrationPlanId`) REFERENCES `illustrationPlans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `layoutVersions` ADD CONSTRAINT `layoutVersions_layoutSpecId_layoutSpecs_id_fk` FOREIGN KEY (`layoutSpecId`) REFERENCES `layoutSpecs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productionExports` ADD CONSTRAINT `productionExports_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productionExports` ADD CONSTRAINT `productionExports_layoutVersionId_layoutVersions_id_fk` FOREIGN KEY (`layoutVersionId`) REFERENCES `layoutVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productionExports` ADD CONSTRAINT `productionExports_preflightId_productionPreflights_id_fk` FOREIGN KEY (`preflightId`) REFERENCES `productionPreflights`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productionPreflights` ADD CONSTRAINT `productionPreflights_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `productionPreflights` ADD CONSTRAINT `productionPreflights_layoutVersionId_layoutVersions_id_fk` FOREIGN KEY (`layoutVersionId`) REFERENCES `layoutVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proofAnnotations` ADD CONSTRAINT `proofAnnotations_layoutVersionId_layoutVersions_id_fk` FOREIGN KEY (`layoutVersionId`) REFERENCES `layoutVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proofAnnotations` ADD CONSTRAINT `proofAnnotations_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `art_briefs_project_version_idx` ON `artBriefs` (`projectId`,`version`);--> statement-breakpoint
CREATE INDEX `cover_concepts_project_status_idx` ON `coverConcepts` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `illustration_assets_project_status_idx` ON `illustrationAssets` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `illustration_plans_project_version_idx` ON `illustrationPlans` (`projectId`,`version`);--> statement-breakpoint
CREATE INDEX `layout_specs_project_version_idx` ON `layoutSpecs` (`projectId`,`version`);--> statement-breakpoint
CREATE INDEX `layout_versions_project_status_idx` ON `layoutVersions` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `production_exports_project_created_idx` ON `productionExports` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `production_preflights_project_created_idx` ON `productionPreflights` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `proof_annotations_layout_status_idx` ON `proofAnnotations` (`layoutVersionId`,`status`);