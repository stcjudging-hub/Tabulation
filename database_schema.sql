-- ============================================================================
-- TABULATION SYSTEM DATABASE SCHEMA
-- Database: tabulation_db
-- This file contains all CREATE TABLE statements to recreate your database
-- ============================================================================

-- Create Database
CREATE DATABASE IF NOT EXISTS `tabulation_db`;
USE `tabulation_db`;

-- ============================================================================
-- TABLE: schools
-- Description: Stores school/organization information
-- ============================================================================
CREATE TABLE IF NOT EXISTS `schools` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_name` VARCHAR(255) NOT NULL,
  `school_logo` LONGTEXT,
  `school_email` VARCHAR(255),
  `school_phone` VARCHAR(20),
  `school_address` TEXT,
  `judge_password` VARCHAR(255) DEFAULT NULL COMMENT 'bcrypt hash for judge login',
  `subscription_plan` VARCHAR(50) DEFAULT 'free' COMMENT 'free, premium, etc.',
  `status` VARCHAR(50) DEFAULT 'active' COMMENT 'active, inactive, suspended',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_active_at` TIMESTAMP NULL DEFAULT NULL COMMENT 'last authenticated activity (admin or judge) used for live active-school tracking',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `school_email` (`school_email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: admins
-- Description: Admin user accounts linked to schools
-- ============================================================================
CREATE TABLE IF NOT EXISTS `admins` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password` VARCHAR(255) NOT NULL,
  `school_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_admins_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: password_resets
-- Description: Sends and verifies password-reset verification codes for admins
-- ============================================================================
CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id` INT NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `code_hash` VARCHAR(255) NOT NULL,
  `attempts` INT DEFAULT 0 COMMENT 'Failed verification attempts',
  `expires_at` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY `admin_id` (`admin_id`),
  KEY `email` (`email`),
  CONSTRAINT `fk_password_resets_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: settings
-- Description: Contest configuration settings per school
-- ============================================================================
CREATE TABLE IF NOT EXISTS `settings` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL UNIQUE,
  `contest_name` VARCHAR(255) DEFAULT '',
  `contest_type` VARCHAR(50) DEFAULT 'pageant' COMMENT 'pageant, competition, etc.',
  `judge_count` INT DEFAULT 3,
  `ai_prompt` VARCHAR(255) DEFAULT 'Modern and Professional',
  `ai_provider` VARCHAR(20) NOT NULL DEFAULT 'groq' COMMENT 'AI provider id used for judge UI generation (groq | gemini | openrouter)',
  `ai_model` VARCHAR(50) DEFAULT 'openai/gpt-oss-120b' COMMENT 'AI model id used for judge UI generation',
  `ui_mode` VARCHAR(20) DEFAULT 'ai' COMMENT 'ai | default — ai=AI-generated judge UI, default=standard deterministic table',
  `computation_type` VARCHAR(50) DEFAULT 'average' COMMENT 'average, rank, or custom',
  `custom_base` VARCHAR(20) NOT NULL DEFAULT 'average' COMMENT 'average or rank; used when computation_type=custom',
  `tie_break_method` VARCHAR(20) NOT NULL DEFAULT 'midrank' COMMENT 'midrank, shared, or sequential; used when computation_type=custom',
  `is_judge_locked` TINYINT DEFAULT 0 COMMENT '0=unlocked, 1=locked',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_settings_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: contestants
-- Description: Contestants/participants in the contest
-- ============================================================================
CREATE TABLE IF NOT EXISTS `contestants` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `entry_number` INT DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `school_id` (`school_id`),
  KEY `entry_number` (`entry_number`),
  CONSTRAINT `fk_contestants_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: criteria
-- Description: Scoring criteria for the contest
-- ============================================================================
CREATE TABLE IF NOT EXISTS `criteria` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `percentage` DECIMAL(5, 2) DEFAULT 0 COMMENT 'Weight percentage for this criterion',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `school_id` (`school_id`),
  CONSTRAINT `fk_criteria_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: scores
-- Description: Judge scores for contestants across criteria
-- ============================================================================
CREATE TABLE IF NOT EXISTS `scores` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `judge_id` VARCHAR(100) NOT NULL,
  `contestant_id` INT NOT NULL,
  `criterion_id` INT NOT NULL,
  `score_value` DECIMAL(10, 2) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `school_id` (`school_id`),
  KEY `judge_id` (`judge_id`),
  KEY `contestant_id` (`contestant_id`),
  KEY `criterion_id` (`criterion_id`),
  UNIQUE KEY `unique_score` (`school_id`, `judge_id`, `contestant_id`, `criterion_id`),
  CONSTRAINT `fk_scores_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_scores_contestant` FOREIGN KEY (`contestant_id`) REFERENCES `contestants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_scores_criteria` FOREIGN KEY (`criterion_id`) REFERENCES `criteria` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: system_config
-- Description: UI and system configuration per school
-- ============================================================================
CREATE TABLE IF NOT EXISTS `system_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `school_name` VARCHAR(255),
  `portal_name` VARCHAR(255),
  `school_logo` LONGTEXT,
  `background_logo` LONGTEXT,
  `primary_color` VARCHAR(7) DEFAULT '#22c55e',
  `secondary_color` VARCHAR(7) DEFAULT '#0f172a',
  `footer_text` TEXT,
  `logo_radius` INT DEFAULT 12 COMMENT 'Border radius in pixels',
  `header_template` VARCHAR(50) DEFAULT 'structured' COMMENT 'structured, minimal, etc.',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `school_id` (`school_id`),
  CONSTRAINT `fk_system_config_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: ui_cache
-- Description: Cached AI-generated UI content
-- ============================================================================
CREATE TABLE IF NOT EXISTS `ui_cache` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `design_type` ENUM('ai','default') NOT NULL DEFAULT 'default' COMMENT 'ai = AI-generated judge UI, default = standard deterministic table',
  `prompt_hash` VARCHAR(32) NOT NULL,
  `html_content` LONGTEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `school_id` (`school_id`),
  UNIQUE KEY `unique_cache` (`school_id`, `prompt_hash`),
  CONSTRAINT `fk_ui_cache_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: generations
-- Description: Source of truth for async AI UI-generation jobs (Redis is the queue, MySQL owns status)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `generations` (
  `id` VARCHAR(64) NOT NULL PRIMARY KEY,
  `school_id` INT NOT NULL,
  `prompt` TEXT NOT NULL COMMENT 'AI design goal used for generation',
  `model` VARCHAR(50) DEFAULT 'qwen3.8-flash' COMMENT 'B.AI model id used for this generation',
  `status` ENUM('QUEUED','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'QUEUED',
  `prompt_hash` VARCHAR(32) DEFAULT NULL COMMENT 'links to the result in ui_cache',
  `error` TEXT DEFAULT NULL COMMENT 'safe, user-facing failure message',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `started_at` TIMESTAMP NULL DEFAULT NULL,
  `completed_at` TIMESTAMP NULL DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `school_id` (`school_id`),
  CONSTRAINT `fk_generations_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: fullscreen_config
-- Description: Per-school leaderboard fullscreen display customization
-- ============================================================================
CREATE TABLE IF NOT EXISTS `fullscreen_config` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `bg_color` VARCHAR(20) DEFAULT NULL,
  `accent_color` VARCHAR(20) DEFAULT NULL,
  `text_color` VARCHAR(20) DEFAULT NULL,
  `title_text` VARCHAR(255) DEFAULT NULL,
  `subtitle_text` VARCHAR(255) DEFAULT NULL,
  UNIQUE KEY `uniq_school_id` (`school_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: sessions
-- Description: Per-device presence + refresh-token sessions for admins/judges
-- ============================================================================
CREATE TABLE IF NOT EXISTS `sessions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `school_id` INT NOT NULL,
  `actor_type` ENUM('admin','judge') NOT NULL COMMENT 'who owns this device session',
  `actor_id` INT NOT NULL COMMENT 'admins.id for admins, schools.id for judges',
  `device_id` CHAR(36) NOT NULL COMMENT 'opaque per-device id; embedded in access JWTs',
  `refresh_hash` CHAR(64) DEFAULT NULL COMMENT 'sha256 of the opaque 7-day refresh token',
  `last_seen` DATETIME NOT NULL COMMENT 'presence heartbeat — drives online/offline status',
  `expires_at` DATETIME NOT NULL COMMENT 'refresh-token expiry (login + 7 days)',
  `logged_out_at` DATETIME NULL DEFAULT NULL COMMENT 'set when the user signs out from this device',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_sessions_device` (`device_id`),
  KEY `idx_sessions_school_presence` (`school_id`, `logged_out_at`, `last_seen`),
  KEY `idx_sessions_refresh` (`refresh_hash`),
  CONSTRAINT `fk_sessions_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- TABLE: config_history
-- Description: Per-save audit snapshot of the admin's contest configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS `config_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `school_id` INT NOT NULL,
  `contest_name` VARCHAR(255) DEFAULT NULL COMMENT 'contest name at save time',
  `judge_count` INT DEFAULT NULL COMMENT 'judge count at save time',
  `ui_mode` VARCHAR(20) DEFAULT NULL COMMENT 'configured judge UI mode at save time: ai|default',
  `design_type` ENUM('ai','default') DEFAULT NULL COMMENT 'ui_cache design stored for this save',
  `prompt_hash` VARCHAR(32) DEFAULT NULL COMMENT 'links to the matching ui_cache row',
  `computation_type` VARCHAR(20) DEFAULT NULL COMMENT 'average|rank|custom at save time',
  `tie_break_method` VARCHAR(20) DEFAULT NULL COMMENT 'midrank|shared|sequential at save time',
  `snapshot` JSON DEFAULT NULL COMMENT 'full settings + criteria + contestants snapshot for this save',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `school_id` (`school_id`),
  KEY `created_at` (`created_at`),
  CONSTRAINT `fk_config_history_school` FOREIGN KEY (`school_id`) REFERENCES `schools` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- INDEXES for Performance
-- ============================================================================
ALTER TABLE `admins` ADD INDEX `idx_school_id` (`school_id`);
ALTER TABLE `admins` ADD INDEX `idx_email` (`email`);
ALTER TABLE `contestants` ADD INDEX `idx_school_entry` (`school_id`, `entry_number`);
ALTER TABLE `criteria` ADD INDEX `idx_school_id` (`school_id`);
ALTER TABLE `scores` ADD INDEX `idx_school_judge` (`school_id`, `judge_id`);
ALTER TABLE `scores` ADD INDEX `idx_school_contestant` (`school_id`, `contestant_id`);

-- ============================================================================
-- SAMPLE DATA (Optional - Comment out if not needed)
-- ============================================================================
-- You can uncomment and modify the following sample data to test your system

-- -- Insert a sample school
-- INSERT INTO `schools` (school_name, school_email, school_phone, subscription_plan, status)
-- VALUES ('Sample School', 'sample@school.com', '1234567890', 'free', 'active');

-- -- Insert a sample admin (password: 'password123' hashed)
-- INSERT INTO `admins` (name, email, password, school_id)
-- VALUES ('Admin User', 'admin@school.com', '$2b$10$...', 1);

-- -- Insert sample settings
-- INSERT INTO `settings` (school_id, contest_name, contest_type, judge_count, computation_type)
-- VALUES (1, 'Mr./Ms. Beauty Pageant 2024', 'pageant', 3, 'average');

-- -- Insert sample contestants
-- INSERT INTO `contestants` (school_id, name, entry_number)
-- VALUES 
-- (1, 'John Doe', 1),
-- (1, 'Jane Smith', 2),
-- (1, 'Bob Johnson', 3);

-- -- Insert sample criteria
-- INSERT INTO `criteria` (school_id, name, percentage)
-- VALUES 
-- (1, 'Talent', 40),
-- (1, 'Interview', 35),
-- (1, 'Overall Impression', 25);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
