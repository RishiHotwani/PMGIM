import * as database from '../server/config/database.js';

async function insertPlaces() {
  await database.initDatabase();

  const newPlaces = [
    [
      'Bondla Wildlife Sanctuary',
      'Waterfalls',
      4.7,
      '18 km · 30 min scooter',
      '₹5 entry',
      'https://images.unsplash.com/photo-1534567153574-2b12153a87f0?auto=format&fit=crop&w=800&q=80',
      false,
      "Goa's famous compact wildlife reserve featuring spotted deer parks, botanical gardens, nature trails, and rare forest birds.",
      'https://www.google.com/maps/search/?api=1&query=Bondla+Wildlife+Sanctuary+Goa',
      '9:00 AM – 5:00 PM',
      '₹5 / person',
      'Great for morning wildlife photography and peaceful forest walks.'
    ],
    [
      'Sahakari Spice Plantations (Ponda)',
      'Food',
      4.8,
      '20 km · 35 min scooter',
      '₹500 buffet & tour',
      'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?auto=format&fit=crop&w=800&q=80',
      false,
      'Lush 130-acre organic spice farm with guided aromatic tours, spice tea tastings, and traditional Goan buffet lunch served on banana leaves.',
      'https://www.google.com/maps/search/?api=1&query=Sahakari+Spice+Farm+Ponda+Goa',
      '10:00 AM – 3:00 PM (Lunch & Tour)',
      '₹500 / person',
      'Includes welcome spice tea and traditional buffet lunch with authentic Goan curry.'
    ],
    [
      'Verna Springs (Kesarval Springs)',
      'Waterfalls',
      4.6,
      '32 km · 50 min scooter',
      'Free Entry',
      'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=800&q=80',
      false,
      'Natural freshwater springs gushing from forest cliffs, famous for crystal clear medicinal waters and peaceful jungle surroundings.',
      'https://www.google.com/maps/search/?api=1&query=Kesarval+Verna+Springs+Goa',
      '9:00 AM – 5:00 PM (Monsoon & Winter)',
      'Free Entry',
      'Bring spare clothes if you plan to dip in the natural mineral spring water.'
    ],
    [
      'Lamgau Rock-Cut Caves (Bicholim)',
      'Shopping',
      4.7,
      '8 km · 15 min scooter',
      'Free Entry',
      'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80',
      false,
      'Hidden ancient 5th-century rock-cut Buddhist & Hindu caves nestled in dense areca nut plantations right near Bicholim campus.',
      'https://www.google.com/maps/search/?api=1&query=Lamgau+Caves+Bicholim+Goa',
      '9:00 AM – 5:00 PM',
      'Free Entry',
      'Short scenic trek through local Goan palm groves; carry comfortable walking shoes.'
    ],
    [
      'Shri Mangueshi Temple (Ponda)',
      'Shopping',
      4.9,
      '22 km · 35 min scooter',
      'Free Entry',
      'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?auto=format&fit=crop&w=800&q=80',
      false,
      '400-year-old architectural masterpiece featuring a famous 7-storeyed octagonal lamp tower (Deepastambha) & sacred temple tank.',
      'https://www.google.com/maps/search/?api=1&query=Mangueshi+Temple+Ponda+Goa',
      '6:00 AM – 1:00 PM, 4:00 PM – 9:00 PM',
      'Free Entry',
      'Illuminated beautifully with hundreds of oil lamps during evening aarti.'
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
