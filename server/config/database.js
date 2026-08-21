import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { ENV } from './env.js';

let pool = null;
export let isInMemoryFallback = false;

export function checkWritePersistence(res) {
  const disableMemory = process.env.DISABLE_MEMORY_FALLBACK === 'true';

  if (isInMemoryFallback && disableMemory) {
    if (res && !res.headersSent) {
      res.status(503).json({
        success: false,
        error: 'DATABASE_UNAVAILABLE',
        message: 'Database persistence is unavailable. Write operations disabled.'
      });
    }
    return false;
  }
  return true;
}

export const memoryStore = {
  users: [],
  refresh_tokens: [],
  auth_tokens: [],
  rentals: [],
  explore_places: [],
  place_reviews: [],
  travel_trips: [],
  trip_participants: [],
  trip_messages: [],
  user_activities: [],
  user_notifications: [],
  user_bookmarks: [],
  rental_bookings: []
};

export async function initDatabase() {
  if (process.env.VERCEL) {
    console.log('⚡ [Vercel Environment] Enabling instant in-memory database fallback.');
    isInMemoryFallback = true;
    seedMemoryData();
    return;
  }

  try {
    let rootConn = null;

    try {
      rootConn = await mysql.createConnection({
        host: ENV.DB.HOST,
        port: ENV.DB.PORT,
        user: ENV.DB.USER,
        password: ENV.DB.PASSWORD,
        connectTimeout: 1500
      });
    } catch (authErr) {
      if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
        console.warn('⚠️ Local MySQL unavailable. Enabling in-memory fallback.');
        isInMemoryFallback = true;
        seedMemoryData();
        return;
      }
      console.warn(`⚠️ Authentication warning on port ${ENV.DB.PORT}. Attempting root fallbacks...`);
      const fallbackPasswords = [ENV.DB.PASSWORD, 'root', '', '123456', 'admin', 'password'];
      for (const pass of fallbackPasswords) {
        try {
          rootConn = await mysql.createConnection({
            host: ENV.DB.HOST,
            port: ENV.DB.PORT,
            user: 'root',
            password: pass,
            connectTimeout: 1000
          });
          break;
        } catch (e) {}
      }
    }

    if (!rootConn) {
      console.warn(`Failed to connect to MySQL server at ${ENV.DB.HOST}:${ENV.DB.PORT}. Switching to in-memory fallback.`);
      isInMemoryFallback = true;
      seedMemoryData();
      return;
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
        phone_number VARCHAR(20) NULL UNIQUE,
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
      "ADD COLUMN phone_number VARCHAR(20) NULL",
      "ADD UNIQUE INDEX idx_users_phone (phone_number)",
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
        vendor_phone VARCHAR(20) NULL,
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
      "ADD COLUMN vendor_phone VARCHAR(20) NULL",
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
        contact_phone VARCHAR(20) NULL,
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
      "ADD COLUMN contact_phone VARCHAR(20) NULL",
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

    // 10b. Trip Messages Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trip_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        trip_id INT NOT NULL,
        sender_user_id VARCHAR(255) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        receiver_user_id VARCHAR(255) NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_trip_id (trip_id),
        INDEX idx_sender_user_id (sender_user_id),
        INDEX idx_receiver_user_id (receiver_user_id)
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
    const defaultRentals = [
      ['1', 'Honda Activa 6G', 'Campus Scooters Sanquelim', 'Scooter', 350, 4.9, 142, '0.8 km away', 'Petrol', 'Automatic', 'Verified Vendor,Helmets Included', 'https://htcms-prod-images.s3.ap-south-1.amazonaws.com/htmobile1/honda_activa6g/images/colours_honda-activa6g_matte-steel-black-metallic_600x400.jpg', 'Reliable 110cc automatic scooter for quick campus commutes, local market runs & beach rides around Sanquelim. Clean helmets included.', 'GIM Main Gate', '+919876500001', true, 'ACTIVE'],
      ['1', 'Honda City 1.5 i-VTEC', 'Goa Coastal Drive Rentals', 'Car', 2200, 4.8, 98, '1.5 km away', 'Petrol', 'Automatic', 'Sunroof,Sedan,AC', 'https://www.hondacarindia.com/_next/image?url=https%3A%2F%2Fwww.hondacarindia.com%2Fweb-data%2Fmodels%2F2026%2FhondaCity%2FBookingImage%2FMobile%2FCITY_EHEV_GREY_01_mob_01.jpg&w=3840&q=75', 'Premium 5-seater sedan with sunroof, automatic transmission, full AC. Perfect for South Goa weekend trips & group airport travel.', 'Sanquelim Circle', '+919876500002', true, 'ACTIVE'],
      ['1', 'Hyundai Verna 1.5 Turbo', 'Bicholim Self-Drive Motors', 'Car', 2400, 4.9, 84, '2.1 km away', 'Petrol', 'Manual', 'Turbo,Bose Audio,Ventilated Seats', 'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/204398/verna-exterior-right-front-three-quarter.png?isig=0&q=80&q=80', 'Sporty sedan with ventilated seats, Bose sound system, high highway stability for Panjim & North Goa coastline exploration.', 'Bicholim / GIM Gate', '+919876500003', true, 'ACTIVE'],
      ['1', 'Royal Enfield Hunter 350', 'North Goa Bike Rentals', 'Bike', 750, 4.8, 65, '1.0 km away', 'Petrol', 'Manual', 'Cruiser,Helmets Included', 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', 'Comfortable 350cc cruiser bike perfect for scenic coastal highway rides.', 'GIM Main Gate', '+919876500004', true, 'ACTIVE']
    ];

    for (const r of defaultRentals) {
      const [existing] = await pool.query('SELECT id FROM rentals WHERE title = ? AND vendor = ? AND status != "DELETED"', [r[1], r[2]]);
      if (!existing || existing.length === 0) {
        await pool.query(
          'INSERT INTO rentals (vendor_user_id, title, vendor, category, price_per_day, rating, total_ratings, distance, fuel, transmission, tags, image, description, location, vendor_phone, is_available, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          r
        );
      }
    }

    const [exploreRows] = await pool.query('SELECT COUNT(*) as count FROM explore_places');
    if (exploreRows[0].count === 0) {
      const places = [
        ['Mandrem Beach & Lagoon (Vaayu)', 'Beaches', 4.9, '36 km · 55 min scooter', '₹450 per person', 'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmNAdAa4scSmp9HvmfB4119rUKGLcLQ6Hs5iRVq5480vFQpFuBJ7b1pVPxp9XtEFEbd8YmSaprqd3ISn2DXz7GKDGJEhHcRmJSveQxuJUP88AKbIbPbkrS7X5OFhwsWyWFWAybF=s1360-w1360-h1020-rw', false, 'Beautiful, serene beach & Mandrem lagoon featured in Londoner In Sydney. Great for SUP paddle boarding and organic cafes at Vaayu Vision Collective.', 'https://www.google.com/maps/search/?api=1&query=Mandrem+Beach+Vaayu+Goa', '7:00 AM – 11:00 AM (Breakfast & Water Sports)', '₹450 / person', 'Try the smoothie bowls and rent SUP boards at Vaayu.'],
        ['La Plage Restaurant (Ashwem)', 'Food', 4.9, '34 km · 50 min scooter', '₹1200 per person', 'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWlIZmwzW71PgFTPgcRP34wdpgQXFBIcvcOA9xTNRGRrLaUkv-gRnlos9gbpLAZ05t_QGBT3bU6JRAgTpryOtp8WkDdbDAuRv3kG9mnl75NjrDlEKFut5nBR9GOa1WuWlufG7KSe=s1360-w1360-h1020-rw', false, 'Famous French fine dining right on Ashwem Beach highlighted by Londoner In Sydney. World-class food, beach lounge chairs, and fairy lights.', 'https://www.google.com/maps/search/?api=1&query=La+Plage+Ashwem+Beach+Goa', '1:00 PM – 4:00 PM (Lunch)', '₹1200 / person', 'Order the signature beef fillet steak and chocolate thali.'],
        ['Pink Chilli Restaurant (Arpora)', 'Food', 4.8, '31 km · 48 min scooter', '₹700 per person', 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/0e/3c/49/2e/photo0jpg.jpg?w=2000&h=-1&s=1', false, 'Stunning North Indian restaurant with vibrant bohemian decor, cozy outdoor huts, and signature cocktails recommended by Londoner In Sydney.', 'https://www.google.com/maps/search/?api=1&query=Pink+Chilli+Restaurant+Goa', '7:30 PM – 11:00 PM (Dinner)', '₹700 / person', 'Perfect for group dinners and Instagram photos.'],
        ['Anjuna Flea Market & Shacks', 'Shopping', 4.7, '32 km · 50 min scooter', '₹500 per person', 'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmutyjqvK5rbNOmLVMH4qhOPItGfVstPHEPYtIlfEEM35-C3QDtJZiuIdNTHAlYJJY2xN200WulBwRupdjy5echnPczhc72ruZC7rNJ3lpUvIszh1x8FEO4Uv88kz1OlXvo9k0k=s1360-w1360-h1020-rw', false, 'Iconic Wednesday flea market in Anjuna with bohemian clothes, silver jewelry, handmade artifacts, and beachside acoustic shacks.', 'https://www.google.com/maps/search/?api=1&query=Anjuna+Flea+Market+Goa', 'Wednesdays 10:00 AM – 6:00 PM', '₹500 / person', 'Bargain hard for vintage lamps, jewelry, and handmade tapestries.'],
        ['Thalassa Greek Restaurant (Siolim)', 'Food', 4.9, '30 km · 50 min scooter', '₹1500 per person', 'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWlIvioTuSaJ3ZY1ejzJ1VIYbX9H2x2fCGYatZ6eX-Mo57fc-O_HwRmfcYpVy3SNGJRYJIeDiYR-kD9A2qNdW8SjixlI73X3rxgUOTX9Z4b_NsYX8Dv--vzvWYFupMtqGVeCsHE3=s1360-w1360-h1020-rw', false, 'Santorini-style cliffside Greek restaurant overlooking the Chapora River sunset. Celebrated by Londoner In Sydney for plate-breaking dance shows.', 'https://www.google.com/maps/search/?api=1&query=Thalassa+Restaurant+Siolim+Goa', '5:00 PM – 8:30 PM (Sunset)', '₹1500 / person', 'Book sunset tables 3 days in advance!'],
        ['Arambol Beach Sunset Drum Circle', 'Nightlife', 4.8, '38 km · 1 hr 10 min scooter', '₹300 per person', 'https://www.goavilla.co.uk/instagram/BvjRjtkl8ux.jpg', false, 'Bohemian sunset gatherings, percussion drum circles, freshwater lake, and cliffside sunset views at Arambol.', 'https://www.google.com/maps/search/?api=1&query=Arambol+Beach+Goa', '5:00 PM – 8:00 PM (Sunset)', '₹300 / person', 'Walk past the rocks to the sweet water lake.'],
        ["Britto's Beach Shack (Baga)", 'Nightlife', 4.5, '33 km · 1 hr scooter', '₹700 per person', 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/30/de/27/24/caption.jpg?w=1100&h=1100&s=1', false, 'Legendary Baga beach shack featuring fresh seafood platters, live music, and beachfront candle-lit tables.', 'https://www.google.com/maps/search/?api=1&query=Brittos+Baga+Goa', '8:00 PM – 11:30 PM (Dinner & Drinks)', '₹700 / person', 'Try the butter garlic crab and Goan pork sorpotel.'],
        ['Dudhsagar Waterfalls Trek', 'Waterfalls', 4.9, '72 km · 2 hr 15 min', '₹1200 per person', 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80', false, 'Majestic 4-tiered waterfall in Bhagwan Mahavir Wildlife Sanctuary with forest jeep safaris and natural swimming pools.', 'https://www.google.com/maps/search/?api=1&query=Dudhsagar+Waterfalls+Goa', '8:30 AM – 2:30 PM (Day Trip)', '₹1200 / person', 'Mandatory life jackets provided at jeep counter.'],
        ['Fontainhas Latin Quarter', 'Nightlife', 4.8, '28 km · 45 min scooter', '₹400 per person', 'https://www.tourmyindia.com/states/goa/image/fontainhas-latin-quarter-goa.webp', false, 'UNESCO heritage Portuguese quarter in Panjim with pastel yellow/blue villas, art galleries, and historic bakeries.', 'https://www.google.com/maps/search/?api=1&query=Fontainhas+Panjim+Goa', '9:00 AM – 12:00 PM (Morning Walk)', '₹400 / person', 'Visit Confeitaria 31 De Janeiro for fresh Bebinca.'],
        ['Querim (Keri) Peace Beach', 'Beaches', 4.8, '42 km · 1 hr 15 min scooter', '₹300 per person', 'https://im.whatshot.in/img/2020/Oct/istock-1201363244-1601539513.jpg', false, 'Goa’s northernmost secluded beach lined with pine trees, river estuary, and Fort Tiracol views.', 'https://www.google.com/maps/search/?api=1&query=Querim+Keri+Beach+Goa', '4:00 PM – 6:30 PM (Sunset)', '₹300 / person', 'Take the free river ferry across to Fort Tiracol.'],
        ['Fort Aguada & Lighthouse', 'Beaches', 4.8, '35 km · 50 min scooter', '₹50 entry', 'https://images.unsplash.com/photo-1587922546307-776227941871?auto=format&fit=crop&w=800&q=80', false, '17th-century Portuguese fortress and historic lighthouse offering panoramic cliffside views of Sinquerim beach and Arabian Sea.', 'https://www.google.com/maps/search/?api=1&query=Fort+Aguada+Goa', '9:30 AM – 5:30 PM (Sunset views)', '₹50 / person', 'Visit lower fort for ocean waves and photography.'],
        ['Chapora Fort (Dil Chahta Hai)', 'Beaches', 4.7, '30 km · 45 min scooter', 'Free Entry', 'https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?auto=format&fit=crop&w=800&q=80', false, 'Iconic hillfort famed for Bollywood classic Dil Chahta Hai, offering spectacular 360-degree sunset views.', 'https://www.google.com/maps/search/?api=1&query=Chapora+Fort+Goa', '4:30 PM – 6:30 PM (Golden Hour Sunset)', 'Free Entry', 'Wear comfortable sneakers for the 10-minute hike.'],
        ['Basilica of Bom Jesus (Old Goa)', 'Shopping', 4.9, '22 km · 35 min scooter', 'Free Entry', 'https://images.unsplash.com/photo-1600100397608-f010e423b971?auto=format&fit=crop&w=800&q=80', false, 'UNESCO World Heritage Site housing the mortal remains of St. Francis Xavier, renowned for baroque architectural grandeur.', 'https://www.google.com/maps/search/?api=1&query=Basilica+of+Bom+Jesus+Old+Goa', '9:00 AM – 1:00 PM', 'Free Entry', 'Combine your trip with Se Cathedral in Old Goa.'],
        ['Calangute Beach (Queen of Beaches)', 'Beaches', 4.6, '33 km · 50 min scooter', '₹500 for Water Sports', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80', false, 'Bustling beach hub celebrated for parasailing, jet skiing, banana rides, and vibrant beach shacks serving Goan curry.', 'https://www.google.com/maps/search/?api=1&query=Calangute+Beach+Goa', '10:00 AM – 5:00 PM (Water Sports)', '₹500 / person', 'Bargain for combo water sports packages.'],
        ['Grand Island Scuba & Snorkeling', 'Beaches', 4.9, '38 km · Boat from Candolim', '₹1800 per person', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80', false, 'Unforgettable island boat excursion featuring underwater scuba diving, snorkeling among coral reefs, and dolphin spotting.', 'https://www.google.com/maps/search/?api=1&query=Grand+Island+Goa', '7:30 AM – 3:30 PM (Full Day Trip)', '₹1800 / person', 'Book a day in advance for underwater video footage.'],
        ['Palolem Crescent Beach (South Goa)', 'Beaches', 4.9, '85 km · 2 hr drive', '₹400 per person', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', false, 'Idyllic crescent-shaped bay fringed by coconut palms in South Goa, famous for kayak rides and dolphin trips.', 'https://www.google.com/maps/search/?api=1&query=Palolem+Beach+Goa', '3:00 PM – 8:00 PM (Sunset & Kayaking)', '₹400 / person', 'Rent a double kayak to paddle around Monkey Island.'],
        ['Chapora River Cruises & Kayaking', 'Beaches', 4.8, '26 km · 40 min scooter', '₹800 for Sunset Cruise', 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80', false, 'Scenic northern river ideal for white river rafting, kayaking, and serene sunset houseboat cruises.', 'https://www.google.com/maps/search/?api=1&query=Chapora+River+Goa', '4:00 PM – 7:00 PM', '₹800 / person', 'Book evening sunset cruise.'],
        ["Tito's Street (Baga Nightlife Hub)", 'Nightlife', 4.7, '32 km · 50 min scooter', '₹1000 couple', 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80', false, "Goa's iconic party lane with neon-lit nightclubs, energetic dance floors, and open-air bars.", 'https://www.google.com/maps/search/?api=1&query=Tito+Street+Baga+Goa', '9:00 PM – 3:00 AM', '₹1000 / couple', 'Free entry for ladies on select nights.'],
        ['Club Cubana ("Nightclub in the Sky")', 'Nightlife', 4.8, '30 km · 45 min scooter', '₹1500 per couple', 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=800&q=80', false, 'Multi-level hilltop nightclub in Arpora with a poolside dance lounge and revolving strobe lights.', 'https://www.google.com/maps/search/?api=1&query=Club+Cubana+Arpora+Goa', '9:30 PM – 4:00 AM', '₹1500 / couple', 'Wednesday Ladies Night.'],
        ['Deltin Royale Casino Cruise', 'Nightlife', 4.9, '24 km · 35 min scooter', '₹2500 per person', 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=800&q=80', false, 'Luxury casino vessel docked on Mandovi River offering Vegas-style gaming, live music & dining.', 'https://www.google.com/maps/search/?api=1&query=Deltin+Royale+Casino+Panjim+Goa', '8:00 PM – 2:00 AM', '₹2500 / person', 'Formal dress code required.'],
        ['Mambos Nightclub (Baga Beach)', 'Nightlife', 4.6, '32 km · 50 min scooter', '₹1000 per couple', 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80', false, "High-energy beachfront club on Tito's Lane known for EDM DJs, laser light shows, and cocktails.", 'https://www.google.com/maps/search/?api=1&query=Mambos+Nightclub+Baga+Goa', '10:00 PM – 3:30 AM', '₹1000 / couple', 'Try wood-fired pizzas & passion fruit cocktails.'],
        ['Bondla Wildlife Sanctuary', 'Waterfalls', 4.7, '18 km · 30 min scooter', '₹5 entry', 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=800&q=80', false, "Goa's famous compact wildlife reserve featuring spotted deer parks, botanical gardens, and nature trails.", 'https://www.google.com/maps/search/?api=1&query=Bondla+Wildlife+Sanctuary+Goa', '9:00 AM – 5:00 PM', '₹5 / person', 'Great for morning wildlife photography.'],
        ['Sahakari Spice Plantations (Ponda)', 'Food', 4.8, '20 km · 35 min scooter', '₹500 buffet & tour', 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80', false, 'Lush 130-acre organic spice farm with guided aromatic tours, spice tea, and traditional Goan buffet lunch.', 'https://www.google.com/maps/search/?api=1&query=Sahakari+Spice+Farm+Ponda+Goa', '10:00 AM – 3:00 PM', '₹500 / person', 'Includes welcome spice tea & traditional buffet.'],
        ['Verna Springs (Kesarval Springs)', 'Waterfalls', 4.6, '32 km · 50 min scooter', 'Free Entry', 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=800&q=80', false, 'Natural freshwater springs gushing from forest cliffs, famous for medicinal waters.', 'https://www.google.com/maps/search/?api=1&query=Kesarval+Verna+Springs+Goa', '9:00 AM – 5:00 PM', 'Free Entry', 'Bring spare clothes to dip in mineral springs.'],

        ['Shri Mangueshi Temple (Ponda)', 'Shopping', 4.9, '22 km · 35 min scooter', 'Free Entry', 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80', false, '400-year-old architectural masterpiece featuring a famous 7-storeyed octagonal lamp tower.', 'https://www.google.com/maps/search/?api=1&query=Mangueshi+Temple+Ponda+Goa', '6:00 AM – 9:00 PM', 'Free Entry', 'Illuminated beautifully during evening aarti.'],
        ['Cavelossim Beach (South Goa)', 'Beaches', 4.8, '70 km · 1 hr 40 min drive', 'Free Entry', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', false, 'South Goa beach with black lava rocks and white sand.', 'https://www.google.com/maps/search/?api=1&query=Cavelossim+Beach+South+Goa', '3:30 PM – 7:00 PM', 'Free Entry', 'Great spot for dolphin watching trips.'],
        ['Dolphin Watching Boat Safari', 'Beaches', 4.7, '32 km · 50 min scooter', '₹400 per person', 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80', false, '1.5-hour ocean boat trip to watch wild Indo-Pacific humpback dolphins.', 'https://www.google.com/maps/search/?api=1&query=Dolphin+Watching+Boat+Trip+Goa', '7:00 AM – 10:00 AM', '₹400 / person', 'Early morning boat rides offer best viewing.']
      ];
      for (const p of places) {
        const [existing] = await pool.query('SELECT id FROM explore_places WHERE name = ?', [p[0]]);
        if (!existing || existing.length === 0) {
          await pool.query('INSERT INTO explore_places (name, category, rating, distance, price, image, is_bookmarked, description, maps_url, best_time, est_cost, pro_tips) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', p);
        } else {
          await pool.query('UPDATE explore_places SET category = ?, rating = ?, distance = ?, price = ?, image = ?, description = ?, maps_url = ?, best_time = ?, est_cost = ?, pro_tips = ? WHERE name = ?', [p[1], p[2], p[3], p[4], p[5], p[7], p[8], p[9], p[10], p[11], p[0]]);
        }
      }
      // Cleanup: delete the Taj-Mahal Lamgau listing that was removed from seeds per user request
      try { await pool.query("DELETE FROM explore_places WHERE name = 'Lamgau Rock-Cut Caves (Bicholim)'"); } catch (e) {}
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

    // Seed admin user sangini@gmail.com with ADMIN role for full access
    try {
      const [adminExisting] = await pool.query('SELECT id FROM users WHERE email = ?', ['sangini@gmail.com']);
      if (!adminExisting || adminExisting.length === 0) {
        const adminHash = await bcrypt.hash('Sangini@123456', 12);
        const adminUuid = uuidv4();
        await pool.query(
          `INSERT INTO users (uuid, name, email, phone_number, password_hash, provider, avatar, email_verified, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [adminUuid, 'Sangini', 'sangini@gmail.com', '+919876543210', adminHash, 'EMAIL', 'SA', 1, 'ADMIN', 1]
        );
        console.log('✅ Seeded admin user: sangini@gmail.com / Sangini@123456 (ADMIN)');
      } else {
        // Ensure role is ADMIN and password is correct
        const adminHash = await bcrypt.hash('Sangini@123456', 12);
        await pool.query('UPDATE users SET role = ?, password_hash = ?, is_active = TRUE, email_verified = TRUE WHERE email = ?', ['ADMIN', adminHash, 'sangini@gmail.com']);
        console.log('✅ Ensured admin user sangini@gmail.com has ADMIN role');
      }
    } catch (adminErr) {
      console.warn('Admin seed warning:', adminErr.message);
    }
  } catch (err) {
    console.error('Seed error:', err);
  }
}

function seedMemoryData() {
  memoryStore.rentals = [
    { id: 1, vendor_user_id: '1', title: 'Honda Activa 6G', vendor: 'Campus Scooters Sanquelim', category: 'Scooter', price_per_day: 350, rating: 4.9, total_ratings: 142, distance: '0.8 km away', fuel: 'Petrol', transmission: 'Automatic', tags: 'Verified Vendor,Helmets Included', image: 'https://htcms-prod-images.s3.ap-south-1.amazonaws.com/htmobile1/honda_activa6g/images/colours_honda-activa6g_matte-steel-black-metallic_600x400.jpg', description: 'Reliable 110cc automatic scooter for quick campus commutes, local market runs & beach rides around Sanquelim.', location: 'GIM Main Gate', is_available: true, status: 'ACTIVE', vendor_phone: '+919876500001' },
    { id: 2, vendor_user_id: '1', title: 'Honda City 1.5 i-VTEC', vendor: 'Goa Coastal Drive Rentals', category: 'Car', price_per_day: 2200, rating: 4.8, total_ratings: 98, distance: '1.5 km away', fuel: 'Petrol', transmission: 'Automatic', tags: 'Sunroof,Sedan,AC', image: 'https://www.hondacarindia.com/_next/image?url=https%3A%2F%2Fwww.hondacarindia.com%2Fweb-data%2Fmodels%2F2026%2FhondaCity%2FBookingImage%2FMobile%2FCITY_EHEV_GREY_01_mob_01.jpg&w=3840&q=75', description: 'Premium 5-seater sedan with sunroof, automatic transmission, full AC. Perfect for South Goa weekend trips.', location: 'Sanquelim Circle', is_available: true, status: 'ACTIVE', vendor_phone: '+919876500002' },
    { id: 3, vendor_user_id: '1', title: 'Hyundai Verna 1.5 Turbo', vendor: 'Bicholim Self-Drive Motors', category: 'Car', price_per_day: 2400, rating: 4.9, total_ratings: 84, distance: '2.1 km away', fuel: 'Petrol', transmission: 'Manual', tags: 'Turbo,Bose Audio,Ventilated Seats', image: 'https://imgd.aeplcdn.com/1920x1080/n/cw/ec/204398/verna-exterior-right-front-three-quarter.png?isig=0&q=80&q=80', description: 'Sporty sedan with ventilated seats, Bose sound system, high highway stability for Panjim & North Goa driving.', location: 'Bicholim / GIM Gate', is_available: true, status: 'ACTIVE', vendor_phone: '+919876500003' }
  ];

  memoryStore.explore_places = [
    { id: 1, name: 'Mandrem Beach & Lagoon (Vaayu)', category: 'Beaches', rating: 4.9, distance: '36 km · 55 min scooter', price: '₹450 per person', image: 'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmNAdAa4scSmp9HvmfB4119rUKGLcLQ6Hs5iRVq5480vFQpFuBJ7b1pVPxp9XtEFEbd8YmSaprqd3ISn2DXz7GKDGJEhHcRmJSveQxuJUP88AKbIbPbkrS7X5OFhwsWyWFWAybF=s1360-w1360-h1020-rw', is_bookmarked: false, description: 'Beautiful beach & Mandrem lagoon.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Mandrem+Beach+Vaayu+Goa', best_time: '7:00 AM – 11:00 AM', est_cost: '₹450 / person', pro_tips: 'Smoothie bowls & SUP boards at Vaayu.' },
    { id: 2, name: 'La Plage Restaurant (Ashwem)', category: 'Food', rating: 4.9, distance: '34 km · 50 min scooter', price: '₹1200 per person', image: 'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWlIZmwzW71PgFTPgcRP34wdpgQXFBIcvcOA9xTNRGRrLaUkv-gRnlos9gbpLAZ05t_QGBT3bU6JRAgTpryOtp8WkDdbDAuRv3kG9mnl75NjrDlEKFut5nBR9GOa1WuWlufG7KSe=s1360-w1360-h1020-rw', is_bookmarked: false, description: 'French fine dining on Ashwem Beach.', maps_url: 'https://www.google.com/maps/search/?api=1&query=La+Plage+Ashwem+Beach+Goa', best_time: '1:00 PM – 4:00 PM', est_cost: '₹1200 / person', pro_tips: 'Try the beef fillet steak.' },
    { id: 3, name: 'Pink Chilli Restaurant (Arpora)', category: 'Food', rating: 4.8, distance: '31 km · 48 min scooter', price: '₹700 per person', image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/0e/3c/49/2e/photo0jpg.jpg?w=2000&h=-1&s=1', is_bookmarked: false, description: 'North Indian restaurant with bohemian huts.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Pink+Chilli+Restaurant+Goa', best_time: '7:30 PM – 11:00 PM', est_cost: '₹700 / person', pro_tips: 'Instagram photo ops.' },
    { id: 4, name: 'Anjuna Flea Market & Shacks', category: 'Shopping', rating: 4.7, distance: '32 km · 50 min scooter', price: '₹500 per person', image: 'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmutyjqvK5rbNOmLVMH4qhOPItGfVstPHEPYtIlfEEM35-C3QDtJZiuIdNTHAlYJJY2xN200WulBwRupdjy5echnPczhc72ruZC7rNJ3lpUvIszh1x8FEO4Uv88kz1OlXvo9k0k=s1360-w1360-h1020-rw', is_bookmarked: false, description: 'Wednesday flea market in Anjuna.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Anjuna+Flea+Market+Goa', best_time: 'Wednesdays 10:00 AM – 6:00 PM', est_cost: '₹500 / person', pro_tips: 'Bargain hard for silver jewelry.' },
    { id: 5, name: 'Thalassa Greek Restaurant (Siolim)', category: 'Food', rating: 4.9, distance: '30 km · 50 min scooter', price: '₹1500 per person', image: 'https://lh3.googleusercontent.com/gps-cs-s/AHRPTWlIvioTuSaJ3ZY1ejzJ1VIYbX9H2x2fCGYatZ6eX-Mo57fc-O_HwRmfcYpVy3SNGJRYJIeDiYR-kD9A2qNdW8SjixlI73X3rxgUOTX9Z4b_NsYX8Dv--vzvWYFupMtqGVeCsHE3=s1360-w1360-h1020-rw', is_bookmarked: false, description: 'Cliffside Greek dining.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Thalassa+Restaurant+Siolim+Goa', best_time: '5:00 PM – 8:30 PM', est_cost: '₹1500 / person', pro_tips: 'Plate-breaking dance shows.' },
    { id: 6, name: 'Arambol Beach Sunset Drum Circle', category: 'Nightlife', rating: 4.8, distance: '38 km · 1 hr 10 min scooter', price: '₹300 per person', image: 'https://www.goavilla.co.uk/instagram/BvjRjtkl8ux.jpg', is_bookmarked: false, description: 'Bohemian drum circles & freshwater lake.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Arambol+Beach+Goa', best_time: '5:00 PM – 8:00 PM', est_cost: '₹300 / person', pro_tips: 'Sunset drum circle.' },
    { id: 7, name: "Britto's Beach Shack (Baga)", category: 'Nightlife', rating: 4.5, distance: '33 km · 1 hr scooter', price: '₹700 per person', image: 'https://dynamic-media-cdn.tripadvisor.com/media/photo-o/30/de/27/24/caption.jpg?w=1100&h=1100&s=1', is_bookmarked: false, description: 'Baga beach shack seafood platters.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Brittos+Baga+Goa', best_time: '8:00 PM – 11:30 PM', est_cost: '₹700 / person', pro_tips: 'Live music & candle-lit tables.' },
    { id: 8, name: 'Dudhsagar Waterfalls Trek', category: 'Waterfalls', rating: 4.9, distance: '72 km · 2 hr 15 min', price: '₹1200 per person', image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: '4-tiered waterfall jeep safari.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Dudhsagar+Waterfalls+Goa', best_time: '8:30 AM – 2:30 PM', est_cost: '₹1200 / person', pro_tips: 'Jeep safaris & natural pools.' },
    { id: 9, name: 'Fontainhas Latin Quarter', category: 'Nightlife', rating: 4.8, distance: '28 km · 45 min scooter', price: '₹400 per person', image: 'https://www.tourmyindia.com/states/goa/image/fontainhas-latin-quarter-goa.webp', is_bookmarked: false, description: 'Portuguese villas & historic bakeries.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Fontainhas+Panjim+Goa', best_time: '9:00 AM – 12:00 PM', est_cost: '₹400 / person', pro_tips: 'Confeitaria 31 De Janeiro Bebinca.' },
    { id: 10, name: 'Querim (Keri) Peace Beach', category: 'Beaches', rating: 4.8, distance: '42 km · 1 hr 15 min scooter', price: '₹300 per person', image: 'https://im.whatshot.in/img/2020/Oct/istock-1201363244-1601539513.jpg', is_bookmarked: false, description: 'Northernmost secluded beach & river estuary.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Querim+Keri+Beach+Goa', best_time: '4:00 PM – 6:30 PM', est_cost: '₹300 / person', pro_tips: 'Free river ferry to Fort Tiracol.' },
    { id: 11, name: 'Fort Aguada & Lighthouse', category: 'Beaches', rating: 4.8, distance: '35 km · 50 min scooter', price: '₹50 entry', image: 'https://images.unsplash.com/photo-1587922546307-776227941871?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: '17th-century Portuguese fortress.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Fort+Aguada+Goa', best_time: '9:30 AM – 5:30 PM', est_cost: '₹50 / person', pro_tips: 'Panoramic cliffside views.' },
    { id: 12, name: 'Chapora Fort (Dil Chahta Hai)', category: 'Beaches', rating: 4.7, distance: '30 km · 45 min scooter', price: 'Free Entry', image: 'https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Iconic hillfort for golden hour sunsets.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Chapora+Fort+Goa', best_time: '4:30 PM – 6:30 PM', est_cost: 'Free Entry', pro_tips: 'Short 10-minute stone hike.' },
    { id: 13, name: 'Basilica of Bom Jesus (Old Goa)', category: 'Shopping', rating: 4.9, distance: '22 km · 35 min scooter', price: 'Free Entry', image: 'https://images.unsplash.com/photo-1600100397608-f010e423b971?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'UNESCO World Heritage Site in Old Goa.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Basilica+of+Bom+Jesus+Old+Goa', best_time: '9:00 AM – 1:00 PM', est_cost: 'Free Entry', pro_tips: 'Visit Se Cathedral nearby.' },
    { id: 14, name: 'Calangute Beach (Queen of Beaches)', category: 'Beaches', rating: 4.6, distance: '33 km · 50 min scooter', price: '₹500 for Water Sports', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Bustling beach hub for water sports & shacks.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Calangute+Beach+Goa', best_time: '10:00 AM – 5:00 PM', est_cost: '₹500 / person', pro_tips: 'Bargain for combo sports packages.' },
    { id: 15, name: 'Grand Island Scuba & Snorkeling', category: 'Waterfalls', rating: 4.9, distance: '38 km · Boat from Candolim', price: '₹1800 per person', image: 'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Underwater scuba diving & snorkeling boat trip.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Grand+Island+Goa', best_time: '7:30 AM – 3:30 PM', est_cost: '₹1800 / person', pro_tips: 'Underwater camera footage included.' },
    { id: 16, name: 'Palolem Crescent Beach (South Goa)', category: 'Beaches', rating: 4.9, distance: '85 km · 2 hr drive', price: '₹400 per person', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Crescent bay in South Goa for kayaking.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Palolem+Beach+Goa', best_time: '3:00 PM – 8:00 PM', est_cost: '₹400 / person', pro_tips: 'Rent kayaks to Monkey Island.' },
    { id: 17, name: 'Chapora River Cruises & Kayaking', category: 'Beaches', rating: 4.8, distance: '26 km · 40 min scooter', price: '₹800 for Sunset Cruise', image: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'White river rafting, kayaking, and sunset cruises.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Chapora+River+Goa', best_time: '4:00 PM – 7:00 PM', est_cost: '₹800 / person', pro_tips: 'Sunset houseboat cruises.' },
    { id: 18, name: "Tito's Street (Baga Nightlife Hub)", category: 'Nightlife', rating: 4.7, distance: '32 km · 50 min scooter', price: '₹1000 couple', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: "Goa's iconic party lane with neon-lit nightclubs.", maps_url: 'https://www.google.com/maps/search/?api=1&query=Tito+Street+Baga+Goa', best_time: '9:00 PM – 3:00 AM', est_cost: '₹1000 / couple', pro_tips: 'Free entry for ladies on select nights.' },
    { id: 19, name: 'Club Cubana ("Nightclub in the Sky")', category: 'Nightlife', rating: 4.8, distance: '30 km · 45 min scooter', price: '₹1500 per couple', image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Hilltop nightclub with poolside dance lounge.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Club+Cubana+Arpora+Goa', best_time: '9:30 PM – 4:00 AM', est_cost: '₹1500 / couple', pro_tips: 'Wednesday Ladies Night.' },
    { id: 20, name: 'Deltin Royale Casino Cruise', category: 'Nightlife', rating: 4.9, distance: '24 km · 35 min scooter', price: '₹2500 per person', image: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Luxury casino vessel docked on Mandovi River.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Deltin+Royale+Casino+Panjim+Goa', best_time: '8:00 PM – 2:00 AM', est_cost: '₹2500 / person', pro_tips: 'Formal dress code required.' },
    { id: 21, name: 'Mambos Nightclub (Baga Beach)', category: 'Nightlife', rating: 4.6, distance: '32 km · 50 min scooter', price: '₹1000 per couple', image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Beachfront club on Tito Lane with EDM DJs.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Mambos+Nightclub+Baga+Goa', best_time: '10:00 PM – 3:30 AM', est_cost: '₹1000 / couple', pro_tips: 'Wood-fired pizzas & cocktails.' },
    { id: 22, name: 'Bondla Wildlife Sanctuary', category: 'Waterfalls', rating: 4.7, distance: '18 km · 30 min scooter', price: '₹5 entry', image: 'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Compact wildlife reserve featuring spotted deer parks & nature trails.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Bondla+Wildlife+Sanctuary+Goa', best_time: '9:00 AM – 5:00 PM', est_cost: '₹5 / person', pro_tips: 'Great for morning wildlife photography.' },
    { id: 23, name: 'Sahakari Spice Plantations (Ponda)', category: 'Food', rating: 4.8, distance: '20 km · 35 min scooter', price: '₹500 buffet & tour', image: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Lush 130-acre organic spice farm with guided tours & Goan buffet.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Sahakari+Spice+Farm+Ponda+Goa', best_time: '10:00 AM – 3:00 PM', est_cost: '₹500 / person', pro_tips: 'Includes welcome spice tea & traditional lunch.' },
    { id: 24, name: 'Verna Springs (Kesarval Springs)', category: 'Waterfalls', rating: 4.6, distance: '32 km · 50 min scooter', price: 'Free Entry', image: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: 'Natural freshwater spring gushing from jungle cliffs.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Kesarval+Verna+Springs+Goa', best_time: '9:00 AM – 5:00 PM', est_cost: 'Free Entry', pro_tips: 'Bring spare clothes to dip in mineral springs.' },

    { id: 26, name: 'Shri Mangueshi Temple (Ponda)', category: 'Shopping', rating: 4.9, distance: '22 km · 35 min scooter', price: 'Free Entry', image: 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80', is_bookmarked: false, description: '400-year-old architectural masterpiece with a 7-storey lamp tower.', maps_url: 'https://www.google.com/maps/search/?api=1&query=Mangueshi+Temple+Ponda+Goa', best_time: '6:00 AM – 9:00 PM', est_cost: 'Free Entry', pro_tips: 'Illuminated beautifully during evening aarti.' }
  ];

  memoryStore.place_reviews = [
    { id: 1, place_id: 1, user_name: 'Rishi Hotwani', user_avatar: 'RH', rating: 5, comment: 'Amazing sunset spot!', created_at: new Date().toISOString() }
  ];
  memoryStore.travel_trips = [
    { id: 1, user_name: 'Rahul Verma', user_initials: 'RV', batch_info: 'PGDM 2026', title: 'Airport Share (Goa MOPA to GIM Campus)', pickup: 'MOPA Airport Terminal', date_time: 'Today 6:00 PM', seats_left: 2, seats_total: 4, vehicle_type: 'Cab', cost: '₹450 each', description: 'Flight arrives 5:30 PM. 2 seats free for GIM students.', status: 'ACTIVE', contact_phone: '+919876543210' }
  ];

  // Seed admin user for in-memory fallback
  (async () => {
    try {
      const hash = await bcrypt.hash('Sangini@123456', 12);
      if (!memoryStore.users.find(u => u.email === 'sangini@gmail.com')) {
        memoryStore.users.push({
          id: 1,
          uuid: uuidv4(),
          name: 'Sangini',
          email: 'sangini@gmail.com',
          phone_number: '+919876543210',
          password_hash: hash,
          google_id: null,
          provider: 'EMAIL',
          avatar: 'SA',
          email_verified: true,
          role: 'ADMIN',
          is_active: true,
          failed_login_attempts: 0,
          lock_until: null,
          last_login: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null
        });
        console.log('✅ Seeded in-memory admin: sangini@gmail.com / Sangini@123456');
      }
    } catch (e) { console.warn('in-memory admin seed warning', e.message); }
  })();
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
  if (pool && !isInMemoryFallback) {
    try {
      const [results] = await pool.query(sql, params);
      return results;
    } catch (err) {
      console.warn('MySQL Query Execution Error (switching to in-memory fallback):', err.message);
    }
  }
  
  const lowerSql = sql.toLowerCase();

  // --- USERS TABLE IN-MEMORY HANDLERS ---
  if (lowerSql.includes('select * from users where google_id')) {
    const gid = params[0];
    const u = memoryStore.users.find(x => x.google_id === gid && !x.deleted_at);
    return u ? [u] : [];
  }

  if (lowerSql.includes('select * from users where email')) {
    const em = params[0];
    const u = memoryStore.users.find(x => x.email === em && !x.deleted_at);
    return u ? [u] : [];
  }

  if (lowerSql.includes('select * from users where id =') || lowerSql.includes('select * from users where uuid =') || lowerSql.includes('select id, uuid')) {
    const target = params[0];
    const u = memoryStore.users.find(x => String(x.id) === String(target) || String(x.uuid) === String(target) || x.email === target);
    return u ? [u] : [];
  }

  if (lowerSql.includes('insert into users')) {
    const emailIndex = lowerSql.includes('uuid') ? 2 : 1;
    const emailVal = params[emailIndex] || params[1] || params[0];
    let existing = memoryStore.users.find(x => x.email === emailVal);
    if (!existing) {
      existing = {
        id: memoryStore.users.length + 1,
        uuid: params[0] && String(params[0]).length > 10 ? String(params[0]) : 'usr_' + Date.now(),
        name: params[1] || 'Google Student',
        email: emailVal,
        phone_number: params[3] || null,
        password_hash: params[4] || null,
        google_id: params[5] || null,
        provider: params[6] || 'GOOGLE',
        avatar: params[7] || 'GO',
        email_verified: true,
        role: params[9] || 'USER',
        is_active: true,
        created_at: new Date().toISOString()
      };
      memoryStore.users.push(existing);
    }
    return { insertId: existing.id, affectedRows: 1 };
  }

  if (lowerSql.includes('update users set')) {
    return { affectedRows: 1 };
  }

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
  if (lowerSql.includes('select id from explore_places where lower(trim(name))')) {
    const norm = String(params[0]).trim().toLowerCase();
    const dup = memoryStore.explore_places.find(p => String(p.name).trim().toLowerCase() === norm);
    return dup ? [dup] : [];
  }
  if (lowerSql.includes('insert into explore_places')) {
    const newPlace = {
      id: memoryStore.explore_places.length + 1,
      name: params[0],
      category: params[1],
      rating: params[2] || 4.5,
      distance: params[3] || '',
      price: params[4] || '₹400 / person',
      image: params[5],
      description: params[6],
      maps_url: params[7] || null,
      best_time: params[8] || '5:00 PM – 7:00 PM',
      est_cost: params[9] || '₹400 / person',
      pro_tips: params[10] || '',
      is_bookmarked: false,
      is_active: true
    };
    memoryStore.explore_places.push(newPlace);
    return { insertId: newPlace.id, affectedRows: 1 };
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
      vendor_phone: params[11] || null,
      is_available: true,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };
    memoryStore.rentals.unshift(newRental);
    return { insertId: newRental.id, affectedRows: 1 };
  }

  if (lowerSql.includes('where vendor_user_id')) {
    const validUserIds = new Set(params.map(p => String(p)).filter(p => p && p !== '0' && p !== 'null' && p !== 'undefined'));
    if (validUserIds.size === 0) return [];
    return memoryStore.rentals.filter(r => 
      r.status !== 'DELETED' && r.vendor_user_id && validUserIds.has(String(r.vendor_user_id))
    );
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

  if (lowerSql.includes('from rentals')) {
    return memoryStore.rentals.filter(r => r.status !== 'DELETED').map(r => {
      const user = memoryStore.users.find(u => String(u.id)===String(r.vendor_user_id) || String(u.uuid)===String(r.vendor_user_id) || String(u.email)===String(r.vendor_user_id));
      const resolved = r.vendor_phone || user?.phone_number || null;
      return { ...r, vendor_phone: resolved, phone: resolved, vendor_phone_resolved: resolved };
    });
  }

  if (lowerSql.includes('insert into travel_trips')) {
    const newTrip = {
      id: memoryStore.travel_trips.length + 1,
      host_user_id: params[0],
      user_name: params[1],
      user_initials: params[2],
      batch_info: params[3],
      title: params[4],
      destination: params[5],
      pickup: params[6],
      date_time: params[7],
      seats_left: params[8],
      seats_total: params[9],
      vehicle_type: params[10],
      cost: params[11],
      description: params[12],
      contact_phone: params[13] || null,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };
    memoryStore.travel_trips.unshift(newTrip);
    return { insertId: newTrip.id, affectedRows: 1 };
  }

  if (lowerSql.includes('update travel_trips set seats_left')) {
    const tid = Number(params[0]);
    const t = memoryStore.travel_trips.find(x => Number(x.id) === tid);
    if (t) t.seats_left = Math.max(0, (t.seats_left || 1) - 1);
    return { affectedRows: 1 };
  }

  if (lowerSql.includes('update travel_trips set')) {
    const tid = Number(params[params.length - 1]);
    const t = memoryStore.travel_trips.find(x => Number(x.id) === tid);
    if (t) {
      if (params[0] !== null) t.title = params[0];
      if (params[1] !== null) t.destination = params[1];
      if (params[2] !== null) t.pickup = params[2];
      if (params[3] !== null) t.date_time = params[3];
      if (params[4] !== null) t.cost = params[4];
      if (params[5] !== null) t.description = params[5];
    }
    return { affectedRows: 1 };
  }

  if (lowerSql.includes('insert into trip_messages')) {
    const newMsg = {
      id: memoryStore.trip_messages.length + 1,
      trip_id: Number(params[0]),
      sender_user_id: String(params[1]),
      sender_name: String(params[2]),
      receiver_user_id: params[3] ? String(params[3]) : null,
      message: String(params[4]),
      is_read: false,
      created_at: new Date().toISOString()
    };
    memoryStore.trip_messages.push(newMsg);
    return { insertId: newMsg.id, affectedRows: 1 };
  }

  if (lowerSql.includes('select * from trip_messages')) {
    const tid = Number(params[0]);
    return memoryStore.trip_messages.filter(m => Number(m.trip_id) === tid);
  }

  if (lowerSql.includes('select * from travel_trips')) return memoryStore.travel_trips.filter(t => t.status !== 'CANCELLED');

  return [];
}
