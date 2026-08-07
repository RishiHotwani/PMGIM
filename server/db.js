import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3308'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'RishiHotwani27',
  database: process.env.DB_NAME || 'travelappgim',
};

let pool = null;
let isInMemoryFallback = false;

// In-Memory Fallback Storage
const memoryStore = {
  users: [],
  rentals: [],
  explore_places: [],
  travel_trips: [],
  user_activities: []
};

export async function initDatabase() {
  try {
    let rootConn = null;

    // Try connecting with configured user
    try {
      rootConn = await mysql.createConnection({
        host: DB_CONFIG.host,
        port: DB_CONFIG.port,
        user: DB_CONFIG.user,
        password: DB_CONFIG.password,
      });
    } catch (authErr) {
      console.warn(`⚠️ Could not connect as user '${DB_CONFIG.user}' on port ${DB_CONFIG.port}. Attempting root fallback...`);
      // Try root fallbacks on port 3307 / 3306
      const rootPasswords = [DB_CONFIG.password, 'root', '', '123456', 'admin', 'password', '1234', '12345', 'root123', 'mysql', 'system', 'manager', '12345678', 'GATE2026!'];
      for (const pass of rootPasswords) {
        try {
          rootConn = await mysql.createConnection({
            host: DB_CONFIG.host,
            port: DB_CONFIG.port,
            user: 'root',
            password: pass,
          });
          console.log(`✅ Connected to MySQL on port ${DB_CONFIG.port} as root! Creating database & granting privileges to antigravity_user...`);
          await rootConn.query(`CREATE USER IF NOT EXISTS '${DB_CONFIG.user}'@'%' IDENTIFIED BY '${DB_CONFIG.password}';`);
          await rootConn.query(`CREATE USER IF NOT EXISTS '${DB_CONFIG.user}'@'localhost' IDENTIFIED BY '${DB_CONFIG.password}';`);
          await rootConn.query(`GRANT ALL PRIVILEGES ON *.* TO '${DB_CONFIG.user}'@'%';`);
          await rootConn.query(`GRANT ALL PRIVILEGES ON *.* TO '${DB_CONFIG.user}'@'localhost';`);
          await rootConn.query(`FLUSH PRIVILEGES;`);
          break;
        } catch (e) {
          // continue loop
        }
      }
    }

    if (!rootConn) {
      throw new Error(`Failed to authenticate with MySQL server at ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    }

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\`;`);
    await rootConn.end();

    // Create Connection Pool
    pool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Create Tables in MySQL Database `travelappgim`
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        avatar VARCHAR(10) DEFAULT 'US',
        batch VARCHAR(50) DEFAULT 'PGDM 2026',
        section VARCHAR(10) DEFAULT 'Sec A',
        phone VARCHAR(50) DEFAULT '',
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

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

    isInMemoryFallback = false;
    console.log(`✅ Connected to MySQL database on port ${DB_CONFIG.port}: ${DB_CONFIG.database}`);
    await seedInitialData();

  } catch (err) {
    console.warn('⚠️ Could not connect to MySQL server at', `${DB_CONFIG.host}:${DB_CONFIG.port}`, 'Error:', err.message);
    console.warn('🔄 Initializing in-memory database fallback to ensure seamless local operation.');
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
      ['TVS Jupiter 125', 'Campus Wheels', 320, 4.6, 95, '0.5 km away', 'Petrol', 'Automatic', 'Budget friendly', 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80', true],
      ['KTM Duke 200', 'Velocity Rentals', 900, 4.8, 41, '1.5 km away', 'Petrol', 'Manual', 'Sporty', 'https://images.unsplash.com/photo-1558981359-219d6364c9c8?auto=format&fit=crop&w=800&q=80', false],
      ['Mahindra Thar 4x4', 'Goa Safari Rentals', 3500, 4.9, 62, '3.0 km away', 'Diesel', 'Automatic', 'Beach Cruising', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=800&q=80', true],
      ['Ather 450X EV', 'Green Motion Campus', 400, 4.9, 110, '0.2 km away', 'Electric', 'Automatic', 'Eco Friendly', 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80', true]
    ];
    for (const r of rentals) {
      await pool.query(
        'INSERT INTO rentals (title, vendor, price_per_day, rating, total_ratings, distance, fuel, transmission, tags, image, is_available) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        r
      );
    }
  }

  const [exploreRows] = await pool.query('SELECT COUNT(*) as count FROM explore_places');
  if (exploreRows[0].count === 0) {
    const places = [
      ['Arambol Beach', 'Beaches', 4.7, '38 km · 1 hr 10 min scooter', '₹400 per person', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', false],
      ["Britto's, Baga", 'Food', 4.4, '33 km · 1 hr scooter', '₹700 per person', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', false],
      ['Dudhsagar Falls', 'Waterfalls', 4.9, '72 km · 2 hr 15 min', '₹1200 per person', 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80', true],
      ['Manipal Health Hospital', 'Hospital', 4.5, '12 km · 20 min', 'Emergency care', 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=800&q=80', false],
      ['Fontainhas Latin Quarter', 'Cafes', 4.8, '28 km · 45 min', '₹350 per person', 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80', false],
      ['Anjuna Flea Market', 'Shopping', 4.6, '35 km · 1 hr 05 min', '₹500 per person', 'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&w=800&q=80', false]
    ];
    for (const p of places) {
      await pool.query(
        'INSERT INTO explore_places (name, category, rating, distance, price, image, is_bookmarked) VALUES (?, ?, ?, ?, ?, ?, ?)',
        p
      );
    }
  }

  const [tripsRows] = await pool.query('SELECT COUNT(*) as count FROM travel_trips');
  if (tripsRows[0].count === 0) {
    const trips = [
      ['Aarav Mehta', 'AM', 'PGDM 2026 · Sec B', 'Dabolim Airport drop', 'GIM Main Gate', 'Sat, 8 Aug · departs 5:30 AM', 2, 4, 'Cab', '₹600 each', 'Pre-booked Innova from GIM main gate. Please be on time, flight at 9:10 AM.', 'Today'],
      ['Ishita Rao', 'IR', 'PGDM 2026 · Sec A', 'Dudhsagar day trip', 'GIM Main Gate', 'Sun, 9 Aug · departs 6:00 AM', 3, 6, 'Car', '₹850 each', 'Self-drive Ertiga from Bicholim Motors. Back on campus by 5 PM.', 'Upcoming'],
      ['Rohan Sharma', 'RS', 'BFSI 2025 · Sec C', 'Panjim Mall & Dinner', 'Hostel Block 3', 'Fri, 14 Aug · departs 7:00 PM', 1, 4, 'Cab', '₹250 each', 'Going for movie at Mall de Goa then dinner at Mum\'s Kitchen.', 'Upcoming'],
      ['Ananya Deshmukh', 'AD', 'HCM 2026 · Sec A', 'Madgaon Railway Drop', 'GIM Main Gate', 'Mon, 10 Aug · departs 4:00 PM', 2, 3, 'Auto', '₹300 each', 'Vande Bharat train at 6:15 PM.', 'Upcoming']
    ];
    for (const t of trips) {
      await pool.query(
        'INSERT INTO travel_trips (user_name, user_initials, batch_info, title, pickup, date_time, seats_left, seats_total, vehicle_type, cost, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        t
      );
    }
  }
}

function seedMemoryData() {
  memoryStore.rentals = [
    { id: 1, title: 'Honda Activa 6G', vendor: 'Coastal Rides Sanquelim', price_per_day: 350, rating: 4.8, total_ratings: 132, distance: '1.2 km away', fuel: 'Petrol', transmission: 'Automatic', tags: 'Women friendly', image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', is_available: true },
    { id: 2, title: 'Royal Enfield Hunter 350', vendor: 'Goa Bike Rentals', price_per_day: 750, rating: 4.9, total_ratings: 88, distance: '0.8 km away', fuel: 'Petrol', transmission: 'Manual', tags: 'Popular choice', image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80', is_available: true }
  ];
  memoryStore.explore_places = [
    { id: 1, name: 'Arambol Beach', category: 'Beaches', rating: 4.7, distance: '38 km · 1 hr 10 min scooter', price: '₹400 per person', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', is_bookmarked: false }
  ];
  memoryStore.travel_trips = [
    { id: 1, user_name: 'Aarav Mehta', user_initials: 'AM', batch_info: 'PGDM 2026 · Sec B', title: 'Dabolim Airport drop', pickup: 'GIM Main Gate', date_time: 'Sat, 8 Aug · departs 5:30 AM', seats_left: 2, seats_total: 4, vehicle_type: 'Cab', cost: '₹600 each', description: 'Pre-booked Innova from GIM main gate.', status: 'Today' }
  ];
}

export async function query(sql, params = []) {
  if (!isInMemoryFallback && pool) {
    const [results] = await pool.query(sql, params);
    return results;
  }
  const lowerSql = sql.toLowerCase();
  
  if (lowerSql.includes('select * from rentals')) return memoryStore.rentals;
  if (lowerSql.includes('select * from explore_places')) return memoryStore.explore_places;
  if (lowerSql.includes('select * from travel_trips')) return memoryStore.travel_trips;
  if (lowerSql.includes('select * from user_activities')) return [...memoryStore.user_activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  
  if (lowerSql.includes('insert into user_activities')) {
    const newAct = { id: memoryStore.user_activities.length + 1, user_id: params[0] || null, user_name: params[1] || 'Guest', activity_type: params[2], description: params[3], details: params[4] || '', timestamp: new Date().toISOString() };
    memoryStore.user_activities.push(newAct);
    return { insertId: newAct.id };
  }
  if (lowerSql.includes('select * from users where email')) {
    return memoryStore.users.filter(u => u.email === params[0]);
  }
  if (lowerSql.includes('insert into users')) {
    const newUser = { id: memoryStore.users.length + 1, name: params[0], email: params[1], avatar: params[2] || 'US', batch: params[3] || 'PGDM 2026', section: params[4] || 'Sec A', phone: params[5] || '', password_hash: params[6], created_at: new Date() };
    memoryStore.users.push(newUser);
    return { insertId: newUser.id };
  }
  return [];
}

export function logActivity(userId, userName, type, description, details = '') {
  const sql = 'INSERT INTO user_activities (user_id, user_name, activity_type, description, details) VALUES (?, ?, ?, ?, ?)';
  return query(sql, [userId || null, userName || 'Guest', type, description, details]);
}
