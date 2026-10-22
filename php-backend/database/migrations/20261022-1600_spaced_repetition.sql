-- Spaced repetition: a SPACED frequency whose plan (day numbers, day 1 = start
-- date) is stored in `spacing` with the settings it was generated from.
ALTER TABLE `tasks`
  MODIFY `frequency` ENUM('ONCE','DAILY','WEEKLY','MONTHLY','CUSTOM','SPACED') NOT NULL DEFAULT 'ONCE',
  ADD COLUMN `spacing` JSON NULL AFTER `interval_days`;

ALTER TABLE `task_templates`
  MODIFY `frequency` ENUM('ONCE','DAILY','WEEKLY','MONTHLY','CUSTOM','SPACED') NOT NULL DEFAULT 'ONCE',
  ADD COLUMN `spacing` JSON NULL AFTER `interval_days`;
