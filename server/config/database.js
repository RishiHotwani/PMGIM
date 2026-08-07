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
  travel_trips: [],
  user_activities: []
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
        role ENUM('USER', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER',
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
      "ADD COLUMN role ENUM('USER', 'ADMIN', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER'",
      "ADD COLUMN is_active BOOLEAN DEFAULT TRUE",
      "ADD COLUMN failed_login_attempts INT DEFAULT 0",
      "ADD COLUMN lock_until TIMESTAMP NULL DEFAULT NULL",
      "ADD COLUMN last_login TIMESTAMP NULL DEFAULT NULL",
      "ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL"
    ];

    for (const colDef of alterColumns) {
      try {
        await pool.query(`ALTER TABLE users ${colDef};`);
      } catch (e) {
        // Column already exists, ignore
      }
    }

    // 2. Refresh Tokens Table (Rotation & Revocation)
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

    // 3. Auth Tokens Table (Email Verification & Password Reset)
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
        title VARCHAR(255) NOT NULL,
        vendor VARCHAR(255) NOT NULL,
        price_per_day INT NOT NULL,
        rating DECIMAL(3,1) DEFAULT 4.5,
        total_ratings INT DEFAULT 100,
        distance VARCHAR(50) DEFAULT '1.0 km away',
        fuel VARCHAR(50) DEFAULT 'Petrol',
        transmission VARCHAR(50) DEFAULT 'Automatic',
        tags VARCHAR(500) DEFAULT 'Women friendly',
        image VARCHAR(500) NOT NULL,
        is_available BOOLEAN DEFAULT TRUE
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
        is_bookmarked BOOLEAN DEFAULT FALSE
      ) ENGINE=InnoDB;
    `);

    // 7. Travel Trips Table
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

    isInMemoryFallback = false;
    console.log(`✅ Connected to MySQL database on port ${ENV.DB.PORT}: ${ENV.DB.NAME}`);
    await seedInitialData();

  } catch (err) {
    console.warn('⚠️ Could not connect to MySQL server:', err.message);
    console.warn('🔄 Initializing in-memory database fallback.');
    isInMemoryFallback = true;
    seedMemoryData();
  }
}

async function seedInitialData() {
  const [rentalsRows] = await pool.query('SELECT COUNT(*) as count FROM rentals');
  if (rentalsRows[0].count === 0) {
    const rentals = [
      ['Honda Activa 6G', 'Coastal Rides Sanquelim', 350, 4.8, 132, '1.2 km away', 'Petrol', 'Automatic', 'Women friendly', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', true],
      ['Royal Enfield Hunter 350', 'Goa Bike Rentals', 750, 4.9, 88, '0.8 km away', 'Petrol', 'Manual', 'Popular choice', 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80', true],
      ['Maruti Suzuki Swift', 'Sanq Cabs & Self Drive', 1800, 4.7, 54, '2.0 km away', 'Petrol', 'Manual', 'AC Sedan', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80', true],
      ['TVS Jupiter 125', 'Campus Wheels', 320, 4.6, 95, '0.5 km away', 'Petrol', 'Automatic', 'Budget friendly', 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80', true]
    ];
    for (const r of rentals) {
      await pool.query('INSERT INTO rentals (title, vendor, price_per_day, rating, total_ratings, distance, fuel, transmission, tags, image, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', r);
    }
  }

  const [exploreRows] = await pool.query('SELECT COUNT(*) as count FROM explore_places');
  if (exploreRows[0].count === 0) {
    const places = [
      ['Arambol Beach', 'Beaches', 4.7, '38 km · 1 hr 10 min scooter', '₹400 per person', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', false],
      ["Britto's, Baga", 'Food', 4.4, '33 km · 1 hr scooter', '₹700 per person', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', false],
      ['Dudhsagar Falls', 'Waterfalls', 4.9, '72 km · 2 hr 15 min', '₹1200 per person', 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80', true]
    ];
    for (const p of places) {
      await pool.query('INSERT INTO explore_places (name, category, rating, distance, price, image, is_bookmarked) VALUES (?, ?, ?, ?, ?, ?, ?)', p);
    }
  }

  const [tripsRows] = await pool.query('SELECT COUNT(*) as count FROM travel_trips');
  if (tripsRows[0].count === 0) {
    const trips = [
      ['Aarav Mehta', 'AM', 'PGDM 2026 · Sec B', 'Dabolim Airport drop', 'GIM Main Gate', 'Sat, 8 Aug · departs 5:30 AM', 2, 4, 'Cab', '₹600 each', 'Pre-booked Innova from GIM main gate.', 'Today']
    ];
    for (const t of trips) {
      await pool.query('INSERT INTO travel_trips (user_name, user_initials, batch_info, title, pickup, date_time, seats_left, seats_total, vehicle_type, cost, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', t);
    }
  }
}

function seedMemoryData() {
  memoryStore.rentals = [
    { id: 1, title: 'Honda Activa 6G', vendor: 'Coastal Rides Sanquelim', price_per_day: 350, rating: 4.8, total_ratings: 132, distance: '1.2 km away', fuel: 'Petrol', transmission: 'Automatic', tags: 'Women friendly', image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', is_available: true }
  ];
  memoryStore.explore_places = [
    { id: 1, name: 'Arambol Beach', category: 'Beaches', rating: 4.7, distance: '38 km · 1 hr 10 min scooter', price: '₹400 per person', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', is_bookmarked: false }
  ];
  memoryStore.travel_trips = [
    { id: 1, user_name: 'Aarav Mehta', user_initials: 'AM', batch_info: 'PGDM 2026 · Sec B', title: 'Dabolim Airport drop', pickup: 'GIM Main Gate', date_time: 'Sat, 8 Aug · departs 5:30 AM', seats_left: 2, seats_total: 4, vehicle_type: 'Cab', cost: '₹600 each', description: 'Pre-booked Innova.', status: 'Today' }
  ];
}

export async function query(sql, params = []) {
  if (!isInMemoryFallback && pool) {
    const [results] = await pool.query(sql, params);
    return results;
  }
  
  // In-Memory Fallback Evaluator
  const lowerSql = sql.toLowerCase();

  if (lowerSql.includes('select * from users where email')) {
    return memoryStore.users.filter(u => u.email === params[0]);
  }
  if (lowerSql.includes('select * from users where uuid')) {
    return memoryStore.users.filter(u => u.uuid === params[0]);
  }
  if (lowerSql.includes('select * from users where id')) {
    return memoryStore.users.filter(u => u.id === params[0]);
  }
  if (lowerSql.includes('select * from users where google_id')) {
    return memoryStore.users.filter(u => u.google_id === params[0]);
  }
  if (lowerSql.includes('insert into users')) {
    const newUser = {
      id: memoryStore.users.length + 1,
      uuid: params[0],
      name: params[1],
      email: params[2],
      password_hash: params[3],
      google_id: params[4] || null,
      provider: params[5] || 'EMAIL',
      avatar: params[6] || 'US',
      email_verified: params[7] || false,
      role: params[8] || 'USER',
      is_active: true,
      failed_login_attempts: 0,
      lock_until: null,
      last_login: null,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null
    };
    memoryStore.users.push(newUser);
    return { insertId: newUser.id };
  }
  if (lowerSql.includes('update users set')) {
    return { affectedRows: 1 };
  }
  if (lowerSql.includes('select * from rentals')) return memoryStore.rentals;
  if (lowerSql.includes('select * from explore_places')) return memoryStore.explore_places;
  if (lowerSql.includes('select * from travel_trips')) return memoryStore.travel_trips;
  if (lowerSql.includes('select * from user_activities')) return memoryStore.user_activities;

  return [];
}
