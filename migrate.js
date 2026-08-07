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

    console.log(`Migrating MySQL database tables on ${DB_HOST}:${DB_PORT} / ${DB_NAME}...`);

    // 1. Update users role ENUM
    try {
      await conn.query(`ALTER TABLE users MODIFY COLUMN role ENUM('USER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER';`);
      console.log('Successfully updated users role ENUM to include VENDOR');
    } catch (err) {
      console.log('Role ENUM status:', err.message);
    }

    // 2. Update rentals table columns
    const rentalCols = [
      "ADD COLUMN vendor_user_id INT NULL",
      "ADD COLUMN category ENUM('Bike', 'Scooter', 'Car') NOT NULL DEFAULT 'Bike'",
      "ADD COLUMN description TEXT NULL",
      "ADD COLUMN location VARCHAR(255) DEFAULT 'Sanquelim / Campus'",
      "ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    ];

    for (const c of rentalCols) {
      try {
        await conn.query(`ALTER TABLE rentals ${c};`);
        console.log(`Successfully executed: ALTER TABLE rentals ${c}`);
      } catch (err) {
        console.log(`Rentals column status (${c.split(' ')[2]}): ${err.message}`);
      }
    }

    // Classify existing seed rentals
    try {
      await conn.query("UPDATE rentals SET category = 'Scooter' WHERE title LIKE '%Activa%' OR title LIKE '%Jupiter%';");
      await conn.query("UPDATE rentals SET category = 'Bike' WHERE title LIKE '%Enfield%' OR title LIKE '%Bike%';");
      await conn.query("UPDATE rentals SET category = 'Car' WHERE title LIKE '%Swift%' OR title LIKE '%Car%';");
      console.log('Updated rental categories for existing vehicles');
    } catch (err) {}

    await conn.end();
    console.log('✅ Database migration complete!');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

migrate();
