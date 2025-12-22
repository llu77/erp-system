ALTER TABLE `dailyRevenues` ADD `balanceImages` json;--> statement-breakpoint
ALTER TABLE `dailyRevenues` ADD `imageVerificationStatus` enum('pending','verified','needs_reupload','unclear') DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `dailyRevenues` ADD `imageVerificationNote` text;--> statement-breakpoint
ALTER TABLE `dailyRevenues` DROP COLUMN `balanceImageUrl`;--> statement-breakpoint
ALTER TABLE `dailyRevenues` DROP COLUMN `balanceImageKey`;