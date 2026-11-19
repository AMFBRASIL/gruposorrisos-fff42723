import type { Pool } from "../database/pool.js";

export async function ensureSettings(pool: Pool, log: (message: string) => void) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      theme VARCHAR(16) NOT NULL DEFAULT 'escuro',
      compact_density TINYINT NOT NULL DEFAULT 0,
      animations TINYINT NOT NULL DEFAULT 1,
      sidebar_expanded TINYINT NOT NULL DEFAULT 1,
      notification_frequency VARCHAR(20) NOT NULL DEFAULT 'instantaneo',
      notify_assigned TINYINT NOT NULL DEFAULT 1,
      notify_comments TINYINT NOT NULL DEFAULT 1,
      notify_deadline TINYINT NOT NULL DEFAULT 1,
      notify_completed TINYINT NOT NULL DEFAULT 0,
      notify_sound TINYINT NOT NULL DEFAULT 0,
      language VARCHAR(8) NOT NULL DEFAULT 'ptbr',
      timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
      date_format VARCHAR(20) NOT NULL DEFAULT 'DD/MM/AAAA',
      profile_visibility VARCHAR(16) NOT NULL DEFAULT 'equipe',
      show_online TINYINT NOT NULL DEFAULT 1,
      allow_indexing TINYINT NOT NULL DEFAULT 0,
      share_anonymous TINYINT NOT NULL DEFAULT 1,
      bio VARCHAR(500) NULL,
      department_label VARCHAR(80) NULL,
      two_factor VARCHAR(16) NOT NULL DEFAULT 'off',
      session_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 15,
      totp_secret TEXT NULL,
      touched JSON NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
      invite_by_link TINYINT NOT NULL DEFAULT 1,
      require_approval TINYINT NOT NULL DEFAULT 1,
      allowed_domain VARCHAR(80) NOT NULL DEFAULT '',
      default_role VARCHAR(80) NOT NULL DEFAULT 'Colaborador(a)',
      kanban_wip SMALLINT UNSIGNED NOT NULL DEFAULT 8,
      show_cover TINYINT NOT NULL DEFAULT 1,
      show_avatars TINYINT NOT NULL DEFAULT 1,
      show_checklist TINYINT NOT NULL DEFAULT 1,
      show_tags TINYINT NOT NULL DEFAULT 1,
      show_due TINYINT NOT NULL DEFAULT 1,
      auto_archive TINYINT NOT NULL DEFAULT 0,
      log_task_history TINYINT NOT NULL DEFAULT 1,
      log_access TINYINT NOT NULL DEFAULT 1,
      show_viewers TINYINT NOT NULL DEFAULT 0,
      history_retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 90,
      mail_method VARCHAR(8) NOT NULL DEFAULT 'api',
      mail_provider VARCHAR(32) NOT NULL DEFAULT 'resend',
      mail_public JSON NULL,
      mail_secrets TEXT NULL,
      mail_weekly TINYINT NOT NULL DEFAULT 1,
      mail_executive TINYINT NOT NULL DEFAULT 1,
      mail_signature TINYINT NOT NULL DEFAULT 1,
      mail_status VARCHAR(16) NOT NULL DEFAULT 'ausente',
      mail_last_error VARCHAR(300) NULL,
      ai_mode VARCHAR(20) NOT NULL DEFAULT 'equilibrado',
      ai_assistant TINYINT NOT NULL DEFAULT 1,
      ai_priority TINYINT NOT NULL DEFAULT 1,
      ai_summaries TINYINT NOT NULL DEFAULT 0,
      sso_enabled TINYINT NOT NULL DEFAULT 0,
      suspicious_login_alerts TINYINT NOT NULL DEFAULT 1,
      backup_frequency VARCHAR(16) NOT NULL DEFAULT 'diario',
      backup_retention_days SMALLINT UNSIGNED NOT NULL DEFAULT 30,
      backup_time CHAR(5) NOT NULL DEFAULT '03:00',
      touched JSON NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS integrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      service VARCHAR(32) NOT NULL,
      public_config JSON NULL,
      secret_blob TEXT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      updated_by BIGINT UNSIGNED NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_integrations_service (service)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS automation_rules (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      trigger_code VARCHAR(32) NOT NULL,
      action_code VARCHAR(32) NOT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS api_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      environment VARCHAR(16) NOT NULL,
      token_hash CHAR(64) NOT NULL,
      token_prefix VARCHAR(16) NOT NULL,
      created_by BIGINT UNSIGNED NULL,
      revoked_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_api_tokens_hash (token_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS backup_jobs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      frequency VARCHAR(16) NOT NULL,
      retention_days SMALLINT UNSIGNED NOT NULL,
      run_time CHAR(5) NOT NULL,
      status VARCHAR(16) NOT NULL,
      requested_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query("INSERT IGNORE INTO platform_settings (id) VALUES (1)");
  log("Configurações verificadas.");
}
