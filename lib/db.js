import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(process.cwd(), 'db', 'instabot.db');

let db;

export function getDb() {
    if (!db) {
        // Ensure directory exists
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('foreign_keys = ON');

        initSchema(db);
    }
    return db;
}

function initSchema(db) {
    db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ig_user_id TEXT UNIQUE NOT NULL,
      ig_username TEXT,
      access_token TEXT NOT NULL,
      token_expires_at INTEGER,
      page_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dm_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
      ig_user_id TEXT,
      ig_username TEXT,
      comment_id TEXT,
      comment_text TEXT,
      is_follower INTEGER,
      dm_sent TEXT,
      status TEXT DEFAULT 'sent' CHECK(status IN ('sent', 'failed', 'pending')),
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS followers_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER REFERENCES accounts(id) ON DELETE CASCADE,
      ig_user_id TEXT NOT NULL,
      ig_username TEXT,
      cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(account_id, ig_user_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_dm_logs_campaign ON dm_logs(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_dm_logs_created ON dm_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(is_active);
    CREATE INDEX IF NOT EXISTS idx_followers_cache_account ON followers_cache(account_id, ig_user_id);
  `);

    // Insert default settings if not exist
    const upsertSetting = db.prepare(`
    INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
  `);
    upsertSetting.run('webhook_verify_token', 'instabot_verify_' + Date.now());
    upsertSetting.run('meta_app_id', '');
    upsertSetting.run('meta_app_secret', '');
}

// ============ Campaign Queries ============
export function getAllCampaigns() {
    const db = getDb();
    return db.prepare(`
    SELECT c.*, 
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id) as total_dms,
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id AND status = 'sent') as sent_dms,
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id AND status = 'failed') as failed_dms
    FROM campaigns c
    ORDER BY c.created_at DESC
  `).all();
}

export function getCampaignById(id) {
    const db = getDb();
    return db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id) as total_dms,
      (SELECT COUNT(*) FROM dm_logs WHERE campaign_id = c.id AND status = 'sent') as sent_dms
    FROM campaigns c WHERE c.id = ?
  `).get(id);
}

export function createCampaign(data) {
    const db = getDb();
    const stmt = db.prepare(`
    INSERT INTO campaigns (name, ig_media_id, ig_media_url, ig_media_caption, trigger_type, keywords, check_follower, dm_default, dm_follower, dm_non_follower, is_active)
    VALUES (@name, @ig_media_id, @ig_media_url, @ig_media_caption, @trigger_type, @keywords, @check_follower, @dm_default, @dm_follower, @dm_non_follower, @is_active)
  `);
    const result = stmt.run({
        name: data.name,
        ig_media_id: data.ig_media_id || null,
        ig_media_url: data.ig_media_url || null,
        ig_media_caption: data.ig_media_caption || null,
        trigger_type: data.trigger_type || 'all',
        keywords: JSON.stringify(data.keywords || []),
        check_follower: data.check_follower ? 1 : 0,
        dm_default: data.dm_default || '',
        dm_follower: data.dm_follower || '',
        dm_non_follower: data.dm_non_follower || '',
        is_active: data.is_active !== false ? 1 : 0,
    });
    return { id: result.lastInsertRowid, ...data };
}

export function updateCampaign(id, data) {
    const db = getDb();
    const stmt = db.prepare(`
    UPDATE campaigns SET
      name = @name,
      ig_media_id = @ig_media_id,
      ig_media_url = @ig_media_url,
      ig_media_caption = @ig_media_caption,
      trigger_type = @trigger_type,
      keywords = @keywords,
      check_follower = @check_follower,
      dm_default = @dm_default,
      dm_follower = @dm_follower,
      dm_non_follower = @dm_non_follower,
      is_active = @is_active,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);
    stmt.run({
        id,
        name: data.name,
        ig_media_id: data.ig_media_id || null,
        ig_media_url: data.ig_media_url || null,
        ig_media_caption: data.ig_media_caption || null,
        trigger_type: data.trigger_type || 'all',
        keywords: JSON.stringify(data.keywords || []),
        check_follower: data.check_follower ? 1 : 0,
        dm_default: data.dm_default || '',
        dm_follower: data.dm_follower || '',
        dm_non_follower: data.dm_non_follower || '',
        is_active: data.is_active !== false ? 1 : 0,
    });
    return getCampaignById(id);
}

export function deleteCampaign(id) {
    const db = getDb();
    db.prepare('DELETE FROM campaigns WHERE id = ?').run(id);
}

export function toggleCampaign(id, isActive) {
    const db = getDb();
    db.prepare('UPDATE campaigns SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(isActive ? 1 : 0, id);
}

// ============ DM Log Queries ============
export function getDmLogs({ limit = 50, offset = 0, status = null, campaignId = null } = {}) {
    const db = getDb();
    let query = `
    SELECT dl.*, c.name as campaign_name
    FROM dm_logs dl
    LEFT JOIN campaigns c ON dl.campaign_id = c.id
    WHERE 1=1
  `;
    const params = [];

    if (status) {
        query += ' AND dl.status = ?';
        params.push(status);
    }
    if (campaignId) {
        query += ' AND dl.campaign_id = ?';
        params.push(campaignId);
    }

    query += ' ORDER BY dl.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return db.prepare(query).all(...params);
}

export function createDmLog(data) {
    const db = getDb();
    const stmt = db.prepare(`
    INSERT INTO dm_logs (campaign_id, ig_user_id, ig_username, comment_id, comment_text, is_follower, dm_sent, status, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    const result = stmt.run(
        data.campaign_id, data.ig_user_id, data.ig_username,
        data.comment_id, data.comment_text, data.is_follower ? 1 : 0,
        data.dm_sent, data.status || 'sent', data.error_message || null
    );
    return { id: result.lastInsertRowid };
}

// ============ Stats Queries ============
export function getDashboardStats() {
    const db = getDb();

    const today = new Date().toISOString().split('T')[0];

    const todayDms = db.prepare(`
    SELECT COUNT(*) as count FROM dm_logs WHERE date(created_at) = ?
  `).get(today)?.count || 0;

    const todayComments = db.prepare(`
    SELECT COUNT(*) as count FROM dm_logs WHERE date(created_at) = ?
  `).get(today)?.count || 0;

    const activeCampaigns = db.prepare(`
    SELECT COUNT(*) as count FROM campaigns WHERE is_active = 1
  `).get()?.count || 0;

    const totalCampaigns = db.prepare(`
    SELECT COUNT(*) as count FROM campaigns
  `).get()?.count || 0;

    const successRate = db.prepare(`
    SELECT 
      CASE WHEN COUNT(*) > 0 
        THEN ROUND(CAST(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100, 1) 
        ELSE 0 
      END as rate
    FROM dm_logs
  `).get()?.rate || 0;

    return { todayDms, todayComments, activeCampaigns, totalCampaigns, successRate };
}

// ============ Settings Queries ============
export function getSetting(key) {
    const db = getDb();
    return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value || '';
}

export function setSetting(key, value) {
    const db = getDb();
    db.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP
  `).run(key, value, value);
}

// ============ Followers Cache ============
export function isFollower(accountId, igUserId) {
    const db = getDb();
    const row = db.prepare(`
    SELECT id FROM followers_cache WHERE account_id = ? AND ig_user_id = ?
  `).get(accountId, igUserId);
    return !!row;
}

export function cacheFollowers(accountId, followers) {
    const db = getDb();
    const insert = db.prepare(`
    INSERT OR REPLACE INTO followers_cache (account_id, ig_user_id, ig_username, cached_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
  `);
    const insertMany = db.transaction((followers) => {
        for (const f of followers) {
            insert.run(accountId, f.id, f.username);
        }
    });
    insertMany(followers);
}
