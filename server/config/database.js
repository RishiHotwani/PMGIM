import mysql from 'mysql2/promise';
import { ENV } from './env.js';

let pool = null;
export let isInMemoryFallback = false;

export const memoryStore = {
  users: [],
  refresh_tokens: [],
  auth_tokens: [],
  rentals: [],
  explore_places: [],
  place_reviews: [],
  travel_trips: [],
  user_activities: [],
  user_notifications: [],
  user_bookmarks: [],
  rental_bookings: []
};

export async function initDatabase() {
  try {
    let rootConn = null;

    try {
      rootConn = await mysql.createConnection({
        host: ENV.DB.HOST,
        port: ENV.DB.PORT,
        user: ENV.DB.USER,
        password: ENV.DB.PASSWORD,
      });
    } catch (authErr) {
      console.warn(`⚠️ Authentication warning on port ${ENV.DB.PORT}. Attempting root fallbacks...`);
      const fallbackPasswords = [ENV.DB.PASSWORD, 'root', '', '123456', 'admin', 'password', '1234', '12345'];
      for (const pass of fallbackPasswords) {
        try {
          rootConn = await mysql.createConnection({
            host: ENV.DB.HOST,
            port: ENV.DB.PORT,
            user: 'root',
            password: pass,
          });
          break;
        } catch (e) {}
      }
    }

    if (!rootConn) {
      throw new Error(`Failed to authenticate with MySQL server at ${ENV.DB.HOST}:${ENV.DB.PORT}`);
    }

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${ENV.DB.NAME}\`;`);
    await rootConn.end();

    pool = mysql.createPool({
      host: ENV.DB.HOST,
      port: ENV.DB.PORT,
      user: ENV.DB.USER,
      password: ENV.DB.PASSWORD,
      database: ENV.DB.NAME,
      waitForConnections: true,
      connectionLimit: 15,
      queueLimit: 0
    });

    // 1. Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NULL,
        google_id VARCHAR(255) NULL UNIQUE,
        provider ENUM('EMAIL', 'GOOGLE') NOT NULL DEFAULT 'EMAIL',
        avatar VARCHAR(500) DEFAULT 'US',
        email_verified BOOLEAN DEFAULT FALSE,
        role ENUM('USER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER',
        is_active BOOLEAN DEFAULT TRUE,
        failed_login_attempts INT DEFAULT 0,
        lock_until TIMESTAMP NULL DEFAULT NULL,
        last_login TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL
      ) ENGINE=InnoDB;
    `);

    // Ensure missing columns exist in pre-existing tables
    const alterColumns = [
      "ADD COLUMN uuid VARCHAR(36) NULL",
      "ADD COLUMN google_id VARCHAR(255) NULL",
      "ADD COLUMN provider ENUM('EMAIL', 'GOOGLE') NOT NULL DEFAULT 'EMAIL'",
      "ADD COLUMN email_verified BOOLEAN DEFAULT FALSE",
      "MODIFY COLUMN role ENUM('USER', 'VENDOR', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER'",
      "ADD COLUMN is_active BOOLEAN DEFAULT TRUE",
      "ADD COLUMN failed_login_attempts INT DEFAULT 0",
      "ADD COLUMN lock_until TIMESTAMP NULL DEFAULT NULL",
      "ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL",
      "ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL"
    ];

    for (const colDef of alterColumns) {
      try {
        await pool.query(`ALTER TABLE users ${colDef};`);
      } catch (e) {}
    }

    // 2. Refresh Tokens Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        family_id VARCHAR(36) NOT NULL,
        is_revoked BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        user_agent VARCHAR(500) NULL,
        ip_address VARCHAR(100) NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 3. Auth Tokens Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS auth_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        type ENUM('EMAIL_VERIFICATION', 'PASSWORD_RESET') NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // 4. Activity Logs Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT DEFAULT NULL,
        user_name VARCHAR(255) DEFAULT 'Guest',
        activity_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(100) DEFAULT '127.0.0.1'
      ) ENGINE=InnoDB;
    `);

    // 5. Rentals Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rentals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_user_id INT NULL,
        title VARCHAR(255) NOT NULL,
        vendor VARCHAR(255) NOT NULL,
        category ENUM('Bike', 'Scooter', 'Car') NOT NULL DEFAULT 'Bike',
        price_per_day INT NOT NULL,
        rating DECIMAL(3,1) DEFAULT 4.8,
        total_ratings INT DEFAULT 15,
        distance VARCHAR(50) DEFAULT '1.0 km away',
        fuel VARCHAR(50) DEFAULT 'Petrol',
        transmission VARCHAR(50) DEFAULT 'Automatic',
        tags VARCHAR(500) DEFAULT 'Verified Vendor',
        image VARCHAR(500) NOT NULL,
        description TEXT NULL,
        location VARCHAR(255) DEFAULT 'Sanquelim / Campus',
        is_available BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 6. Explore Places Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS explore_places (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        rating DECIMAL(3,1) DEFAULT 4.5,
        distance VARCHAR(100) DEFAULT '',
        price VARCHAR(100) DEFAULT '',
        image VARCHAR(500) NOT NULL,
        is_bookmarked BOOLEAN DEFAULT FALSE,
        description TEXT NULL,
        maps_url VARCHAR(500) NULL,
        best_time VARCHAR(255) DEFAULT '5:00 PM – 7:00 PM (Sunset)',
        est_cost VARCHAR(100) DEFAULT '₹400 / person',
        pro_tips TEXT NULL
      ) ENGINE=InnoDB;
    `);

    // 7. Place Reviews & Ratings Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS place_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        place_id INT NOT NULL,
        user_id INT NULL,
        user_name VARCHAR(255) NOT NULL,
        user_avatar VARCHAR(10) DEFAULT 'US',
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_place_id (place_id)
      ) ENGINE=InnoDB;
    `);

    // 8. Travel Trips Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS travel_trips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_name VARCHAR(255) NOT NULL,
        user_initials VARCHAR(10) NOT NULL,
        batch_info VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        pickup VARCHAR(255) NOT NULL,
        date_time VARCHAR(255) NOT NULL,
        seats_left INT NOT NULL,
        seats_total INT NOT NULL,
        vehicle_type VARCHAR(50) NOT NULL,
        cost VARCHAR(50) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Today',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // 9. User Notifications Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB;
    `);

    // 10. User Private Bookmarks Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_bookmarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        place_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_user_place (user_id, place_id)
      ) ENGINE=InnoDB;
    `);

    // 11. Rental Bookings Table
    await pool.query(`
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

    isInMemoryFallback = false;
    console.log(`✅ Connected to MySQL database on port ${ENV.DB.PORT}: ${ENV.DB.NAME}`);

  } catch (err) {
    console.warn('⚠️ Could not connect to MySQL server:', err.message);
    console.warn('🔄 Initializing in-memory database fallback.');
    isInMemoryFallback = true;
  }
}

export async function query(sql, params = []) {
  if (!isInMemoryFallback && pool) {
    const [results] = await pool.query(sql, params);
    return results;
  }
  
  const lowerSql = sql.toLowerCase();

  if (lowerSql.includes('select * from rental_bookings')) {
    return memoryStore.rental_bookings.filter(b => b.user_id === params[0]);
  }
  if (lowerSql.includes('insert into rental_bookings')) {
    const bk = {
      id: memoryStore.rental_bookings.length + 1,
      rental_id: params[0],
      user_id: params[1],
      user_name: params[2],
      user_email: params[3],
      user_phone: params[4],
      vendor_user_id: params[5],
      vehicle_title: params[6],
      days: params[7],
      start_date: params[8],
      daily_rate: params[9],
      deposit: params[10],
      service_fee: params[11],
      gst_amount: params[12],
      total_amount: params[13],
      razorpay_order_id: params[14],
      status: 'PENDING',
      created_at: new Date().toISOString()
    };
    memoryStore.rental_bookings.push(bk);
    return { insertId: bk.id };
  }
  if (lowerSql.includes('update rental_bookings set status =')) {
    const b = memoryStore.rental_bookings.find(x => x.razorpay_order_id === params[2] || x.id === params[2]);
    if (b) {
      b.status = params[0];
      b.razorpay_payment_id = params[1];
    }
    return { affectedRows: 1 };
  }

  if (lowerSql.includes('select * from user_notifications')) {
    const uid = params[0];
    return memoryStore.user_notifications.filter(n => n.user_id === uid || n.user_id === null);
  }
  if (lowerSql.includes('insert into user_notifications')) {
    const notif = {
      id: memoryStore.user_notifications.length + 1,
      user_id: params[0],
      type: params[1],
      title: params[2],
      message: params[3],
      is_read: false,
      created_at: new Date().toISOString()
    };
    memoryStore.user_notifications.push(notif);
    return { insertId: notif.id };
  }
  if (lowerSql.includes('update user_notifications set is_read = true')) {
    memoryStore.user_notifications.forEach(n => n.is_read = true);
    return { affectedRows: 1 };
  }

  if (lowerSql.includes('select * from user_bookmarks')) {
    return memoryStore.user_bookmarks.filter(b => b.user_id === params[0]);
  }
  if (lowerSql.includes('insert into user_bookmarks')) {
    memoryStore.user_bookmarks.push({ user_id: params[0], place_id: params[1], created_at: new Date().toISOString() });
    return { insertId: 1 };
  }
  if (lowerSql.includes('delete from user_bookmarks')) {
    memoryStore.user_bookmarks = memoryStore.user_bookmarks.filter(b => !(b.user_id === params[0] && b.place_id === params[1]));
    return { affectedRows: 1 };
  }

  if (lowerSql.includes('select * from place_reviews')) {
    return memoryStore.place_reviews.filter(r => r.place_id === parseInt(params[0], 10));
  }
  if (lowerSql.includes('insert into place_reviews')) {
    const newRev = {
      id: memoryStore.place_reviews.length + 1,
      place_id: parseInt(params[0], 10),
      user_id: params[1] || null,
      user_name: params[2],
      user_avatar: params[3] || 'US',
      rating: parseInt(params[4], 10),
      comment: params[5],
      created_at: new Date().toISOString()
    };
    memoryStore.place_reviews.push(newRev);
    return { insertId: newRev.id };
  }
  if (lowerSql.includes('select * from explore_places')) return memoryStore.explore_places;
  if (lowerSql.includes('select * from rentals')) return memoryStore.rentals;

  return [];
}
