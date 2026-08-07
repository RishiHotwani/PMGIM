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

    // 1. Create place_reviews table
    await conn.query(`
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
    console.log('Successfully created place_reviews table');

    // 2. Add columns to explore_places
    const placeCols = [
      "ADD COLUMN description TEXT NULL",
      "ADD COLUMN maps_url VARCHAR(500) NULL",
      "ADD COLUMN best_time VARCHAR(255) DEFAULT '5:00 PM – 7:00 PM (Sunset)'",
      "ADD COLUMN est_cost VARCHAR(100) DEFAULT '₹400 / person'",
      "ADD COLUMN pro_tips TEXT NULL"
    ];

    for (const c of placeCols) {
      try {
        await conn.query(`ALTER TABLE explore_places ${c};`);
        console.log(`Successfully executed: ALTER TABLE explore_places ${c}`);
      } catch (err) {
        console.log(`Column status (${c.split(' ')[2]}): ${err.message}`);
      }
    }

    // Populate initial Google Maps URLs, Best Times, and Pro Tips for default places
    await conn.query(`
      UPDATE explore_places SET 
        maps_url = 'https://www.google.com/maps/search/?api=1&query=Arambol+Beach+Goa',
        best_time = '5:00 PM – 7:30 PM (Sunset & Drum Circle)',
        est_cost = '₹300 – ₹500 / person',
        description = 'Famous for its bohemian vibes, freshwater lake, cliffside cafes, and iconic sunset drum circles.',
        pro_tips = 'Visit around 5 PM to see the famous beach drum circle. Park scooters near the cliffside entrance.'
      WHERE name LIKE '%Arambol%';
    `);

    await conn.query(`
      UPDATE explore_places SET 
        maps_url = 'https://www.google.com/maps/search/?api=1&query=Brittos+Baga+Goa',
        best_time = '7:00 PM – 11:00 PM (Dinner & Music)',
        est_cost = '₹700 – ₹1200 / person',
        description = 'Legendary beachside restaurant in Baga known for fresh seafood, Goan fish curry, and sea breezes.',
        pro_tips = 'Try the butter garlic prawns and pork vindaloo. Pre-book a table on weekend evenings.'
      WHERE name LIKE '%Britto%';
    `);

    await conn.query(`
      UPDATE explore_places SET 
        maps_url = 'https://www.google.com/maps/search/?api=1&query=Dudhsagar+Waterfalls+Goa',
        best_time = '9:00 AM – 2:00 PM (Day Trip)',
        est_cost = '₹1200 – ₹1500 / person',
        description = 'Four-tiered waterfall located on the Mandovi River, offering breathtaking forest views and jeep treks.',
        pro_tips = 'Life jackets are mandatory for swimming. Carry extra dry clothes and water bottles.'
      WHERE name LIKE '%Dudhsagar%';
    `);

    // Seed initial reviews if empty
    const [reviewsRows] = await conn.query('SELECT COUNT(*) as count FROM place_reviews');
    if (reviewsRows[0].count === 0) {
      await conn.query(`
        INSERT INTO place_reviews (place_id, user_name, user_avatar, rating, comment) VALUES
        (1, 'Rishi Hotwani', 'RH', 5, 'The sunset drum circle at Arambol is an unmatched experience! Highly recommend renting a scooter from campus.'),
        (1, 'Aarav Mehta', 'AM', 4, 'Great beach with sweet freshwater lake nearby. A bit far from GIM (1hr 10m), but worth the drive!'),
        (2, 'Suraj K', 'SK', 5, 'Best Goan fish curry rice and chilled beer by the beach. Service is super fast.'),
        (3, 'Neha Sharma', 'NS', 5, 'Dudhsagar is magical during monsoons. Make sure to start early from GIM campus at 6 AM.');
      `);
    }

    await conn.end();
    console.log('✅ Explore Goa migration complete!');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

migrate();
