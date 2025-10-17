-- AlterTable
ALTER TABLE `product` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateIndex
CREATE INDEX `Product_name_idx` ON `Product`(`name`);
