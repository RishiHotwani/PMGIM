import * as database from '../server/config/database.js';

async function insertPlaces() {
  await database.initDatabase();

  const newPlaces = [
    [
      'Cavelossim Beach (South Goa)',
      'Beaches',
      4.8,
      '70 km · 1 hr 40 min drive',
      'Free Entry',
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
      false,
      'Stunning beach in South Goa known for its unique contrast of black volcanic lava rocks against powdery white sand and River Sal estuary views.',
      'https://www.google.com/maps/search/?api=1&query=Cavelossim+Beach+South+Goa',
      '3:30 PM – 7:00 PM (Sunset)',
      'Free Entry',
      'Great spot for dolphin-spotting boat trips and peaceful evening beach walks.'
    ],
    [
      'Dolphin Watching Boat Safari',
      'Beaches',
      4.7,
      '32 km · 50 min scooter',
      '₹400 per person',
      'https://images.unsplash.com/photo-1544551763-77ef2d0cfc6c?auto=format&fit=crop&w=800&q=80',
      false,
      'Thrilling 1.5-hour ocean boat trip into the Arabian Sea to watch wild Indo-Pacific humpback dolphins frolicking near Coco Beach & Palolem.',
      'https://www.google.com/maps/search/?api=1&query=Dolphin+Watching+Boat+Trip+Goa',
      '7:00 AM – 10:00 AM (Early Morning)',
      '₹400 / person',
      'Early morning boat trips offer the highest chance of spotting active dolphin pods.'
    ]
  ];

  for (const p of newPlaces) {
    const existing = await database.query('SELECT id FROM explore_places WHERE name = ?', [p[0]]);
    if (existing.length === 0) {
      const res = await database.query(
        'INSERT INTO explore_places (name, category, rating, distance, price, image, is_bookmarked, description, maps_url, best_time, est_cost, pro_tips) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        p
      );
      console.log('Inserted:', p[0], 'id:', res.insertId);
    } else {
      console.log('Already exists:', p[0]);
    }
  }
}

insertPlaces().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
