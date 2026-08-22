CREATE TABLE `approvalDecisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`area` enum('revision','cover','illustration','layout','proof','production-export') NOT NULL,
	`targetType` varchar(80) NOT NULL,
	`targetId` int NOT NULL,
	`collaboratorId` int NOT NULL,
	`decision` enum('approved','rejected') NOT NULL,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvalDecisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approvalRequirements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`area` enum('revision','cover','illustration','layout','proof','production-export') NOT NULL,
	`requiredRole` enum('editor','designer') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	`updatedByUserId` int NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approvalRequirements_id` PRIMARY KEY(`id`),
	CONSTRAINT `approval_requirement_project_area_role_unique` UNIQUE(`projectId`,`area`,`requiredRole`)
);
--> statement-breakpoint
CREATE TABLE `projectAuditEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`actorUserId` int,
	`eventType` varchar(100) NOT NULL,
	`targetType` varchar(100) NOT NULL,
	`targetId` int,
	`detailsJson` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectAuditEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectCollaborators` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`userId` int,
	`role` enum('editor','designer') NOT NULL,
	`status` enum('invited','active','revoked') NOT NULL DEFAULT 'invited',
	`invitedEmail` varchar(320) NOT NULL,
	`inviteTokenHash` varchar(128) NOT NULL,
	`invitedByUserId` int NOT NULL,
	`acceptedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projectCollaborators_id` PRIMARY KEY(`id`),
	CONSTRAINT `collaborators_project_email_unique` UNIQUE(`projectId`,`invitedEmail`)
);
--> statement-breakpoint
CREATE TABLE `reviewAssignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewRoundId` int NOT NULL,
	`collaboratorId` int NOT NULL,
	`anonymousLabel` varchar(80) NOT NULL,
	`status` enum('assigned','submitted','revoked') NOT NULL DEFAULT 'assigned',
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`submittedAt` timestamp,
	CONSTRAINT `reviewAssignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_assignment_unique` UNIQUE(`reviewRoundId`,`collaboratorId`)
);
--> statement-breakpoint
CREATE TABLE `reviewRounds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`versionId` int NOT NULL,
	`title` varchar(220) NOT NULL,
	`anonymousLabel` varchar(80) NOT NULL,
	`identityPolicy` enum('anonymous','reveal-on-close') NOT NULL DEFAULT 'anonymous',
	`status` enum('open','closed','cancelled') NOT NULL DEFAULT 'open',
	`createdByUserId` int NOT NULL,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reviewRounds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reviewSubmissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reviewRoundId` int NOT NULL,
	`assignmentId` int NOT NULL,
	`ratingsJson` longtext NOT NULL,
	`feedback` longtext NOT NULL,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reviewSubmissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_submission_assignment_unique` UNIQUE(`assignmentId`)
);
--> statement-breakpoint
CREATE TABLE `styleProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`sampleIdsJson` longtext NOT NULL,
	`dimensionsJson` longtext NOT NULL,
	`cautions` text NOT NULL,
	`status` enum('draft','active','revoked') NOT NULL DEFAULT 'draft',
	`traceId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `styleProfiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `styleSamples` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(200) NOT NULL,
	`tags` varchar(320) NOT NULL DEFAULT '',
	`sourceNote` text,
	`consentConfirmed` boolean NOT NULL DEFAULT false,
	`content` longtext NOT NULL,
	`wordCount` int NOT NULL DEFAULT 0,
	`storageKey` varchar(700),
	`storageUrl` varchar(900),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `styleSamples_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `approvalDecisions` ADD CONSTRAINT `approvalDecisions_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalDecisions` ADD CONSTRAINT `approvalDecisions_collaboratorId_projectCollaborators_id_fk` FOREIGN KEY (`collaboratorId`) REFERENCES `projectCollaborators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalRequirements` ADD CONSTRAINT `approvalRequirements_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approvalRequirements` ADD CONSTRAINT `approvalRequirements_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectAuditEvents` ADD CONSTRAINT `projectAuditEvents_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectAuditEvents` ADD CONSTRAINT `projectAuditEvents_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectCollaborators` ADD CONSTRAINT `projectCollaborators_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectCollaborators` ADD CONSTRAINT `projectCollaborators_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectCollaborators` ADD CONSTRAINT `projectCollaborators_invitedByUserId_users_id_fk` FOREIGN KEY (`invitedByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewAssignments` ADD CONSTRAINT `reviewAssignments_reviewRoundId_reviewRounds_id_fk` FOREIGN KEY (`reviewRoundId`) REFERENCES `reviewRounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewAssignments` ADD CONSTRAINT `reviewAssignments_collaboratorId_projectCollaborators_id_fk` FOREIGN KEY (`collaboratorId`) REFERENCES `projectCollaborators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewRounds` ADD CONSTRAINT `reviewRounds_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewRounds` ADD CONSTRAINT `reviewRounds_versionId_manuscriptVersions_id_fk` FOREIGN KEY (`versionId`) REFERENCES `manuscriptVersions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewRounds` ADD CONSTRAINT `reviewRounds_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewSubmissions` ADD CONSTRAINT `reviewSubmissions_reviewRoundId_reviewRounds_id_fk` FOREIGN KEY (`reviewRoundId`) REFERENCES `reviewRounds`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reviewSubmissions` ADD CONSTRAINT `reviewSubmissions_assignmentId_reviewAssignments_id_fk` FOREIGN KEY (`assignmentId`) REFERENCES `reviewAssignments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `styleProfiles` ADD CONSTRAINT `styleProfiles_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `styleSamples` ADD CONSTRAINT `styleSamples_ownerId_users_id_fk` FOREIGN KEY (`ownerId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `approval_decisions_project_target_idx` ON `approvalDecisions` (`projectId`,`targetType`,`targetId`);--> statement-breakpoint
CREATE INDEX `audit_events_project_created_idx` ON `projectAuditEvents` (`projectId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `collaborators_project_status_idx` ON `projectCollaborators` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `collaborators_user_status_idx` ON `projectCollaborators` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `review_rounds_project_status_idx` ON `reviewRounds` (`projectId`,`status`);--> statement-breakpoint
CREATE INDEX `style_profiles_owner_created_idx` ON `styleProfiles` (`ownerId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `style_samples_owner_created_idx` ON `styleSamples` (`ownerId`,`createdAt`);