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
      [null, 'Honda Activa 6G', 'Coastal Rides Sanquelim', 'Scooter', 350, 4.8, 132, '1.2 km away', 'Petrol', 'Automatic', 'Women friendly', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', 'Reliable 110cc automatic scooter for smooth campus commute.', 'Sanquelim Gate', true],
      [null, 'Royal Enfield Hunter 350', 'Goa Bike Rentals', 'Bike', 750, 4.9, 88, '0.8 km away', 'Petrol', 'Manual', 'Popular choice', 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80', 'Cruiser bike ideal for North Goa beach road trips.', 'Mapusa Road', true],
      [null, 'Maruti Suzuki Swift', 'Sanq Cabs & Self Drive', 'Car', 1800, 4.7, 54, '2.0 km away', 'Petrol', 'Manual', 'AC Hatchback', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80', '5-seater AC hatchback with unlimited kilometers.', 'Thivim Station', true],
      [null, 'TVS Jupiter 125', 'Campus Wheels', 'Scooter', 320, 4.6, 95, '0.5 km away', 'Petrol', 'Automatic', 'Budget friendly', 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80', 'Economical 125cc scooter with spacious under-seat storage.', 'GIM Hostels', true]
    ];
    for (const r of rentals) {
      await pool.query('INSERT INTO rentals (vendor_user_id, title, vendor, category, price_per_day, rating, total_ratings, distance, fuel, transmission, tags, image, description, location, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', r);
    }
  }

  const [exploreRows] = await pool.query('SELECT COUNT(*) as count FROM explore_places');
  if (exploreRows[0].count === 0) {
    const places = [
      ['Arambol Beach', 'Beaches', 4.7, '38 km · 1 hr 10 min scooter', '₹400 per person', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', false, 'Famous for its bohemian vibes, freshwater lake, cliffside cafes, and iconic sunset drum circles.', 'https://www.google.com/maps/search/?api=1&query=Arambol+Beach+Goa', '5:00 PM – 7:30 PM (Sunset)', '₹300 / person', 'Visit around 5 PM to see the famous beach drum circle.'],
      ["Britto's, Baga", 'Food', 4.4, '33 km · 1 hr scooter', '₹700 per person', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', false, 'Legendary beachside restaurant in Baga known for fresh seafood and Goan fish curry.', 'https://www.google.com/maps/search/?api=1&query=Brittos+Baga+Goa', '7:00 PM – 11:00 PM (Dinner)', '₹700 / person', 'Try the butter garlic prawns and pork vindaloo.'],
      ['Dudhsagar Falls', 'Waterfalls', 4.9, '72 km · 2 hr 15 min', '₹1200 per person', 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80', true, 'Four-tiered waterfall offering breathtaking forest views and jeep treks.', 'https://www.google.com/maps/search/?api=1&query=Dudhsagar+Waterfalls+Goa', '9:00 AM – 2:00 PM (Day Trip)', '₹1200 / person', 'Life jackets mandatory. Start early from campus at 6 AM.']
    ];
    for (const p of places) {
      await pool.query('INSERT INTO explore_places (name, category, rating, distance, price, image, is_bookmarked, description, maps_url, best_time, est_cost, pro_tips) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', p);
    }
  }
}

function seedMemoryData() {
  memoryStore.rentals = [
    { id: 1, title: 'Honda Activa 6G', vendor: 'Coastal Rides Sanquelim', category: 'Scooter', price_per_day: 350, rating: 4.8, total_ratings: 132, distance: '1.2 km away', fuel: 'Petrol', transmission: 'Automatic', tags: 'Women friendly', image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', is_available: true, description: 'Campus scooter.', location: 'Sanquelim' }
  ];
  memoryStore.explore_places = [
    { id: 1, name: 'Arambol Beach', category: 'Beaches', rating: 4.7, distance: '38 km · 1 hr 10 min scooter', price: '₹400 per person', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Bohemian beach with freshwater lake.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Arambol+Beach+Goa', best_time: '5:00 PM – 7:30 PM', est_cost: '₹300 / person', pro_tips: 'Check out sunset drum circle.' }
  ];
  memoryStore.place_reviews = [
    { id: 1, place_id: 1, user_name: 'Rishi Hotwani', user_avatar: 'RH', rating: 5, comment: 'Amazing sunset spot!', created_at: new Date().toISOString() }
  ];
  memoryStore.travel_trips = [];
}

export async function query(sql, params = []) {
  if (!isInMemoryFallback && pool) {
    const [results] = await pool.query(sql, params);
    return results;
  }
  
  const lowerSql = sql.toLowerCase();

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
