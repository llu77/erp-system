ALTER TABLE `loyaltyDiscountRecords` ADD `isVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `loyaltyDiscountRecords` ADD `eligibilityVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `loyaltyDiscountRecords` ADD `verificationMethod` varchar(50);--> statement-breakpoint
ALTER TABLE `loyaltyDiscountRecords` ADD `aiRiskScore` decimal(5,2);--> statement-breakpoint
ALTER TABLE `loyaltyDiscountRecords` ADD `aiRiskLevel` enum('low','medium','high','critical');--> statement-breakpoint
ALTER TABLE `loyaltyDiscountRecords` ADD `aiAnalysisNotes` text;--> statement-breakpoint
ALTER TABLE `loyaltyDiscountRecords` ADD `approvedVisitsCount` int;