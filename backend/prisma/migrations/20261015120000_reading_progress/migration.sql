-- AlterTable
ALTER TABLE `subjects` ADD COLUMN `content_updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `content_nodes` ADD COLUMN `content_updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `has_content` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `read_progress` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `node_id` VARCHAR(191) NULL,
    `scope_key` VARCHAR(191) NOT NULL,
    `first_opened_at` DATETIME(3) NULL,
    `last_opened_at` DATETIME(3) NULL,
    `completed_at` DATETIME(3) NULL,
    `time_spent_sec` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `read_progress_user_id_subject_id_idx`(`user_id`, `subject_id`),
    UNIQUE INDEX `read_progress_user_id_scope_key_key`(`user_id`, `scope_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `study_events` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `node_id` VARCHAR(191) NULL,
    `type` ENUM('OPEN', 'COMPLETE', 'UNCOMPLETE', 'RESET') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `study_events_user_id_subject_id_created_at_idx`(`user_id`, `subject_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `study_time` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `node_id` VARCHAR(191) NULL,
    `scope_key` VARCHAR(191) NOT NULL,
    `day` DATE NOT NULL,
    `seconds` INTEGER NOT NULL DEFAULT 0,

    INDEX `study_time_user_id_subject_id_day_idx`(`user_id`, `subject_id`, `day`),
    UNIQUE INDEX `study_time_user_id_scope_key_day_key`(`user_id`, `scope_key`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `read_progress` ADD CONSTRAINT `read_progress_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `study_events` ADD CONSTRAINT `study_events_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `study_time` ADD CONSTRAINT `study_time_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: existing content counts as last changed at its last update.
UPDATE `content_nodes` SET `has_content` = (`content` IS NOT NULL AND `content` <> ''), `content_updated_at` = `updated_at`;
UPDATE `subjects` SET `content_updated_at` = `updated_at`;
