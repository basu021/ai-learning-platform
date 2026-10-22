-- AlterTable
ALTER TABLE `tasks` ADD COLUMN `template_id` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `task_templates` (
    `id` VARCHAR(191) NOT NULL,
    `subject_id` VARCHAR(191) NOT NULL,
    `node_id` VARCHAR(191) NULL,
    `trigger_node_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `instructions` LONGTEXT NULL,
    `difficulty` VARCHAR(191) NOT NULL DEFAULT 'beginner',
    `estimated_mins` INTEGER NULL,
    `xp_reward` INTEGER NOT NULL DEFAULT 10,
    `frequency` ENUM('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM') NOT NULL DEFAULT 'ONCE',
    `weekdays` VARCHAR(191) NULL,
    `month_day` INTEGER NULL,
    `interval_days` INTEGER NULL,
    `start_after_days` INTEGER NOT NULL DEFAULT 0,
    `duration_days` INTEGER NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `task_templates_subject_id_active_idx`(`subject_id`, `active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `tasks_template_id_assignee_id_key` ON `tasks`(`template_id`, `assignee_id`);

-- AddForeignKey
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `task_templates`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_templates` ADD CONSTRAINT `task_templates_subject_id_fkey` FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_templates` ADD CONSTRAINT `task_templates_node_id_fkey` FOREIGN KEY (`node_id`) REFERENCES `content_nodes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_templates` ADD CONSTRAINT `task_templates_trigger_node_id_fkey` FOREIGN KEY (`trigger_node_id`) REFERENCES `content_nodes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `task_templates` ADD CONSTRAINT `task_templates_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
