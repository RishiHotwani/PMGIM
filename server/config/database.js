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
      connectionLimit: 20,
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
    await seedInitialData();

  } catch (err) {
    console.warn('⚠️ Could not connect to MySQL server:', err.message);
    console.warn('🔄 Initializing in-memory database fallback.');
    isInMemoryFallback = true;
    seedMemoryData();
  }
}

async function seedInitialData() {
  try {
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
        ['Mandrem Beach & Lagoon (Vaayu)', 'Beaches', 4.9, '36 km · 55 min scooter', '₹450 per person', 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80', false, 'Beautiful, serene beach & Mandrem lagoon featured in Londoner In Sydney. Great for SUP paddle boarding and organic cafes at Vaayu Vision Collective.', 'https://www.google.com/maps/search/?api=1&query=Mandrem+Beach+Vaayu+Goa', '7:00 AM – 11:00 AM (Breakfast & Water Sports)', '₹450 / person', 'Try the smoothie bowls and rent SUP boards at Vaayu.'],
        ['La Plage Restaurant (Ashwem)', 'Food', 4.9, '34 km · 50 min scooter', '₹1200 per person', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', false, 'Famous French fine dining right on Ashwem Beach highlighted by Londoner In Sydney. World-class food, beach lounge chairs, and fairy lights.', 'https://www.google.com/maps/search/?api=1&query=La+Plage+Ashwem+Beach+Goa', '1:00 PM – 4:00 PM (Lunch)', '₹1200 / person', 'Order the signature beef fillet steak and chocolate thali.'],
        ['Pink Chilli Restaurant (Arpora)', 'Food', 4.8, '31 km · 48 min scooter', '₹700 per person', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', false, 'Stunning North Indian restaurant with vibrant bohemian decor, cozy outdoor huts, and signature cocktails recommended by Londoner In Sydney.', 'https://www.google.com/maps/search/?api=1&query=Pink+Chilli+Restaurant+Goa', '7:30 PM – 11:00 PM (Dinner)', '₹700 / person', 'Perfect for group dinners and Instagram photos.'],
        ['Anjuna Flea Market & Shacks', 'Shopping', 4.7, '32 km · 50 min scooter', '₹500 per person', 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80', false, 'Iconic Wednesday flea market in Anjuna with bohemian clothes, silver jewelry, handmade artifacts, and beachside acoustic shacks.', 'https://www.google.com/maps/search/?api=1&query=Anjuna+Flea+Market+Goa', 'Wednesdays 10:00 AM – 6:00 PM', '₹500 / person', 'Bargain hard for vintage lamps, jewelry, and handmade tapestries.'],
        ['Thalassa Greek Restaurant (Siolim)', 'Food', 4.9, '30 km · 50 min scooter', '₹1500 per person', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80', false, 'Santorini-style cliffside Greek restaurant overlooking the Chapora River sunset. Celebrated by Londoner In Sydney for plate-breaking dance shows.', 'https://www.google.com/maps/search/?api=1&query=Thalassa+Restaurant+Siolim+Goa', '5:00 PM – 8:30 PM (Sunset)', '₹1500 / person', 'Book sunset tables 3 days in advance!'],
        ['Arambol Beach Sunset Drum Circle', 'Nightlife', 4.8, '38 km · 1 hr 10 min scooter', '₹300 per person', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', false, 'Bohemian sunset gatherings, percussion drum circles, freshwater lake, and cliffside sunset views at Arambol.', 'https://www.google.com/maps/search/?api=1&query=Arambol+Beach+Goa', '5:00 PM – 8:00 PM (Sunset)', '₹300 / person', 'Walk past the rocks to the sweet water lake.'],
        ["Britto's Beach Shack (Baga)", 'Nightlife', 4.5, '33 km · 1 hr scooter', '₹700 per person', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', false, 'Legendary Baga beach shack featuring fresh seafood platters, live music, and beachfront candle-lit tables.', 'https://www.google.com/maps/search/?api=1&query=Brittos+Baga+Goa', '8:00 PM – 11:30 PM (Dinner & Drinks)', '₹700 / person', 'Try the butter garlic crab and Goan pork sorpotel.'],
        ['Dudhsagar Waterfalls Trek', 'Waterfalls', 4.9, '72 km · 2 hr 15 min', '₹1200 per person', 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80', false, 'Majestic 4-tiered waterfall in Bhagwan Mahavir Wildlife Sanctuary with forest jeep safaris and natural swimming pools.', 'https://www.google.com/maps/search/?api=1&query=Dudhsagar+Waterfalls+Goa', '8:30 AM – 2:30 PM (Day Trip)', '₹1200 / person', 'Mandatory life jackets provided at jeep counter.'],
        ['Fontainhas Latin Quarter', 'Cafes', 4.8, '28 km · 45 min scooter', '₹400 per person', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80', false, 'UNESCO heritage Portuguese quarter in Panjim with pastel yellow/blue villas, art galleries, and historic bakeries.', 'https://www.google.com/maps/search/?api=1&query=Fontainhas+Panjim+Goa', '9:00 AM – 12:00 PM (Morning Walk)', '₹400 / person', 'Visit Confeitaria 31 De Janeiro for fresh Bebinca.'],
        ['Querim (Keri) Peace Beach', 'Beaches', 4.8, '42 km · 1 hr 15 min scooter', '₹300 per person', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', false, 'Goa’s northernmost secluded beach lined with pine trees, river estuary, and Fort Tiracol views.', 'https://www.google.com/maps/search/?api=1&query=Querim+Keri+Beach+Goa', '4:00 PM – 6:30 PM (Sunset)', '₹300 / person', 'Take the free river ferry across to Fort Tiracol.']
      ];
      for (const p of places) {
        await pool.query('INSERT INTO explore_places (name, category, rating, distance, price, image, is_bookmarked, description, maps_url, best_time, est_cost, pro_tips) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', p);
      }
    }

    const [tripsRows] = await pool.query('SELECT COUNT(*) as count FROM travel_trips');
    if (tripsRows[0].count === 0) {
      const trips = [
        ['Rahul Verma', 'RV', 'PGDM 2026', 'Airport Share (Goa MOPA to GIM Campus)', 'MOPA Airport Terminal', 'Today 6:00 PM', 2, 4, 'Cab', '₹450 each', 'Flight arrives 5:30 PM. 2 seats free for GIM students.', 'Today']
      ];
      for (const t of trips) {
        await pool.query('INSERT INTO travel_trips (user_name, user_initials, batch_info, title, pickup, date_time, seats_left, seats_total, vehicle_type, cost, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', t);
      }
    }
  } catch (err) {
    console.error('Seed error:', err);
  }
}

function seedMemoryData() {
  memoryStore.rentals = [
    { id: 1, title: 'Honda Activa 6G', vendor: 'Coastal Rides Sanquelim', category: 'Scooter', price_per_day: 350, rating: 4.8, total_ratings: 132, distance: '1.2 km away', fuel: 'Petrol', transmission: 'Automatic', tags: 'Women friendly', image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', is_available: true, description: 'Campus scooter.', location: 'Sanquelim' },
    { id: 2, title: 'Royal Enfield Hunter 350', vendor: 'Goa Bike Rentals', category: 'Bike', price_per_day: 750, rating: 4.9, total_ratings: 88, distance: '0.8 km away', fuel: 'Petrol', transmission: 'Manual', tags: 'Popular choice', image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80', is_available: true, description: 'Cruiser bike.', location: 'Mapusa' },
    { id: 3, title: 'Maruti Suzuki Swift', vendor: 'Sanq Cabs & Self Drive', category: 'Car', price_per_day: 1800, rating: 4.7, total_ratings: 54, distance: '2.0 km away', fuel: 'Petrol', transmission: 'Manual', tags: 'AC Hatchback', image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80', is_available: true, description: '5-seater AC hatchback.', location: 'Thivim' }
  ];
  memoryStore.explore_places = [
    { id: 1, name: 'Mandrem Beach & Lagoon (Vaayu)', category: 'Beaches', rating: 4.9, distance: '36 km · 55 min scooter', price: '₹450 per person', image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Beautiful beach & Mandrem lagoon.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Mandrem+Beach+Vaayu+Goa', best_time: '7:00 AM – 11:00 AM', est_cost: '₹450 / person', pro_tips: 'Smoothie bowls & SUP boards at Vaayu.' },
    { id: 2, name: 'La Plage Restaurant (Ashwem)', category: 'Food', rating: 4.9, distance: '34 km · 50 min scooter', price: '₹1200 per person', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'French fine dining on Ashwem Beach.', maps_url: 'https://www.google.com/maps/search/?api=1&query=La+Plage+Ashwem+Beach+Goa', best_time: '1:00 PM – 4:00 PM', est_cost: '₹1200 / person', pro_tips: 'Try the beef fillet steak.' }
  ];
  memoryStore.place_reviews = [
    { id: 1, place_id: 1, user_name: 'Rishi Hotwani', user_avatar: 'RH', rating: 5, comment: 'Amazing sunset spot!', created_at: new Date().toISOString() }
  ];
  memoryStore.travel_trips = [
    { id: 1, user_name: 'Rahul Verma', user_initials: 'RV', batch_info: 'PGDM 2026', title: 'Airport Share (Goa MOPA to GIM Campus)', pickup: 'MOPA Airport Terminal', date_time: 'Today 6:00 PM', seats_left: 2, seats_total: 4, vehicle_type: 'Cab', cost: '₹450 each', description: 'Flight arrives 5:30 PM. 2 seats free for GIM students.', status: 'Today' }
  ];
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
  if (lowerSql.includes('select ep.*')) {
    const uid = params[0];
    const bookmarkedSet = new Set(memoryStore.user_bookmarks.filter(b => b.user_id === uid).map(b => b.place_id));
    return memoryStore.explore_places.map(p => ({
      ...p,
      is_bookmarked: uid ? bookmarkedSet.has(p.id) : false
    }));
  }
  if (lowerSql.includes('select * from explore_places')) {
    return memoryStore.explore_places.map(p => ({ ...p, is_bookmarked: false }));
  }
  if (lowerSql.includes('select * from rentals')) return memoryStore.rentals;
  if (lowerSql.includes('select * from travel_trips')) return memoryStore.travel_trips;

  return [];
}
