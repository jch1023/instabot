
import { sql } from '@vercel/postgres';

// Vercel Postgres Connection Helper
let schemaReady = false;
let schemaInitPromise = null;

async function ensureSchema() {
  if (schemaReady) return;
  if (!schemaInitPromise) {
    schemaInitPromise = initSchema()
      .then(() => {
        schemaReady = true;
      })
      .catch((err) => {
        schemaInitPromise = null;
        throw err;
      });
  }
  await schemaInitPromise;
}

export async function getDb() {
  await ensureSchema();
  return sql;
}

async function initSchema() {
  // Create tables if not exists
  await sql`
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      ig_user_id TEXT UNIQUE NOT NULL,
      ig_username TEXT,
      access_token TEXT NOT NULL,
      token_expires_at BIGINT,
      page_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS campaigns (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      ig_media_id TEXT,
      ig_media_url TEXT,
      ig_media_caption TEXT,
      trigger_type TEXT DEFAULT 'all' CHECK(trigger_type IN ('all', 'keyword')),
      keywords TEXT DEFAULT '[]',
      check_follower INTEGER DEFAULT 0,
      dm_default TEXT DEFAULT '',
      dm_follower TEXT DEFAULT '',
      dm_non_follower TEXT DEFAULT '',
      cta_enabled INTEGER DEFAULT 1,
      cta_button_text TEXT DEFAULT '팔로우 했어요',
      cta_payload TEXT DEFAULT 'FOLLOW_RECHECK',
      cta_follower_enabled INTEGER DEFAULT 0,
      cta_follower_button_text TEXT DEFAULT '팔로워 확인했어요',
      cta_follower_payload TEXT DEFAULT 'FOLLOWER_RECHECK',
      cta_follower_prompt TEXT DEFAULT '아래 버튼을 눌러 진행해주세요.',
      cta_non_follower_enabled INTEGER DEFAULT 1,
      cta_non_follower_button_text TEXT DEFAULT '팔로우 했어요',
      cta_non_follower_payload TEXT DEFAULT 'FOLLOW_RECHECK',
      cta_non_follower_prompt TEXT DEFAULT '아래 버튼을 눌러 팔로우 상태를 다시 확인해주세요.',
      is_active INTEGER DEFAULT 1,
      execution_mode TEXT DEFAULT 'polling' CHECK(execution_mode IN ('polling', 'webhook')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Add campaign columns for existing tables (safe no-op on new DBs)
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_enabled INTEGER DEFAULT 1`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_button_text TEXT DEFAULT '팔로우 했어요'`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_payload TEXT DEFAULT 'FOLLOW_RECHECK'`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_follower_enabled INTEGER DEFAULT 0`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_follower_button_text TEXT DEFAULT '팔로워 확인했어요'`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_follower_payload TEXT DEFAULT 'FOLLOWER_RECHECK'`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_follower_prompt TEXT DEFAULT '아래 버튼을 눌러 진행해주세요.'`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_non_follower_enabled INTEGER DEFAULT 1`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_non_follower_button_text TEXT DEFAULT '팔로우 했어요'`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_non_follower_payload TEXT DEFAULT 'FOLLOW_RECHECK'`;
  await sql`ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS cta_non_follower_prompt TEXT DEFAULT '아래 버튼을 눌러 팔로우 상태를 다시 확인해주세요.'`;

  // Index for campaigns
  await sql`CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(is_active)`;


  await sql`
    CREATE TABLE IF NOT EXISTS dm_logs (
      id SERIAL PRIMARY KEY,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      ig_user_id TEXT,
      ig_username TEXT,
      comment_id TEXT,
      comment_text TEXT,
      is_follower INTEGER,
      dm_sent TEXT,
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'failed', 'pending')),
      error_message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Indexes for dm_logs
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_logs_campaign ON dm_logs(campaign_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_dm_logs_created ON dm_logs(created_at DESC)`;

  await sql`
    CREATE TABLE IF NOT EXISTS followers_cache (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
      ig_user_id TEXT NOT NULL,
      ig_username TEXT,
      cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, ig_user_id)
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_followers_cache_account ON followers_cache(account_id, ig_user_id)`;
  await sql`ALTER TABLE followers_cache DROP CONSTRAINT IF EXISTS followers_cache_account_id_fkey`;

  await sql`
    CREATE TABLE IF NOT EXISTS follow_status_cache (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
      ig_user_id TEXT NOT NULL,
      ig_username TEXT,
      is_follower INTEGER NOT NULL CHECK(is_follower IN (0, 1)),
      source TEXT DEFAULT 'profile_api',
      checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, ig_user_id)
    );
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_follow_status_cache_account ON follow_status_cache(account_id, ig_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_follow_status_cache_checked ON follow_status_cache(checked_at DESC)`;
  await sql`ALTER TABLE follow_status_cache DROP CONSTRAINT IF EXISTS follow_status_cache_account_id_fkey`;

  await sql`
    CREATE TABLE IF NOT EXISTS follow_recheck_pending (
      id SERIAL PRIMARY KEY,
      account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
      ig_user_id TEXT NOT NULL,
      ig_username TEXT,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE CASCADE,
      comment_id TEXT,
      comment_text TEXT,
      cta_button_text TEXT,
      cta_payload TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, ig_user_id, campaign_id)
    );
  `;
  await sql`ALTER TABLE follow_recheck_pending ADD COLUMN IF NOT EXISTS cta_button_text TEXT`;
  await sql`ALTER TABLE follow_recheck_pending ADD COLUMN IF NOT EXISTS cta_payload TEXT`;

  await sql`CREATE INDEX IF NOT EXISTS idx_follow_recheck_pending_user ON follow_recheck_pending(account_id, ig_user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_follow_recheck_pending_updated ON follow_recheck_pending(updated_at DESC)`;
  await sql`ALTER TABLE follow_recheck_pending DROP CONSTRAINT IF EXISTS follow_recheck_pending_account_id_fkey`;

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Webhook Logs Table (for real-time debugging)
  await sql`
    CREATE TABLE IF NOT EXISTS webhook_logs (
      id SERIAL PRIMARY KEY,
      event_type TEXT DEFAULT 'unknown',
      payload TEXT,
      processed BOOLEAN DEFAULT false,
      result TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Default Settings
  await sql`
    INSERT INTO settings (key, value) VALUES 
    ('webhook_verify_token', 'instabot_verify_2026'),
    ('instagram_access_token', 'IGAARoW4rWC1BBZAGJIU1F5MGJVTUh2cy1OX2xPbXA2ZAVBZAUnVZANmxIdlZAteWhpa25IY1F0MG83LUZAkckFkOG1iMWlwT0MxQ3ZAoZAXNXaWtUQm43S3Q4MFZAaQWF1dXA1TTRmaE83VFhJNGdVakYwUDl1VzlxRk9qSzdCQkc1Sm5PbwZDZD')
    ON CONFLICT (key) DO NOTHING;
  `;
}

// ============ Campaign Queries ============
export async function getAllCampaigns() {
  await ensureSchema();
  const { rows } = await sql`
    SELECT c.*, 
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id) as total_dms,
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id AND status = 'sent') as sent_dms,
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id AND status = 'failed') as failed_dms
    FROM campaigns c
    ORDER BY c.created_at DESC
  `;
  return rows;
}

export async function getCampaignById(id) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT c.*,
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id) as total_dms,
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id AND status = 'sent') as sent_dms
    FROM campaigns c WHERE c.id = ${id}
  `;
  return rows[0];
}

export async function createCampaign(data) {
  await ensureSchema();
  const { rows } = await sql`
    INSERT INTO campaigns (
      name, ig_media_id, ig_media_url, ig_media_caption, trigger_type, keywords,
      check_follower, dm_default, dm_follower, dm_non_follower,
      cta_enabled, cta_button_text, cta_payload,
      cta_follower_enabled, cta_follower_button_text, cta_follower_payload, cta_follower_prompt,
      cta_non_follower_enabled, cta_non_follower_button_text, cta_non_follower_payload, cta_non_follower_prompt,
      is_active, execution_mode
    )
    VALUES (
      ${data.name}, 
      ${data.ig_media_id || null}, 
      ${data.ig_media_url || null}, 
      ${data.ig_media_caption || null}, 
      ${data.trigger_type || 'all'}, 
      ${JSON.stringify(data.keywords || [])}, 
      ${data.check_follower ? 1 : 0}, 
      ${data.dm_default || ''}, 
      ${data.dm_follower || ''}, 
      ${data.dm_non_follower || ''}, 
      ${data.cta_enabled !== false ? 1 : 0},
      ${data.cta_button_text || '팔로우 했어요'},
      ${data.cta_payload || 'FOLLOW_RECHECK'},
      ${data.cta_follower_enabled ? 1 : 0},
      ${data.cta_follower_button_text || '팔로워 확인했어요'},
      ${data.cta_follower_payload || 'FOLLOWER_RECHECK'},
      ${data.cta_follower_prompt || '아래 버튼을 눌러 진행해주세요.'},
      ${data.cta_non_follower_enabled !== false ? 1 : 0},
      ${data.cta_non_follower_button_text || '팔로우 했어요'},
      ${data.cta_non_follower_payload || 'FOLLOW_RECHECK'},
      ${data.cta_non_follower_prompt || '아래 버튼을 눌러 팔로우 상태를 다시 확인해주세요.'},
      ${data.is_active !== false ? 1 : 0},
      'webhook'
    )
    RETURNING *
  `;
  return rows[0];
}

export async function updateCampaign(id, data) {
  await ensureSchema();
  await sql`
    UPDATE campaigns SET
      name = ${data.name},
      ig_media_id = ${data.ig_media_id || null},
      ig_media_url = ${data.ig_media_url || null},
      ig_media_caption = ${data.ig_media_caption || null},
      trigger_type = ${data.trigger_type || 'all'},
      keywords = ${JSON.stringify(data.keywords || [])},
      check_follower = ${data.check_follower ? 1 : 0},
      dm_default = ${data.dm_default || ''},
      dm_follower = ${data.dm_follower || ''},
      dm_non_follower = ${data.dm_non_follower || ''},
      cta_enabled = ${data.cta_enabled !== false ? 1 : 0},
      cta_button_text = ${data.cta_button_text || '팔로우 했어요'},
      cta_payload = ${data.cta_payload || 'FOLLOW_RECHECK'},
      cta_follower_enabled = ${data.cta_follower_enabled ? 1 : 0},
      cta_follower_button_text = ${data.cta_follower_button_text || '팔로워 확인했어요'},
      cta_follower_payload = ${data.cta_follower_payload || 'FOLLOWER_RECHECK'},
      cta_follower_prompt = ${data.cta_follower_prompt || '아래 버튼을 눌러 진행해주세요.'},
      cta_non_follower_enabled = ${data.cta_non_follower_enabled !== false ? 1 : 0},
      cta_non_follower_button_text = ${data.cta_non_follower_button_text || '팔로우 했어요'},
      cta_non_follower_payload = ${data.cta_non_follower_payload || 'FOLLOW_RECHECK'},
      cta_non_follower_prompt = ${data.cta_non_follower_prompt || '아래 버튼을 눌러 팔로우 상태를 다시 확인해주세요.'},
      is_active = ${data.is_active !== false ? 1 : 0},
      execution_mode = 'webhook',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
  return getCampaignById(id);
}

export async function deleteCampaign(id) {
  await ensureSchema();
  await sql`DELETE FROM campaigns WHERE id = ${id}`;
}

export async function toggleCampaign(id, isActive) {
  await ensureSchema();
  await sql`UPDATE campaigns SET is_active = ${isActive ? 1 : 0}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
}

// ============ DM Log Queries ============
export async function getDmLogs({ limit = 50, offset = 0, status = null, campaignId = null } = {}) {
  await ensureSchema();
  // Construct dynamic query safely
  let query = `
    SELECT dl.*, c.name as campaign_name
    FROM dm_logs dl
    LEFT JOIN campaigns c ON dl.campaign_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ` AND dl.status = $${params.length + 1}`;
    params.push(status);
  }
  if (campaignId) {
    query += ` AND dl.campaign_id = $${params.length + 1}`;
    params.push(campaignId);
  }

  query += ` ORDER BY dl.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, offset);

  const { rows } = await sql.query(query, params);
  return rows;
}

export async function createDmLog(data) {
  await ensureSchema();
  const normalizedFollower =
    data.is_follower === null || data.is_follower === undefined
      ? null
      : (data.is_follower ? 1 : 0);

  const { rows } = await sql`
    INSERT INTO dm_logs (campaign_id, ig_user_id, ig_username, comment_id, comment_text, is_follower, dm_sent, status, error_message)
    VALUES (
      ${data.campaign_id}, 
      ${data.ig_user_id}, 
      ${data.ig_username}, 
      ${data.comment_id}, 
      ${data.comment_text}, 
      ${normalizedFollower}, 
      ${data.dm_sent}, 
      ${data.status || 'sent'}, 
      ${data.error_message || null}
    )
    RETURNING id
  `;
  return rows[0];
}

// ============ Stats Queries ============
export async function getDashboardStats() {
  await ensureSchema();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  // Parallel queries for speed
  const [todayDmsRes, todayCommentsRes, activeCampaignsRes, totalCampaignsRes, successRateRes] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM dm_logs WHERE created_at::date = ${today}::date`,
    sql`SELECT COUNT(*) as count FROM dm_logs WHERE created_at::date = ${today}::date`, // Same as DMs roughly
    sql`SELECT COUNT(*) as count FROM campaigns WHERE is_active = 1`,
    sql`SELECT COUNT(*) as count FROM campaigns`,
    sql`
      SELECT 
        CASE WHEN COUNT(*) > 0 
          THEN ROUND(CAST(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS NUMERIC) / COUNT(*) * 100, 1) 
          ELSE 0 
        END as rate
      FROM dm_logs
    `
  ]);

  return {
    todayDms: todayDmsRes.rows[0].count,
    todayComments: todayCommentsRes.rows[0].count,
    activeCampaigns: activeCampaignsRes.rows[0].count,
    totalCampaigns: totalCampaignsRes.rows[0].count,
    successRate: successRateRes.rows[0].rate
  };
}

// ============ Settings Queries ============
export async function getSetting(key) {
  await ensureSchema();
  const { rows } = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value || '';
}

export async function setSetting(key, value) {
  await ensureSchema();
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ${value}, updated_at = CURRENT_TIMESTAMP
  `;
}

// ============ Followers Cache ============
export async function isFollower(accountId, igUserId) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT id FROM followers_cache WHERE account_id = ${accountId} AND ig_user_id = ${igUserId}
  `;
  return rows.length > 0;
}

export async function cacheFollowers(accountId, followers) {
  await ensureSchema();
  // Batch insert optimization
  // Note: Vercel Postgres/Neon supports massive inserts better than loop
  // But for simple safety, let's just loop or use JSON unnest if needed.
  // Simple loop is fine for < 100 items.

  if (!followers || followers.length === 0) return;

  for (const f of followers) {
    await sql`
      INSERT INTO followers_cache (account_id, ig_user_id, ig_username, cached_at) 
      VALUES (${accountId}, ${f.id}, ${f.username}, CURRENT_TIMESTAMP)
      ON CONFLICT(account_id, ig_user_id) 
      DO UPDATE SET ig_username = ${f.username}, cached_at = CURRENT_TIMESTAMP
    `;
  }
}

export async function getCachedFollowStatus(accountId, igUserId, maxAgeSeconds = 86400) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT is_follower, checked_at
    FROM follow_status_cache
    WHERE account_id = ${accountId} AND ig_user_id = ${igUserId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const row = rows[0];
  if (!row.checked_at) return row.is_follower === 1;

  const checkedAt = new Date(row.checked_at).getTime();
  if (Number.isNaN(checkedAt)) return row.is_follower === 1;
  if (maxAgeSeconds <= 0) return row.is_follower === 1;

  const ageSeconds = (Date.now() - checkedAt) / 1000;
  if (ageSeconds > maxAgeSeconds) return null;

  return row.is_follower === 1;
}

export async function setCachedFollowStatus(accountId, { id, username, isFollower, source = 'profile_api' }) {
  await ensureSchema();
  if (!id || typeof isFollower !== 'boolean') return;

  await sql`
    INSERT INTO follow_status_cache (account_id, ig_user_id, ig_username, is_follower, source, checked_at)
    VALUES (${accountId}, ${id}, ${username || null}, ${isFollower ? 1 : 0}, ${source}, CURRENT_TIMESTAMP)
    ON CONFLICT(account_id, ig_user_id)
    DO UPDATE SET
      ig_username = COALESCE(${username || null}, follow_status_cache.ig_username),
      is_follower = ${isFollower ? 1 : 0},
      source = ${source},
      checked_at = CURRENT_TIMESTAMP
  `;
}

export async function upsertPendingFollowRecheck(accountId, data) {
  await ensureSchema();
  if (!data?.igUserId || !data?.campaignId) return;

  await sql`
    INSERT INTO follow_recheck_pending (
      account_id, ig_user_id, ig_username, campaign_id, comment_id, comment_text, cta_button_text, cta_payload, created_at, updated_at
    )
    VALUES (
      ${accountId},
      ${data.igUserId},
      ${data.igUsername || null},
      ${data.campaignId},
      ${data.commentId || null},
      ${data.commentText || null},
      ${data.ctaButtonText || null},
      ${data.ctaPayload || null},
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(account_id, ig_user_id, campaign_id)
    DO UPDATE SET
      ig_username = COALESCE(${data.igUsername || null}, follow_recheck_pending.ig_username),
      comment_id = COALESCE(${data.commentId || null}, follow_recheck_pending.comment_id),
      comment_text = COALESCE(${data.commentText || null}, follow_recheck_pending.comment_text),
      cta_button_text = COALESCE(${data.ctaButtonText || null}, follow_recheck_pending.cta_button_text),
      cta_payload = COALESCE(${data.ctaPayload || null}, follow_recheck_pending.cta_payload),
      updated_at = CURRENT_TIMESTAMP
  `;
}

export async function getPendingFollowRechecks(accountId, igUserId, limit = 5) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT
      p.id,
      p.account_id,
      p.ig_user_id,
      p.ig_username,
      p.campaign_id,
      p.comment_id,
      p.comment_text,
      p.cta_button_text,
      p.cta_payload,
      p.updated_at,
      c.name AS campaign_name,
      c.dm_follower,
      c.dm_non_follower,
      c.dm_default,
      c.cta_follower_enabled,
      c.cta_follower_button_text,
      c.cta_follower_payload,
      c.cta_follower_prompt,
      c.cta_non_follower_enabled,
      c.cta_non_follower_button_text,
      c.cta_non_follower_payload,
      c.cta_non_follower_prompt,
      c.cta_enabled,
      c.cta_button_text,
      c.cta_payload,
      c.is_active,
      c.check_follower
    FROM follow_recheck_pending p
    JOIN campaigns c ON c.id = p.campaign_id
    WHERE p.account_id = ${accountId}
      AND p.ig_user_id = ${igUserId}
    ORDER BY p.updated_at DESC
    LIMIT ${limit}
  `;
  return rows;
}

export async function removePendingFollowRecheck(id) {
  await ensureSchema();
  await sql`DELETE FROM follow_recheck_pending WHERE id = ${id}`;
}

// ============ Webhook Logs ============

export async function saveWebhookLog(eventType, payload, processed = false, result = null) {
  await ensureSchema();
  const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const resultStr = result ? (typeof result === 'string' ? result : JSON.stringify(result)) : null;
  await sql`
    INSERT INTO webhook_logs (event_type, payload, processed, result) 
    VALUES (${eventType}, ${payloadStr}, ${processed}, ${resultStr})
  `;
}

export async function getWebhookLogs(limit = 50) {
  await ensureSchema();
  const { rows } = await sql`
    SELECT * FROM webhook_logs ORDER BY created_at DESC LIMIT ${limit}
  `;
  return rows;
}

