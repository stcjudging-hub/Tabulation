USE `tabulation_db`;

-- Run this check first. If it returns rows, resolve those duplicate names
-- in the admin contestant list and save before running ALTER TABLE below.
-- No contestants or scores are automatically deleted by this migration.
SELECT `school_id`,
       CONVERT(TRIM(`name`) USING utf8mb4) COLLATE utf8mb4_unicode_ci AS `duplicate_name`,
       COUNT(*) AS `total`,
       GROUP_CONCAT(`id` ORDER BY `id`) AS `contestant_ids`
FROM `contestants`
GROUP BY `school_id`, `duplicate_name`
HAVING COUNT(*) > 1;

-- Run once on an existing database. One active contest is stored per school.
-- The generated key ignores surrounding spaces; its collation ignores case
-- and accents, matching the schema's existing name collation.
ALTER TABLE `contestants`
  ADD COLUMN `name_unique` VARCHAR(255)
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    GENERATED ALWAYS AS (TRIM(`name`)) STORED,
  ADD UNIQUE KEY `uq_contestants_school_name` (`school_id`, `name_unique`);
