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
      } catch (err) {}
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

    // Insert new article spots if missing
    const articleSpots = [
      ['Ashwem Beach & La Plage', 'Beaches', 4.8, '34 km · 55 min scooter', '₹800 per person', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', false, 'Upmarket, clean North Goa beach featuring the famous French fine dining spot La Plage, frequented by celebrities.', 'https://www.google.com/maps/search/?api=1&query=La+Plage+Ashwem+Beach+Goa', '1:00 PM – 4:00 PM (Lunch & Sea Breeze)', '₹800 – ₹1500 / person', 'La Plage offers world-class French cuisine, beachside armchairs, fairy lights, and amazing steaks.'],
      ['Thalassa Greek Restaurant', 'Food', 4.9, '30 km · 50 min scooter', '₹1500 per person', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80', true, 'Legendary cliffside Greek restaurant in Siolim offering Santorini vibes, panoramic ocean sunsets, and Mediterranean grills.', 'https://www.google.com/maps/search/?api=1&query=Thalassa+Restaurant+Siolim+Goa', '5:00 PM – 8:30 PM (Sunset & Dinner)', '₹1200 – ₹2000 / person', 'Advance reservation is essential for sunset cliff tables! Features plate-breaking dance shows and Mediterranean spreads.'],
      ['Mandrem Beach & Vaayu Cafe', 'Beaches', 4.7, '36 km · 1 hr scooter', '₹450 per person', 'https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=800&q=80', false, 'Serene beach and lagoon near Ashwem with water sports, SUP rentals, organic smoothie bowls, and cozy beachside cafes.', 'https://www.google.com/maps/search/?api=1&query=Mandrem+Beach+Vaayu+Goa', '7:00 AM – 11:00 AM (Morning Run & Breakfast)', '₹400 / person', 'Quiet street vibe. Great place for morning beach runs, organic smoothie bowls, and SUP paddle boarding.'],
      ['Anjuna Flea Market & Trance Coast', 'Nightlife', 4.6, '32 km · 50 min scooter', '₹500 per person', 'https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=800&q=80', false, 'The birthplace of Goan trance music, vibrant bohemian flea markets, beach shacks, and eclectic party vibe.', 'https://www.google.com/maps/search/?api=1&query=Anjuna+Flea+Market+Goa', 'Wednesdays 10:00 AM – 6:00 PM', '₹300 – ₹600 / person', 'Bargain hard at the Wednesday flea market for silver jewelry, bohemian clothes, and handmade souvenirs.'],
      ['Pink Chilli Restaurant', 'Food', 4.7, '31 km · 48 min scooter', '₹700 per person', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80', false, 'Vibrant, highly Instagrammable North Indian restaurant with creative bohemian decor, signature cocktails, and rich curries.', 'https://www.google.com/maps/search/?api=1&query=Pink+Chilli+Restaurant+Goa', '7:30 PM – 11:00 PM (Dinner & Cocktails)', '₹600 – ₹1000 / person', 'Famous for stylish photo ops, bohemian outdoor seating, and authentic North Indian dishes.'],
      ['Querim (Keri) Beach', 'Beaches', 4.8, '42 km · 1 hr 15 min scooter', '₹300 per person', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80', false, 'The northernmost beach in Goa, famous for its peaceful pine trees, historic Terekol river estuary, and secluded coast.', 'https://www.google.com/maps/search/?api=1&query=Querim+Keri+Beach+Goa', '4:00 PM – 6:30 PM (Quiet Sunset)', '₹200 – ₹400 / person', 'Quiet and untouched compared to Baga. Take the ferry across the river to Fort Tiracol for panoramic views.']
    ];

    for (const spot of articleSpots) {
      const [existing] = await conn.query('SELECT id FROM explore_places WHERE name = ?', [spot[0]]);
      if (existing.length === 0) {
        await conn.query(
          'INSERT INTO explore_places (name, category, rating, distance, price, image, is_bookmarked, description, maps_url, best_time, est_cost, pro_tips) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          spot
        );
        console.log(`Inserted article spot: ${spot[0]}`);
      }
    }

    await conn.end();
    console.log('✅ Explore Goa migration complete!');
  } catch (err) {
    console.error('Migration error:', err);
  }
}

migrate();
