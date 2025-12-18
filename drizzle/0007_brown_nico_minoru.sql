CREATE TABLE `financialKpis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`periodType` enum('daily','weekly','monthly','quarterly','yearly') NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`branchId` int,
	`totalRevenue` decimal(15,2) NOT NULL DEFAULT '0.00',
	`totalCost` decimal(15,2) NOT NULL DEFAULT '0.00',
	`totalExpenses` decimal(15,2) NOT NULL DEFAULT '0.00',
	`grossProfit` decimal(15,2) NOT NULL DEFAULT '0.00',
	`netProfit` decimal(15,2) NOT NULL DEFAULT '0.00',
	`grossProfitMargin` decimal(8,4) NOT NULL DEFAULT '0.0000',
	`netProfitMargin` decimal(8,4) NOT NULL DEFAULT '0.0000',
	`roi` decimal(8,4) NOT NULL DEFAULT '0.0000',
	`currentRatio` decimal(8,4) NOT NULL DEFAULT '0.0000',
	`invoiceCount` int NOT NULL DEFAULT 0,
	`customerCount` int NOT NULL DEFAULT 0,
	`averageOrderValue` decimal(12,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financialKpis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryCountItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`countId` int NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productSku` varchar(50),
	`systemQuantity` int NOT NULL DEFAULT 0,
	`countedQuantity` int NOT NULL DEFAULT 0,
	`variance` int NOT NULL DEFAULT 0,
	`unitCost` decimal(12,2) NOT NULL DEFAULT '0.00',
	`varianceValue` decimal(12,2) NOT NULL DEFAULT '0.00',
	`reason` text,
	`status` enum('pending','counted','verified') NOT NULL DEFAULT 'pending',
	`countedBy` int,
	`countedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryCountItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryCounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`countNumber` varchar(50) NOT NULL,
	`branchId` int,
	`branchName` varchar(255),
	`countDate` timestamp NOT NULL,
	`status` enum('draft','in_progress','completed','approved') NOT NULL DEFAULT 'draft',
	`totalProducts` int NOT NULL DEFAULT 0,
	`matchedProducts` int NOT NULL DEFAULT 0,
	`discrepancyProducts` int NOT NULL DEFAULT 0,
	`totalSystemValue` decimal(15,2) NOT NULL DEFAULT '0.00',
	`totalCountedValue` decimal(15,2) NOT NULL DEFAULT '0.00',
	`varianceValue` decimal(15,2) NOT NULL DEFAULT '0.00',
	`notes` text,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255),
	`approvedBy` int,
	`approvedByName` varchar(255),
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryCounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventoryCounts_countNumber_unique` UNIQUE(`countNumber`)
);
--> statement-breakpoint
CREATE TABLE `loginAttempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(100) NOT NULL,
	`userId` int,
	`success` boolean NOT NULL DEFAULT false,
	`ipAddress` varchar(45),
	`userAgent` text,
	`location` varchar(255),
	`failureReason` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loginAttempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(100) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(50) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `priceChangeLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productSku` varchar(50),
	`priceType` enum('cost','selling') NOT NULL,
	`oldPrice` decimal(12,2) NOT NULL,
	`newPrice` decimal(12,2) NOT NULL,
	`changePercentage` decimal(8,2) NOT NULL,
	`reason` text,
	`changedBy` int NOT NULL,
	`changedByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `priceChangeLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `productBatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`batchNumber` varchar(100) NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`remainingQuantity` int NOT NULL DEFAULT 0,
	`costPrice` decimal(12,2) NOT NULL,
	`manufacturingDate` timestamp,
	`expiryDate` timestamp,
	`supplierId` int,
	`purchaseOrderId` int,
	`receivedDate` timestamp NOT NULL DEFAULT (now()),
	`status` enum('active','depleted','expired','recalled') NOT NULL DEFAULT 'active',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `productBatches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `securityAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertType` enum('failed_login_attempts','price_change','bulk_delete','new_location','large_transaction','unusual_activity','low_stock','expiring_products') NOT NULL,
	`severity` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`userId` int,
	`userName` varchar(255),
	`entityType` varchar(50),
	`entityId` int,
	`metadata` text,
	`isRead` boolean NOT NULL DEFAULT false,
	`isResolved` boolean NOT NULL DEFAULT false,
	`resolvedBy` int,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `securityAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `suggestedPurchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`productName` varchar(255) NOT NULL,
	`productSku` varchar(50),
	`currentQuantity` int NOT NULL DEFAULT 0,
	`minQuantity` int NOT NULL DEFAULT 0,
	`suggestedQuantity` int NOT NULL DEFAULT 0,
	`averageConsumption` decimal(12,2) NOT NULL DEFAULT '0.00',
	`lastPurchasePrice` decimal(12,2),
	`preferredSupplierId` int,
	`preferredSupplierName` varchar(255),
	`status` enum('pending','approved','ordered','dismissed') NOT NULL DEFAULT 'pending',
	`approvedBy` int,
	`approvedAt` timestamp,
	`purchaseOrderId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suggestedPurchaseOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userPermissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`permissionId` int NOT NULL,
	`grantedBy` int NOT NULL,
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userPermissions_id` PRIMARY KEY(`id`)
);
