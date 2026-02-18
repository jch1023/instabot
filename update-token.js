const { Pool } = require('pg');

// Usage:
//   NEW_TOKEN="..." DATABASE_URL="..." node update-token.js
// or
//   node update-token.js "<NEW_TOKEN>" "<DATABASE_URL>"
const NEW_TOKEN = process.argv[2] || process.env.NEW_TOKEN;
const DB_URL = process.argv[3] || process.env.DATABASE_URL;

async function updateToken() {
    if (!NEW_TOKEN || !DB_URL) {
        console.error('❌ Missing NEW_TOKEN or DATABASE_URL');
        console.error('   Usage: NEW_TOKEN="..." DATABASE_URL="..." node update-token.js');
        process.exit(1);
    }

    const pool = new Pool({
        connectionString: DB_URL,
    });

    try {
        const client = await pool.connect();
        console.log('Connected to DB! Updating Token...');

        const query = `
            INSERT INTO settings (key, value) 
            VALUES ($1, $2) 
            ON CONFLICT (key) DO UPDATE SET value = $2
        `;

        await client.query(query, ['instagram_access_token', NEW_TOKEN]);
        console.log('✅ Token updated successfully!');

        // 검증
        const res = await client.query("SELECT value FROM settings WHERE key = 'instagram_access_token'");
        console.log('🔍 Verified:', res.rows[0].value.substring(0, 20) + '...');

        client.release();
    } catch (e) {
        console.error('❌ DB Error:', e.message);
        if (e.code === '28P01') {
            console.error('   Hint: Password incorrect or user does not exist.');
        }
    } finally {
        await pool.end();
    }
}

updateToken();
