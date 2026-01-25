ALTER TABLE `dailyRevenues` ADD `paidInvoices` decimal(15,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `dailyRevenues` ADD `paidInvoicesNote` text;