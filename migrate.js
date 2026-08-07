import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3308', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'RishiHotwani27';
const DB_NAME = process.env.DB_NAME || 'travelappgim';

async function migrate() {
  try {
    const conn = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME
    });

    console.log(`Migrating MySQL table users on ${DB_HOST}:${DB_PORT} / ${DB_NAME}...`);

    const cols = [
      "ADD COLUMN uuid VARCHAR(36) NULL",
      "ADD COLUMN google_id VARCHAR(255) NULL",
      "ADD COLUMN provider ENUM('EMAIL', 'GOOGLE') NOT NULL DEFAULT 'EMAIL'",
      "ADD COLUMN avatar VARCHAR(500) DEFAULT 'US'",
      "ADD COLUMN email_verified BOOLEAN DEFAULT FALSE",
      "ADD COLUMN role ENUM('USER', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER'",
      "ADD COLUMN is_active BOOLEAN DEFAULT TRUE",
      "ADD COLUMN failed_login_attempts INT DEFAULT 0",
      "ADD COLUMN lock_until TIMESTAMP NULL DEFAULT NULL",
      "ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL",
      "ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL"
    ];

    for (const c of cols) {
      try {
        await conn.query(`ALTER TABLE users ${c};`);
        console.log(`Successfully executed: ALTER TABLE users ${c}`);
      } catch (err) {
        console.log(`Column status (${c.split(' ')[2]}): ${err.message}`);
      }
    }

    await conn.end();
    console.log('✅ Migration complete!');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

migrate();
