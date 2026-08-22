ALTER TABLE `layoutSpecs` ADD `editionMode` enum('print','digital','both') DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE `layoutSpecs` ADD `language` varchar(16) DEFAULT 'en' NOT NULL;--> statement-breakpoint
ALTER TABLE `layoutSpecs` ADD `digitalNavigation` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `layoutSpecs` ADD `imageAltPolicy` enum('required','optional') DEFAULT 'required' NOT NULL;--> statement-breakpoint
ALTER TABLE `layoutSpecs` ADD `printProfile` enum('grayscale','standard-color','premium-color') DEFAULT 'standard-color' NOT NULL;