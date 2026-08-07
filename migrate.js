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

    // Create rental_bookings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS rental_bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rental_id INT NOT NULL,
        user_id INT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        user_phone VARCHAR(50) NOT NULL,
        vendor_user_id INT NULL,
        vehicle_title VARCHAR(255) NOT NULL,
        days INT DEFAULT 1,
        start_date VARCHAR(50) NOT NULL,
        daily_rate DECIMAL(10,2) NOT NULL,
        deposit DECIMAL(10,2) DEFAULT 0.00,
        service_fee DECIMAL(10,2) DEFAULT 0.00,
        gst_amount DECIMAL(10,2) DEFAULT 0.00,
        total_amount DECIMAL(10,2) NOT NULL,
        razorpay_order_id VARCHAR(255) NULL,
        razorpay_payment_id VARCHAR(255) NULL,
        razorpay_signature VARCHAR(255) NULL,
        status ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED') DEFAULT 'PENDING',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_rental_id (rental_id)
      ) ENGINE=InnoDB;
    `);

    console.log('Successfully created rental_bookings table');

    await conn.end();
    console.log('✅ Rental bookings migration complete!');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

migrate();
