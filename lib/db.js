
import { sql } from '@vercel/postgres';

// Vercel Postgres Connection Helper

export async function getDb() {
  // Ensure tables exist (Lazy migration for simplicity)
  await initSchema();
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
      is_active INTEGER DEFAULT 1,
      execution_mode TEXT DEFAULT 'polling' CHECK(execution_mode IN ('polling', 'webhook')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

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

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  const { rows } = await sql`
    SELECT c.*,
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id) as total_dms,
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id AND status = 'sent') as sent_dms
    FROM campaigns c WHERE c.id = ${id}
  `;
  return rows[0];
}

export async function createCampaign(data) {
  const { rows } = await sql`
    INSERT INTO campaigns (name, ig_media_id, ig_media_url, ig_media_caption, trigger_type, keywords, check_follower, dm_default, dm_follower, dm_non_follower, is_active, execution_mode)
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
      ${data.is_active !== false ? 1 : 0},
      ${data.execution_mode || 'polling'}
    )
    RETURNING *
  `;
  return rows[0];
}

export async function updateCampaign(id, data) {
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
      is_active = ${data.is_active !== false ? 1 : 0},
      execution_mode = ${data.execution_mode || 'polling'},
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ${id}
  `;
  return getCampaignById(id);
}

export async function deleteCampaign(id) {
  await sql`DELETE FROM campaigns WHERE id = ${id}`;
}

export async function toggleCampaign(id, isActive) {
  await sql`UPDATE campaigns SET is_active = ${isActive ? 1 : 0}, updated_at = CURRENT_TIMESTAMP WHERE id = ${id}`;
}

// ============ DM Log Queries ============
export async function getDmLogs({ limit = 50, offset = 0, status = null, campaignId = null } = {}) {
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
  const { rows } = await sql`
    INSERT INTO dm_logs (campaign_id, ig_user_id, ig_username, comment_id, comment_text, is_follower, dm_sent, status, error_message)
    VALUES (
      ${data.campaign_id}, 
      ${data.ig_user_id}, 
      ${data.ig_username}, 
      ${data.comment_id}, 
      ${data.comment_text}, 
      ${data.is_follower ? 1 : 0}, 
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
  // Ensure table exists before getting settings (catch chicken-egg problem)
  try {
    const { rows } = await sql`SELECT value FROM settings WHERE key = ${key}`;
    return rows[0]?.value || '';
  } catch (e) {
    if (e.message.includes('relation "settings" does not exist')) {
      await initSchema();
      return '';
    }
    throw e;
  }
}

export async function setSetting(key, value) {
  await initSchema(); // Ensure table exists
  await sql`
    INSERT INTO settings (key, value, updated_at) VALUES (${key}, ${value}, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ${value}, updated_at = CURRENT_TIMESTAMP
  `;
}

// ============ Followers Cache ============
export async function isFollower(accountId, igUserId) {
  const { rows } = await sql`
    SELECT id FROM followers_cache WHERE account_id = ${accountId} AND ig_user_id = ${igUserId}
  `;
  return rows.length > 0;
}

export async function cacheFollowers(accountId, followers) {
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
