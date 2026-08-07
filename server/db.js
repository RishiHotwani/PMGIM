import mysql from 'mysql2/promise';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'antigravity_user',
  password: process.env.DB_PASSWORD || 'GATE2026',
  database: process.env.DB_NAME || 'travelappgim',
};

let pool = null;
let isInMemoryFallback = false;

// In-Memory Fallback Storage if MySQL service is unreachable
const memoryStore = {
  users: [
    {
      id: 1,
      name: 'Suraj K',
      email: 'suraj.k@gim.ac.in',
      avatar: 'SK',
      batch: 'PGDM 2026',
      section: 'Sec B',
      phone: '+91 9876543210',
      password_hash: 'demo123',
      created_at: new Date()
    }
  ],
  rentals: [],
  explore_places: [],
  travel_trips: [],
  user_activities: []
};

export async function initDatabase() {
  try {
    // 1. Try connecting without database to ensure DB exists
    const rootConn = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password,
    });

    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_CONFIG.database}\`;`);
    await rootConn.end();

    // 2. Create Connection Pool
    pool = mysql.createPool({
      ...DB_CONFIG,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // 3. Create Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        avatar VARCHAR(10) DEFAULT 'SK',
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
        user_id INT DEFAULT 1,
        user_name VARCHAR(255) DEFAULT 'Suraj K',
        activity_type VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address VARCHAR(100) DEFAULT '127.0.0.1'
      ) ENGINE=InnoDB;
    `);

    console.log('✅ Connected to MySQL database:', DB_CONFIG.database);
    await seedInitialData();

  } catch (err) {
    console.warn('⚠️ Could not connect to MySQL server at', `${DB_CONFIG.host}:${DB_CONFIG.port}`, 'Error:', err.message);
    console.warn('🔄 Initializing in-memory database fallback to ensure seamless local operation.');
    isInMemoryFallback = true;
    seedMemoryData();
  }
}

async function seedInitialData() {
  // Check rentals count
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

  // Check explore_places count
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

  // Check travel_trips count
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

  // Seed initial log
  await pool.query(
    'INSERT INTO user_activities (user_id, user_name, activity_type, description, details) VALUES (?, ?, ?, ?, ?)',
    [1, 'Suraj K', 'SYSTEM_INIT', 'Application started and MySQL database connection established', 'Connected to MySQL server travelappgim']
  );
}

function seedMemoryData() {
  memoryStore.rentals = [
    { id: 1, title: 'Honda Activa 6G', vendor: 'Coastal Rides Sanquelim', price_per_day: 350, rating: 4.8, total_ratings: 132, distance: '1.2 km away', fuel: 'Petrol', transmission: 'Automatic', tags: 'Women friendly', image: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80', is_available: true },
    { id: 2, title: 'Royal Enfield Hunter 350', vendor: 'Goa Bike Rentals', price_per_day: 750, rating: 4.9, total_ratings: 88, distance: '0.8 km away', fuel: 'Petrol', transmission: 'Manual', tags: 'Popular choice', image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=800&q=80', is_available: true },
    { id: 3, title: 'Maruti Suzuki Swift', vendor: 'Sanq Cabs & Self Drive', price_per_day: 1800, rating: 4.7, total_ratings: 54, distance: '2.0 km away', fuel: 'Petrol', transmission: 'Manual', tags: 'AC Sedan', image: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80', is_available: true },
    { id: 4, title: 'TVS Jupiter 125', vendor: 'Campus Wheels', price_per_day: 320, rating: 4.6, total_ratings: 95, distance: '0.5 km away', fuel: 'Petrol', transmission: 'Automatic', tags: 'Budget friendly', image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80', is_available: true }
  ];
  memoryStore.explore_places = [
    { id: 1, name: 'Arambol Beach', category: 'Beaches', rating: 4.7, distance: '38 km · 1 hr 10 min scooter', price: '₹400 per person', image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', is_bookmarked: false },
    { id: 2, name: "Britto's, Baga", category: 'Food', rating: 4.4, distance: '33 km · 1 hr scooter', price: '₹700 per person', image: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', is_bookmarked: false },
    { id: 3, name: 'Dudhsagar Falls', category: 'Waterfalls', rating: 4.9, distance: '72 km · 2 hr 15 min', price: '₹1200 per person', image: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80', is_bookmarked: true },
    { id: 4, name: 'Manipal Health Hospital', category: 'Hospital', rating: 4.5, distance: '12 km · 20 min', price: 'Emergency care', image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=800&q=80', is_bookmarked: false }
  ];
  memoryStore.travel_trips = [
    { id: 1, user_name: 'Aarav Mehta', user_initials: 'AM', batch_info: 'PGDM 2026 · Sec B', title: 'Dabolim Airport drop', pickup: 'GIM Main Gate', date_time: 'Sat, 8 Aug · departs 5:30 AM', seats_left: 2, seats_total: 4, vehicle_type: 'Cab', cost: '₹600 each', description: 'Pre-booked Innova from GIM main gate. Please be on time, flight at 9:10 AM.', status: 'Today' },
    { id: 2, user_name: 'Ishita Rao', user_initials: 'IR', batch_info: 'PGDM 2026 · Sec A', title: 'Dudhsagar day trip', pickup: 'GIM Main Gate', date_time: 'Sun, 9 Aug · departs 6:00 AM', seats_left: 3, seats_total: 6, vehicle_type: 'Car', cost: '₹850 each', description: 'Self-drive Ertiga from Bicholim Motors. Back on campus by 5 PM.', status: 'Upcoming' }
  ];
  memoryStore.user_activities.push({
    id: 1,
    user_id: 1,
    user_name: 'Suraj K',
    activity_type: 'SYSTEM_INIT',
    description: 'In-memory database fallback active',
    details: 'Operating in memory mode',
    timestamp: new Date().toISOString(),
    ip_address: '127.0.0.1'
  });
}

// Database helper functions supporting both MySQL pool & in-memory fallback
export async function query(sql, params = []) {
  if (!isInMemoryFallback && pool) {
    const [results] = await pool.query(sql, params);
    return results;
  }
  // Simple in-memory handler for queries used by REST API
  const lowerSql = sql.toLowerCase();
  
  if (lowerSql.includes('select * from rentals')) {
    return memoryStore.rentals;
  }
  if (lowerSql.includes('select * from explore_places')) {
    return memoryStore.explore_places;
  }
  if (lowerSql.includes('select * from travel_trips')) {
    return memoryStore.travel_trips;
  }
  if (lowerSql.includes('select * from user_activities')) {
    return [...memoryStore.user_activities].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
  if (lowerSql.includes('insert into user_activities')) {
    const newAct = {
      id: memoryStore.user_activities.length + 1,
      user_id: params[0] || 1,
      user_name: params[1] || 'Suraj K',
      activity_type: params[2],
      description: params[3],
      details: params[4] || '',
      timestamp: new Date().toISOString(),
      ip_address: '127.0.0.1'
    };
    memoryStore.user_activities.push(newAct);
    return { insertId: newAct.id };
  }
  if (lowerSql.includes('insert into travel_trips')) {
    const newTrip = {
      id: memoryStore.travel_trips.length + 1,
      user_name: params[0],
      user_initials: params[1],
      batch_info: params[2],
      title: params[3],
      pickup: params[4],
      date_time: params[5],
      seats_left: parseInt(params[6]),
      seats_total: parseInt(params[7]),
      vehicle_type: params[8],
      cost: params[9],
      description: params[10],
      status: params[11] || 'Today'
    };
    memoryStore.travel_trips.unshift(newTrip);
    return { insertId: newTrip.id };
  }
  if (lowerSql.includes('update travel_trips set seats_left')) {
    const tripId = params[0];
    const trip = memoryStore.travel_trips.find(t => t.id == tripId);
    if (trip && trip.seats_left > 0) {
      trip.seats_left -= 1;
    }
    return { affectedRows: 1 };
  }
  if (lowerSql.includes('update explore_places set is_bookmarked')) {
    const placeId = params[0];
    const place = memoryStore.explore_places.find(p => p.id == placeId);
    if (place) {
      place.is_bookmarked = !place.is_bookmarked;
    }
    return { affectedRows: 1 };
  }
  if (lowerSql.includes('select * from users where email')) {
    return memoryStore.users.filter(u => u.email === params[0]);
  }
  if (lowerSql.includes('insert into users')) {
    const newUser = {
      id: memoryStore.users.length + 1,
      name: params[0],
      email: params[1],
      avatar: params[2] || 'SK',
      batch: params[3] || 'PGDM 2026',
      section: params[4] || 'Sec A',
      phone: params[5] || '',
      password_hash: params[6],
      created_at: new Date()
    };
    memoryStore.users.push(newUser);
    return { insertId: newUser.id };
  }
  return [];
}

export function logActivity(userId, userName, type, description, details = '') {
  const sql = 'INSERT INTO user_activities (user_id, user_name, activity_type, description, details) VALUES (?, ?, ?, ?, ?)';
  return query(sql, [userId || 1, userName || 'Suraj K', type, description, details]);
}
