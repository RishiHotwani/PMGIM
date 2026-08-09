import * as database from '../server/config/database.js';

async function insertPlaces() {
  await database.initDatabase();

  const newPlaces = [
    [
      'Chapora River Cruises & Kayaking',
      'Beaches',
      4.8,
      '26 km · 40 min scooter',
      '₹800 for Sunset Cruise',
      'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80',
      false,
      'Scenic northern river ideal for white river rafting, kayaking, and serene sunset houseboat cruises with appetizers & sea breeze.',
      'https://www.google.com/maps/search/?api=1&query=Chapora+River+Goa',
      '4:00 PM – 7:00 PM (Sunset Houseboat)',
      '₹800 / person',
      'Book the evening sunset cruise for calm waters and stunning sky colors.'
    ],
    [
      "Tito's Street (Baga Nightlife Hub)",
      'Nightlife',
      4.7,
      '32 km · 50 min scooter',
      '₹1000 couple / ₹2000 stag',
      'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=800&q=80',
      false,
      "Goa's iconic party lane lined with famous neon-lit nightclubs, energetic dance floors, guest DJs, and open-air cocktail bars.",
      'https://www.google.com/maps/search/?api=1&query=Tito+Street+Baga+Goa',
      '9:00 PM – 3:00 AM',
      '₹1000 / couple',
      'Free entry for ladies on select theme nights; arrive by 10 PM to avoid long queues.'
    ],
    [
      'Club Cubana ("Nightclub in the Sky")',
      'Nightlife',
      4.8,
      '30 km · 45 min scooter',
      '₹1500 per couple',
      'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=800&q=80',
      false,
      'Multi-level hilltop nightclub in Arpora with a poolside dance lounge, revolving strobe lights, and breathtaking night views.',
      'https://www.google.com/maps/search/?api=1&query=Club+Cubana+Arpora+Goa',
      '9:30 PM – 4:00 AM (Wed Ladies Night)',
      '₹1500 / couple',
      'Wednesday is Ladies Night with free entry & complimentary drinks for women.'
    ],
    [
      'Deltin Royale Casino Cruise',
      'Nightlife',
      4.9,
      '24 km · 35 min scooter',
      '₹2500 per person',
      'https://images.unsplash.com/photo-1511193311914-0346f16efe90?auto=format&fit=crop&w=800&q=80',
      false,
      'Luxury casino vessel docked on Mandovi River in Panjim, offering Vegas-style gaming tables, live entertainment, ballrooms & buffet dining.',
      'https://www.google.com/maps/search/?api=1&query=Deltin+Royale+Casino+Panjim+Goa',
      '8:00 PM – 2:00 AM',
      '₹2500 / person (includes food & drinks)',
      'Formal or smart casual dress code is strictly required for entry on board.'
    ],
    [
      'Mambos Nightclub (Baga Beach)',
      'Nightlife',
      4.6,
      '32 km · 50 min scooter',
      '₹1000 per couple',
      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80',
      false,
      "High-energy beachfront club on Tito's Lane known for international acoustic & EDM DJs, laser light shows, and signature cocktails.",
      'https://www.google.com/maps/search/?api=1&query=Mambos+Nightclub+Baga+Goa',
      '10:00 PM – 3:30 AM',
      '₹1000 / couple',
      'Try the signature Goan passion fruit cocktails and wood-fired pizzas.'
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
