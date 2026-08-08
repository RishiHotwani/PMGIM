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
  trip_participants: [],
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
      connectionLimit: 25,
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

    // Column updates for Users
    const userAlterations = [
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
    for (const colDef of userAlterations) {
      try { await pool.query(`ALTER TABLE users ${colDef};`); } catch (e) {}
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

    // 4. Rentals Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rentals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vendor_user_id VARCHAR(255) NULL,
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
        status ENUM('ACTIVE', 'MAINTENANCE', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_vendor_user (vendor_user_id),
        INDEX idx_category (category),
        INDEX idx_is_available (is_available),
        INDEX idx_status (status)
      ) ENGINE=InnoDB;
    `);

    const rentalAlterations = [
      "MODIFY COLUMN vendor_user_id VARCHAR(255) NULL",
      "ADD COLUMN status ENUM('ACTIVE', 'MAINTENANCE', 'DELETED') NOT NULL DEFAULT 'ACTIVE'",
      "ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
      "ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL"
    ];
    for (const colDef of rentalAlterations) {
      try { await pool.query(`ALTER TABLE rentals ${colDef};`); } catch (e) {}
    }

    // 5. Rental Bookings Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rental_bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        rental_id INT NOT NULL,
        user_id VARCHAR(255) NULL,
        user_name VARCHAR(255) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        user_phone VARCHAR(50) NOT NULL,
        vendor_user_id VARCHAR(255) NULL,
        vehicle_title VARCHAR(255) NOT NULL,
        start_date VARCHAR(50) NOT NULL,
        end_date VARCHAR(50) NULL,
        number_of_days INT DEFAULT 1,
        daily_rate DECIMAL(10,2) NOT NULL,
        rental_amount DECIMAL(10,2) DEFAULT 0.00,
        security_deposit DECIMAL(10,2) DEFAULT 0.00,
        service_fee DECIMAL(10,2) DEFAULT 0.00,
        gst_amount DECIMAL(10,2) DEFAULT 0.00,
        total_amount DECIMAL(10,2) NOT NULL,
        payment_status ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED') DEFAULT 'PENDING',
        booking_status ENUM('PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING_PAYMENT',
        razorpay_order_id VARCHAR(255) NULL,
        razorpay_payment_id VARCHAR(255) NULL,
        razorpay_signature VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_rental_id (rental_id),
        INDEX idx_vendor_user (vendor_user_id),
        INDEX idx_booking_status (booking_status),
        INDEX idx_payment_status (payment_status)
      ) ENGINE=InnoDB;
    `);

    const bookingAlterations = [
      "MODIFY COLUMN vendor_user_id VARCHAR(255) NULL",
      "MODIFY COLUMN user_id VARCHAR(255) NULL",
      "ADD COLUMN end_date VARCHAR(50) NULL",
      "ADD COLUMN number_of_days INT DEFAULT 1",
      "ADD COLUMN rental_amount DECIMAL(10,2) DEFAULT 0.00",
      "ADD COLUMN payment_status ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED') DEFAULT 'PENDING'",
      "ADD COLUMN booking_status ENUM('PENDING_PAYMENT', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'PENDING_PAYMENT'",
      "ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    ];
    for (const colDef of bookingAlterations) {
      try { await pool.query(`ALTER TABLE rental_bookings ${colDef};`); } catch (e) {}
    }

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
        pro_tips TEXT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    const exploreAlterations = [
      "ADD COLUMN is_active BOOLEAN DEFAULT TRUE",
      "ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    ];
    for (const colDef of exploreAlterations) {
      try { await pool.query(`ALTER TABLE explore_places ${colDef};`); } catch (e) {}
    }

    // 7. User Private Bookmarks Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_bookmarks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        place_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY idx_user_place (user_id, place_id),
        INDEX idx_user (user_id)
      ) ENGINE=InnoDB;
    `);

    const bookmarkAlterations = [
      "MODIFY COLUMN user_id VARCHAR(255) NOT NULL"
    ];
    for (const colDef of bookmarkAlterations) {
      try { await pool.query(`ALTER TABLE user_bookmarks ${colDef};`); } catch (e) {}
    }

    // 8. Place Reviews & Ratings Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS place_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        place_id INT NOT NULL,
        user_id VARCHAR(255) NULL,
        user_name VARCHAR(255) NOT NULL,
        user_avatar VARCHAR(10) DEFAULT 'US',
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT NOT NULL,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_place_id (place_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB;
    `);

    const reviewAlterations = [
      "MODIFY COLUMN user_id VARCHAR(255) NULL",
      "ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE",
      "ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    ];
    for (const colDef of reviewAlterations) {
      try { await pool.query(`ALTER TABLE place_reviews ${colDef};`); } catch (e) {}
    }

    // 9. Travel Trips Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS travel_trips (
        id INT AUTO_INCREMENT PRIMARY KEY,
        host_user_id VARCHAR(255) NULL,
        user_name VARCHAR(255) NOT NULL,
        user_initials VARCHAR(10) NOT NULL,
        batch_info VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        destination VARCHAR(255) NULL,
        pickup VARCHAR(255) NOT NULL,
        date_time VARCHAR(255) NOT NULL,
        departure_date VARCHAR(50) NULL,
        departure_time VARCHAR(50) NULL,
        seats_left INT NOT NULL,
        seats_total INT NOT NULL,
        vehicle_type VARCHAR(50) NOT NULL,
        cost VARCHAR(50) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_destination (destination),
        INDEX idx_status (status),
        INDEX idx_departure_date (departure_date)
      ) ENGINE=InnoDB;
    `);

    const tripAlterations = [
      "ADD COLUMN host_user_id VARCHAR(255) NULL",
      "ADD COLUMN destination VARCHAR(255) NULL",
      "ADD COLUMN departure_date VARCHAR(50) NULL",
      "ADD COLUMN departure_time VARCHAR(50) NULL",
      "ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    ];
    for (const colDef of tripAlterations) {
      try { await pool.query(`ALTER TABLE travel_trips ${colDef};`); } catch (e) {}
    }

    // 10. Trip Participants Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trip_participants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trip_id INT NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        user_name VARCHAR(255) DEFAULT 'Student',
        seats_joined INT DEFAULT 1,
        status ENUM('JOINED', 'LEFT', 'CANCELLED') DEFAULT 'JOINED',
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_trip_user (trip_id, user_id),
        INDEX idx_trip_id (trip_id),
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB;
    `);

    // 11. User Notifications Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        entity_type VARCHAR(100) NULL,
        entity_id VARCHAR(255) NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB;
    `);

    const notifAlterations = [
      "MODIFY COLUMN user_id VARCHAR(255) NULL",
      "ADD COLUMN entity_type VARCHAR(100) NULL",
      "ADD COLUMN entity_id VARCHAR(255) NULL"
    ];
    for (const colDef of notifAlterations) {
      try { await pool.query(`ALTER TABLE user_notifications ${colDef};`); } catch (e) {}
    }

    // 12. User Activities / Product Analytics Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_activities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(255) NULL,
        session_id VARCHAR(255) NULL,
        user_name VARCHAR(255) DEFAULT 'Guest',
        activity_type VARCHAR(100) NOT NULL,
        event_name VARCHAR(100) NULL,
        event_category VARCHAR(100) NULL,
        entity_type VARCHAR(100) NULL,
        entity_id VARCHAR(255) NULL,
        page VARCHAR(255) NULL,
        description TEXT NOT NULL,
        details TEXT,
        metadata JSON NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(100) DEFAULT '127.0.0.1',
        INDEX idx_user (user_id),
        INDEX idx_session (session_id),
        INDEX idx_event (event_name),
        INDEX idx_category (event_category),
        INDEX idx_time (timestamp)
      ) ENGINE=InnoDB;
    `);

    const activityAlterations = [
      "MODIFY COLUMN user_id VARCHAR(255) NULL",
      "ADD COLUMN session_id VARCHAR(255) NULL",
      "ADD COLUMN event_name VARCHAR(100) NULL",
      "ADD COLUMN event_category VARCHAR(100) NULL",
      "ADD COLUMN entity_type VARCHAR(100) NULL",
      "ADD COLUMN entity_id VARCHAR(255) NULL",
      "ADD COLUMN page VARCHAR(255) NULL",
      "ADD COLUMN metadata JSON NULL"
    ];
    for (const colDef of activityAlterations) {
      try { await pool.query(`ALTER TABLE user_activities ${colDef};`); } catch (e) {}
    }

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
        [null, 'Honda Activa 6G', 'Coastal Rides Sanquelim', 'Scooter', 350, 4.8, 132, '1.2 km away', 'Petrol', 'Automatic', 'Women friendly', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', 'Reliable 110cc automatic scooter for smooth campus commute.', 'Sanquelim Gate', true, 'ACTIVE'],
        [null, 'Royal Enfield Hunter 350', 'Goa Bike Rentals', 'Bike', 750, 4.9, 88, '0.8 km away', 'Petrol', 'Manual', 'Popular choice', 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80', 'Cruiser bike ideal for North Goa beach road trips.', 'Mapusa Road', true, 'ACTIVE'],
        [null, 'Maruti Suzuki Swift', 'Sanq Cabs & Self Drive', 'Car', 1800, 4.7, 54, '2.0 km away', 'Petrol', 'Manual', 'AC Hatchback', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80', '5-seater AC hatchback with unlimited kilometers.', 'Thivim Station', true, 'ACTIVE'],
        [null, 'TVS Jupiter 125', 'Campus Wheels', 'Scooter', 320, 4.6, 95, '0.5 km away', 'Petrol', 'Automatic', 'Budget friendly', 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80', 'Economical 125cc scooter with spacious under-seat storage.', 'GIM Hostels', true, 'ACTIVE']
      ];
      for (const r of rentals) {
        await pool.query('INSERT INTO rentals (vendor_user_id, title, vendor, category, price_per_day, rating, total_ratings, distance, fuel, transmission, tags, image, description, location, is_available, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', r);
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
        [null, 'Rahul Verma', 'RV', 'PGDM 2026', 'Airport Share (Goa MOPA to GIM Campus)', 'MOPA Airport Terminal', 'MOPA Airport', 'Today 6:00 PM', '2026-08-08', '18:00', 2, 4, 'Cab', '₹450 each', 'Flight arrives 5:30 PM. 2 seats free for GIM students.', 'ACTIVE']
      ];
      for (const t of trips) {
        await pool.query('INSERT INTO travel_trips (host_user_id, user_name, user_initials, batch_info, title, pickup, destination, date_time, departure_date, departure_time, seats_left, seats_total, vehicle_type, cost, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', t);
      }
    }
  } catch (err) {
    console.error('Seed error:', err);
  }
}

function seedMemoryData() {
  memoryStore.rentals = [
    { id: 1, title: 'Honda Activa 6G', vendor: 'Coastal Rides Sanquelim', category: 'Scooter', price_per_day: 350, rating: 4.8, total_ratings: 132, distance: '1.2 km away', fuel: 'Petrol', transmission: 'Automatic', tags: 'Women friendly', image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', is_available: true, status: 'ACTIVE', description: 'Campus scooter.', location: 'Sanquelim' },
    { id: 2, title: 'Royal Enfield Hunter 350', vendor: 'Goa Bike Rentals', category: 'Bike', price_per_day: 750, rating: 4.9, total_ratings: 88, distance: '0.8 km away', fuel: 'Petrol', transmission: 'Manual', tags: 'Popular choice', image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80', is_available: true, status: 'ACTIVE', description: 'Cruiser bike.', location: 'Mapusa' },
    { id: 3, title: 'Maruti Suzuki Swift', vendor: 'Sanq Cabs & Self Drive', category: 'Car', price_per_day: 1800, rating: 4.7, total_ratings: 54, distance: '2.0 km away', fuel: 'Petrol', transmission: 'Manual', tags: 'AC Hatchback', image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80', is_available: true, status: 'ACTIVE', description: '5-seater AC hatchback.', location: 'Thivim' },
    { id: 4, title: 'TVS Jupiter 125', vendor: 'Campus Wheels', category: 'Scooter', price_per_day: 320, rating: 4.6, total_ratings: 95, distance: '0.5 km away', fuel: 'Petrol', transmission: 'Automatic', tags: 'Budget friendly', image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80', is_available: true, status: 'ACTIVE', description: 'Economical 125cc scooter.', location: 'GIM Hostels' }
  ];

  memoryStore.explore_places = [
    { id: 1, name: 'Mandrem Beach & Lagoon (Vaayu)', category: 'Beaches', rating: 4.9, distance: '36 km · 55 min scooter', price: '₹450 per person', image: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Beautiful beach & Mandrem lagoon.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Mandrem+Beach+Vaayu+Goa', best_time: '7:00 AM – 11:00 AM', est_cost: '₹450 / person', pro_tips: 'Smoothie bowls & SUP boards at Vaayu.' },
    { id: 2, name: 'La Plage Restaurant (Ashwem)', category: 'Food', rating: 4.9, distance: '34 km · 50 min scooter', price: '₹1200 per person', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'French fine dining on Ashwem Beach.', maps_url: 'https://www.google.com/maps/search/?api=1&query=La+Plage+Ashwem+Beach+Goa', best_time: '1:00 PM – 4:00 PM', est_cost: '₹1200 / person', pro_tips: 'Try the beef fillet steak.' },
    { id: 3, name: 'Pink Chilli Restaurant (Arpora)', category: 'Food', rating: 4.8, distance: '31 km · 48 min scooter', price: '₹700 per person', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'North Indian restaurant with bohemian huts.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Pink+Chilli+Restaurant+Goa', best_time: '7:30 PM – 11:00 PM', est_cost: '₹700 / person', pro_tips: 'Instagram photo ops.' },
    { id: 4, name: 'Anjuna Flea Market & Shacks', category: 'Shopping', rating: 4.7, distance: '32 km · 50 min scooter', price: '₹500 per person', image: 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Wednesday flea market in Anjuna.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Anjuna+Flea+Market+Goa', best_time: 'Wednesdays 10:00 AM – 6:00 PM', est_cost: '₹500 / person', pro_tips: 'Bargain hard for silver jewelry.' },
    { id: 5, name: 'Thalassa Greek Restaurant (Siolim)', category: 'Food', rating: 4.9, distance: '30 km · 50 min scooter', price: '₹1500 per person', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Cliffside Greek dining.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Thalassa+Restaurant+Siolim+Goa', best_time: '5:00 PM – 8:30 PM', est_cost: '₹1500 / person', pro_tips: 'Plate-breaking dance shows.' },
    { id: 6, name: 'Arambol Beach Sunset Drum Circle', category: 'Nightlife', rating: 4.8, distance: '38 km · 1 hr 10 min scooter', price: '₹300 per person', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Bohemian drum circles & freshwater lake.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Arambol+Beach+Goa', best_time: '5:00 PM – 8:00 PM', est_cost: '₹300 / person', pro_tips: 'Sunset drum circle.' },
    { id: 7, name: "Britto's Beach Shack (Baga)", category: 'Nightlife', rating: 4.5, distance: '33 km · 1 hr scooter', price: '₹700 per person', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Baga beach shack seafood platters.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Brittos+Baga+Goa', best_time: '8:00 PM – 11:30 PM', est_cost: '₹700 / person', pro_tips: 'Live music & candle-lit tables.' },
    { id: 8, name: 'Dudhsagar Waterfalls Trek', category: 'Waterfalls', rating: 4.9, distance: '72 km · 2 hr 15 min', price: '₹1200 per person', image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: '4-tiered waterfall jeep safari.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Dudhsagar+Waterfalls+Goa', best_time: '8:30 AM – 2:30 PM', est_cost: '₹1200 / person', pro_tips: 'Jeep safaris & natural pools.' },
    { id: 9, name: 'Fontainhas Latin Quarter', category: 'Cafes', rating: 4.8, distance: '28 km · 45 min scooter', price: '₹400 per person', image: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Portuguese villas & historic bakeries.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Fontainhas+Panjim+Goa', best_time: '9:00 AM – 12:00 PM', est_cost: '₹400 / person', pro_tips: 'Confeitaria 31 De Janeiro Bebinca.' },
    { id: 10, name: 'Querim (Keri) Peace Beach', category: 'Beaches', rating: 4.8, distance: '42 km · 1 hr 15 min scooter', price: '₹300 per person', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Northernmost secluded beach & river estuary.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Querim+Keri+Beach+Goa', best_time: '4:00 PM – 6:30 PM', est_cost: '₹300 / person', pro_tips: 'Free river ferry to Fort Tiracol.' }
  ];

  memoryStore.place_reviews = [
    { id: 1, place_id: 1, user_name: 'Rishi Hotwani', user_avatar: 'RH', rating: 5, comment: 'Amazing sunset spot!', created_at: new Date().toISOString() }
  ];
  memoryStore.travel_trips = [
    { id: 1, user_name: 'Rahul Verma', user_initials: 'RV', batch_info: 'PGDM 2026', title: 'Airport Share (Goa MOPA to GIM Campus)', pickup: 'MOPA Airport Terminal', date_time: 'Today 6:00 PM', seats_left: 2, seats_total: 4, vehicle_type: 'Cab', cost: '₹450 each', description: 'Flight arrives 5:30 PM. 2 seats free for GIM students.', status: 'ACTIVE' }
  ];
}

export async function withTransaction(callback) {
  if (isInMemoryFallback || !pool) {
    return callback(null);
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function query(sql, params = []) {
  if (!isInMemoryFallback && pool) {
    const [results] = await pool.query(sql, params);
    return results;
  }
  
  const lowerSql = sql.toLowerCase();

  if (lowerSql.includes('select * from rental_bookings')) {
    return memoryStore.rental_bookings.filter(b => String(b.user_id) === String(params[0]) || String(b.vendor_user_id) === String(params[0]));
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
      booking_status: 'PENDING_PAYMENT',
      payment_status: 'PENDING',
      created_at: new Date().toISOString()
    };
    memoryStore.rental_bookings.push(bk);
    return { insertId: bk.id };
  }
  if (lowerSql.includes('update rental_bookings set status =') || lowerSql.includes('update rental_bookings set booking_status =')) {
    const b = memoryStore.rental_bookings.find(x => x.razorpay_order_id === params[2] || String(x.id) === String(params[2]));
    if (b) {
      b.status = params[0];
      b.booking_status = params[0] === 'PAID' ? 'CONFIRMED' : params[0];
      b.payment_status = params[0];
      if (params[1]) b.razorpay_payment_id = params[1];
    }
    return { affectedRows: 1 };
  }

  if (lowerSql.includes('select * from user_notifications')) {
    const uid = params[0];
    return memoryStore.user_notifications.filter(n => String(n.user_id) === String(uid) || n.user_id === null);
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

  if (lowerSql.includes('update users set role =')) {
    const roleVal = params[0];
    const userVal = params[1];
    const u = memoryStore.users.find(x => x.id === userVal || x.uuid === userVal || x.email === userVal || Number(x.id) === Number(userVal));
    if (u) u.role = roleVal;
    return { affectedRows: 1 };
  }

  if (lowerSql.includes('select * from user_bookmarks')) {
    const uid = String(params[0]);
    const pid = params[1] ? Number(params[1]) : null;
    return memoryStore.user_bookmarks.filter(b => String(b.user_id) === uid && (!pid || Number(b.place_id) === pid));
  }
  if (lowerSql.includes('insert into user_bookmarks')) {
    const uid = String(params[0]);
    const pid = Number(params[1]);
    if (!memoryStore.user_bookmarks.some(b => String(b.user_id) === uid && Number(b.place_id) === pid)) {
      memoryStore.user_bookmarks.push({ id: memoryStore.user_bookmarks.length + 1, user_id: uid, place_id: pid, created_at: new Date().toISOString() });
    }
    return { insertId: 1 };
  }
  if (lowerSql.includes('delete from user_bookmarks')) {
    const uid = String(params[0]);
    const pid = Number(params[1]);
    memoryStore.user_bookmarks = memoryStore.user_bookmarks.filter(b => !(String(b.user_id) === uid && Number(b.place_id) === pid));
    return { affectedRows: 1 };
  }

  if (lowerSql.includes('select * from place_reviews')) {
    return memoryStore.place_reviews.filter(r => Number(r.place_id) === Number(params[0]));
  }
  if (lowerSql.includes('insert into place_reviews')) {
    const newRev = {
      id: memoryStore.place_reviews.length + 1,
      place_id: Number(params[0]),
      user_id: params[1] ? String(params[1]) : null,
      user_name: params[2],
      user_avatar: params[3] || 'US',
      rating: Number(params[4]),
      comment: params[5],
      created_at: new Date().toISOString()
    };
    memoryStore.place_reviews.push(newRev);
    return { insertId: newRev.id };
  }
  if (lowerSql.includes('inner join user_bookmarks')) {
    const uid = String(params[0]);
    const bookmarkedIds = new Set(memoryStore.user_bookmarks.filter(b => String(b.user_id) === uid).map(b => Number(b.place_id)));
    return memoryStore.explore_places.filter(p => bookmarkedIds.has(Number(p.id)));
  }
  if (lowerSql.includes('from explore_places')) {
    const uid = params[0] ? String(params[0]) : null;
    const bookmarkedSet = new Set(
      uid ? memoryStore.user_bookmarks.filter(b => String(b.user_id) === uid).map(b => Number(b.place_id)) : []
    );
    return memoryStore.explore_places.map(p => ({
      ...p,
      is_bookmarked: uid ? bookmarkedSet.has(Number(p.id)) : false
    }));
  }
  if (lowerSql.includes('insert into rentals')) {
    const newRental = {
      id: memoryStore.rentals.length + 1,
      vendor_user_id: String(params[0]),
      title: params[1],
      vendor: params[2],
      category: params[3],
      price_per_day: Number(params[4]),
      rating: 5.0,
      total_ratings: 1,
      distance: '0.5 km away',
      fuel: params[5] || 'Petrol',
      transmission: params[6] || 'Automatic',
      tags: params[7] || 'Verified Vendor',
      image: params[8],
      description: params[9] || '',
      location: params[10] || 'Sanquelim / Campus Gate',
      is_available: true,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };
    memoryStore.rentals.unshift(newRental);
    return { insertId: newRental.id, affectedRows: 1 };
  }

  if (lowerSql.includes('where vendor_user_id')) {
    const vid = String(params[0]);
    return memoryStore.rentals.filter(r => String(r.vendor_user_id) === vid && r.status !== 'DELETED');
  }

  if (lowerSql.includes('update rentals set is_available')) {
    const rid = Number(params[0]);
    const item = memoryStore.rentals.find(r => Number(r.id) === rid);
    if (item) item.is_available = !item.is_available;
    return { affectedRows: 1 };
  }

  if (lowerSql.includes('delete from rentals') || lowerSql.includes('update rentals set status = \'deleted\'')) {
    const rid = Number(params[0]);
    const item = memoryStore.rentals.find(r => Number(r.id) === rid);
    if (item) {
      item.status = 'DELETED';
      item.is_available = false;
    }
    return { affectedRows: 1 };
  }

  if (lowerSql.includes('from rentals')) return memoryStore.rentals.filter(r => r.status !== 'DELETED');
  if (lowerSql.includes('select * from travel_trips')) return memoryStore.travel_trips.filter(t => t.status !== 'CANCELLED');

  return [];
}
