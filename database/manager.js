const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'bot_database.db');
const playersJsonPath = path.join(__dirname, '../website/public/players.json');
const queueJsonPath = path.join(__dirname, '../website/public/queue.json');

const config = require('../utils/config');
const GIST_ID = '62dcff9fb06d470d2b7bf5c1bdc63cf2';
const GITHUB_TOKEN = config.GITHUB_TOKEN;

const saveJson = () => {
    try {
        const users = db.prepare("SELECT * FROM users").all();
        const playerTiers = db.prepare("SELECT * FROM player_tiers").all();

        if (users.length === 0 && fs.existsSync(playersJsonPath)) {
            console.warn('⚠️  Database is currently empty. Aborting Gist sync to prevent clearing live data. (Use /admin-sync if this is intentional)');
            return;
        }

        const exportTiers = users.map(user => ({
            ...user,
            tiers: playerTiers.filter(t => t.user_id === user.user_id)
        }));
        
        const queue = db.prepare(`
            SELECT q.user_id, q.category, q.join_time, u.minecraft_ign 
            FROM queue q
            LEFT JOIN users u ON q.user_id = u.user_id
            ORDER BY q.join_time ASC
        `).all();
        const isOpen = db.prepare("SELECT value FROM settings WHERE key = 'queue_open'").get()?.value === 'true';
        
        const playersContent = JSON.stringify(exportTiers, null, 4);
        const queueContent = JSON.stringify({ queue, isOpen }, null, 4);

        // Save locally just in case
        fs.writeFileSync(playersJsonPath, playersContent);
        fs.writeFileSync(queueJsonPath, queueContent);

        // SYNC TO GITHUB (HTTPS Bridge)
        const https = require('https');
        const data = JSON.stringify({
            files: {
                "players.json": { content: playersContent },
                "queue.json": { content: queueContent }
            }
        });

        const req = https.request({
            hostname: 'api.github.com',
            port: 443,
            path: `/gists/${GIST_ID}`,
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'User-Agent': 'NodeJS',
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        });
        
        req.on('response', (res) => {
            if (res.statusCode === 200) {
                console.log('✅ Gist successfully synced to GitHub.');
            } else {
                console.error(`❌ Gist Sync Failed: ${res.statusCode} ${res.statusMessage}`);
            }
        });
        
        req.on('error', (e) => console.error('❌ Gist Network Error:', e));
        req.write(data);
        req.end();

    } catch (e) {
        console.error('❌ Failed to export JSON files:', e);
    }
};

let db;
try {
    db = new Database(dbPath);
    console.log(`✅ Database initialized at: ${dbPath}`);

    // Migration: Add columns if they don't exist
    try {
        db.prepare("ALTER TABLE users ADD COLUMN account_type TEXT DEFAULT 'Premium'").run();
    } catch (e) { /* already exists */ }
    try {
        db.prepare("ALTER TABLE users ADD COLUMN last_waitlist_timestamp INTEGER DEFAULT 0").run();
    } catch (e) { /* already exists */ }
} catch (error) {
    console.error(`❌ Failed to initialize database:`, error);
    process.exit(1);
}

// Initialize Database
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        minecraft_ign TEXT,
        region TEXT DEFAULT 'Global',
        account_type TEXT DEFAULT 'Premium',
        last_waitlist_timestamp INTEGER DEFAULT 0,
        total_points INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS player_tiers (
        user_id TEXT,
        category TEXT,
        tier TEXT,
        timestamp INTEGER,
        PRIMARY KEY (user_id, category)
    );
    
    CREATE TABLE IF NOT EXISTS queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE,
        category TEXT,
        join_time INTEGER,
        status TEXT DEFAULT 'waiting'
    );
    
    CREATE TABLE IF NOT EXISTS requests (
        request_id TEXT PRIMARY KEY,
        user_id TEXT,
        type TEXT,
        ign TEXT,
        category TEXT,
        region TEXT,
        proof_url TEXT,
        status TEXT DEFAULT 'pending',
        timestamp INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    
    CREATE TABLE IF NOT EXISTS test_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tester_id TEXT,
        player_id TEXT,
        ign TEXT,
        category TEXT,
        tier TEXT,
        timestamp INTEGER
    );
`);

// Initialize default settings
const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
insertSetting.run('queue_open', 'false');

module.exports = {
    isQueueOpen: () => {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'queue_open'").get();
        return row ? row.value === 'true' : false;
    },
    setQueueStatus: (status) => {
        db.prepare("UPDATE settings SET value = ? WHERE key = 'queue_open'").run(status ? 'true' : 'false');
        saveJson();
    },
    addToQueue: (userId, category, joinTime) => {
        try {
            db.prepare("INSERT INTO queue (user_id, category, join_time) VALUES (?, ?, ?)").run(userId, category, joinTime);
            saveJson();
            return true;
        } catch (e) {
            return false;
        }
    },
    removeFromQueue: (userId) => {
        db.prepare("DELETE FROM queue WHERE user_id = ?").run(userId);
        saveJson();
    },
    clearQueueCategory: (category) => {
        db.prepare("DELETE FROM queue WHERE UPPER(category) = UPPER(?)").run(category);
        saveJson();
    },
    getQueue: () => {
        return db.prepare(`
            SELECT q.user_id, q.category, q.join_time, u.minecraft_ign 
            FROM queue q
            LEFT JOIN users u ON q.user_id = u.user_id
            ORDER BY q.join_time ASC
        `).all();
    },
    getQueuePosition: (userId) => {
        const queue = db.prepare("SELECT user_id FROM queue ORDER BY join_time ASC").all();
        const index = queue.findIndex(q => q.user_id === userId);
        return index !== -1 ? index + 1 : null;
    },
    getSetting: (key) => {
        const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
        return row ? row.value : null;
    },
    updateSetting: (key, value) => {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, value.toString());
    },
    getResultChannels: () => {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'results_channels'").get();
        return row ? JSON.parse(row.value) : [];
    },
    addResultChannel: (channelId) => {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'results_channels'").get();
        let channels = row ? JSON.parse(row.value) : [];
        if (!channels.includes(channelId)) {
            channels.push(channelId);
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('results_channels', ?)").run(JSON.stringify(channels));
            return true;
        }
        return false;
    },
    removeResultChannel: (channelId) => {
        const row = db.prepare("SELECT value FROM settings WHERE key = 'results_channels'").get();
        if (!row) return false;
        let channels = JSON.parse(row.value);
        if (channels.includes(channelId)) {
            channels = channels.filter(id => id !== channelId);
            db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('results_channels', ?)").run(JSON.stringify(channels));
            return true;
        }
        return false;
    },
    updateUserTier: (userId, ign, tier, category, region = 'Global', doSave = true) => {
        // 1. Update/Insert User
        db.prepare(`
            INSERT INTO users (user_id, minecraft_ign, region)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                minecraft_ign = excluded.minecraft_ign,
                region = excluded.region
        `).run(userId, ign, region);

        // 2. Insert/Update Tier for specific kit
        db.prepare(`
            INSERT INTO player_tiers (user_id, category, tier, timestamp)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id, category) DO UPDATE SET
                tier = excluded.tier,
                timestamp = excluded.timestamp
        `).run(userId, category, tier, Date.now());
        if (doSave) saveJson();
    },
    getUser: (userId) => {
        return db.prepare("SELECT * FROM users WHERE user_id = ?").get(userId);
    },
    updateRegistration: (userId, ign, region, accountType) => {
        db.prepare(`
            INSERT INTO users (user_id, minecraft_ign, region, account_type)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                minecraft_ign = excluded.minecraft_ign,
                region = excluded.region,
                account_type = excluded.account_type
        `).run(userId, ign, region, accountType);
        saveJson();
    },
    updateWaitlistTimestamp: (userId) => {
        db.prepare("UPDATE users SET last_waitlist_timestamp = ? WHERE user_id = ?").run(Date.now(), userId);
    },
    setWaitlistChannel: (kit, channelId) => {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(`waitlist_channel_${kit.toLowerCase()}`, channelId);
    },
    getWaitlistChannel: (kit) => {
        const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(`waitlist_channel_${kit.toLowerCase()}`);
        return row ? row.value : null;
    },
    setWaitlistRole: (kit, roleId) => {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(`waitlist_role_${kit.toLowerCase()}`, roleId);
    },
    getWaitlistRole: (kit) => {
        const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(`waitlist_role_${kit.toLowerCase()}`);
        return row ? row.value : null;
    },
    getAllTiers: () => {
        const users = db.prepare("SELECT * FROM users").all();
        const tiers = db.prepare("SELECT * FROM player_tiers").all();

        // Group tiers by user
        return users.map(user => {
            return {
                ...user,
                tiers: tiers.filter(t => t.user_id === user.user_id)
            };
        });
    },
    getAllUsers: () => {
        return db.prepare("SELECT * FROM users").all();
    },
    getUserTiers: (userId) => {
        const user = db.prepare("SELECT * FROM users WHERE user_id = ?").get(userId);
        if (!user) return null;
        const tiers = db.prepare("SELECT * FROM player_tiers WHERE user_id = ?").all(userId);
        return { ...user, tiers };
    },
    removeUserTier: (userId, category) => {
        const result = db.prepare("DELETE FROM player_tiers WHERE user_id = ? AND LOWER(category) = LOWER(?)").run(userId, category);
        // If the user has no tiers left, remove them from users table too
        const remaining = db.prepare("SELECT COUNT(*) as c FROM player_tiers WHERE user_id = ?").get(userId);
        if (remaining.c === 0) {
            db.prepare("DELETE FROM users WHERE user_id = ?").run(userId);
        }
        saveJson();
        return result.changes > 0;
    },
    logTest: (testerId, playerId, ign, category, tier, timestamp = null) => {
        db.prepare(`
            INSERT INTO test_logs (tester_id, player_id, ign, category, tier, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(testerId, playerId, ign, category, tier, timestamp || Date.now());
    },
    getTesterStats: (testerId) => {
        return db.prepare("SELECT COUNT(*) as count FROM test_logs WHERE tester_id = ?").get(testerId);
    },
    getTesterLeaderboard: () => {
        return db.prepare(`
            SELECT tester_id, COUNT(*) as test_count 
            FROM test_logs 
            GROUP BY tester_id 
            ORDER BY test_count DESC 
            LIMIT 10
        `).all();
    },
    saveJson: saveJson
};
