import { getPayload } from 'payload';
import config from '@payload-config';

const categories = [
  // … your existing categories …
  {
    name: 'All',
    slug: 'all'
  },
  {
    name: 'Writing & Publishing',
    color: '#D8B5FF',
    slug: 'writing-publishing',
    subcategories: [
      { name: 'Notebooks', slug: 'notebooks' },
      { name: 'Writing devices', slug: 'writing-devices' },
      { name: 'Calligraphy', slug: 'calligraphy' },
      { name: 'Planners & Bullet Journals', slug: 'planners-bullet-journals' }
    ]
  },

  {
    name: 'Fitness & Health',
    color: '#FF9AA2',
    slug: 'fitness-health',
    subcategories: [
      { name: 'Workout Equipment', slug: 'workout-equipment' },
      { name: 'Yoga & Mindfulness', slug: 'yoga-mindfulness' },
      { name: 'Wearable Trackers', slug: 'wearable-trackers' }
    ]
  },
  {
    name: 'Electronics',
    color: '#96E6B3',
    slug: 'electronics',
    subcategories: [
      {
        name: 'Computers',
        slug: 'computers',
        subcategories: [
          { name: 'Single Board Computers', slug: 'single-board-computers' },
          { name: 'Drones & RC', slug: 'drones-rc' },
          { name: 'VR & Wearables', slug: 'vr-wearables' }
        ]
      },
      { name: 'Components', slug: 'components' }
    ]
  },
  {
    name: 'Music',
    color: '#FFD700',
    slug: 'music',
    subcategories: [
      { name: 'Musical Instruments', slug: 'musical-instruments' },
      { name: 'Compact Discs', slug: 'compact-discs' },
      { name: 'Records', slug: 'records' },
      { name: 'Casette Tapes', slug: 'cassette-tapes' },
      { name: 'Other', slug: 'Other' },
      { name: 'Synthesizers & MIDI', slug: 'synthesizers-midi' },
      { name: 'Pedals & Effects', slug: 'pedals-effects' },
      { name: 'Digital Audio Workstations', slug: 'daws' }
    ]
  },
  {
    name: 'Photography',
    color: '#FF6B6B',
    slug: 'photography',
    subcategories: [
      { name: 'Cameras', slug: 'cameras' },
      { name: 'Camera Equipment', slug: 'camera-equipment' },
      // inside Photography subcategories
      { name: 'Film Photography', slug: 'film-photography' },
      { name: 'Instant Cameras & Film', slug: 'instant-cameras-film' }
    ]
  },

  // Revamp the Crafts & Hobbies group:
  {
    name: 'Crafts & Hobbies',
    color: '#B5B9FF',
    slug: 'crafts-hobbies',
    subcategories: [
      { name: 'Knitting', slug: 'knitting' },
      { name: 'Crocheting', slug: 'crocheting' },
      { name: 'Scrapbooking', slug: 'scrapbooking' },
      { name: 'Pottery', slug: 'pottery' },
      { name: 'Woodworking', slug: 'woodworking' },
      { name: 'Model Building', slug: 'model-building' },
      { name: 'LEGO & Building Blocks', slug: 'lego-building-blocks' },
      { name: 'Homebrewing & Fermentation', slug: 'homebrewing-fermentation' }
    ]
  },
  {
    name: 'Drawing & Painting',
    color: '#FFB347',
    slug: 'drawing-painting',
    subcategories: [
      { name: 'Charcoal', slug: 'charcoal' },
      { name: 'Pastel', slug: 'pastel' },
      { name: 'Oil', slug: 'oil' },
      { name: 'Acrylic', slug: 'acrylic' },
      { name: 'Watercolor', slug: 'watercolor' },
      { name: 'Other Supplies', slug: 'other-supplies' },
      { name: 'Completed Artwork', slug: 'completed-artwork' }
    ]
  },

  // Gaming:
  {
    name: 'Gaming',
    color: '#8BD3DD',
    slug: 'gaming',
    subcategories: [
      { name: 'Board Games', slug: 'board-games' },
      { name: 'Video Games', slug: 'video-games' },
      { name: 'Tabletop RPGs', slug: 'tabletop-rpgs' },
      { name: 'Card Games', slug: 'card-games' }
    ]
  },

  // Mind Games & Puzzles:
  {
    name: 'Mind Games & Puzzles',
    color: '#FF6F91',
    slug: 'mind-games-puzzles',
    subcategories: [
      { name: 'Jigsaw Puzzles', slug: 'jigsaw-puzzles' },
      { name: 'Crossword Puzzles', slug: 'crossword-puzzles' },
      { name: 'Sudoku', slug: 'sudoku' },
      { name: "Rubik's Cubes", slug: 'rubiks-cubes' }
    ]
  },

  // Collecting:
  {
    name: 'Collecting',
    color: '#C3F584',
    slug: 'collecting',
    subcategories: [
      { name: 'Coins', slug: 'coins' },
      { name: 'Stamps', slug: 'stamps' },
      { name: 'Action Figures', slug: 'action-figures' },
      { name: 'Trading Cards', slug: 'trading-cards' }
    ]
  },

  // Tech & DIY:
  {
    name: 'Tech & DIY',
    color: '#A0E7E5',
    slug: 'tech-diy',
    subcategories: [
      { name: '3D Printing', slug: '3d-printing' },
      { name: 'Arduino Projects', slug: 'arduino-projects' },
      { name: 'Raspberry Pi', slug: 'raspberry-pi' },
      { name: 'Electronics Kits', slug: 'electronics-kits' }
    ]
  },

  // Cooking & Baking:
  {
    name: 'Cooking & Baking',
    color: '#FFDAC1',
    slug: 'cooking-baking',
    subcategories: [
      { name: 'Baking', slug: 'baking' },
      { name: 'Meal Prep', slug: 'meal-prep' },
      { name: 'Cake Decorating', slug: 'cake-decorating' },
      { name: 'Bread Making', slug: 'bread-making' }
    ]
  },

  // Outdoors & Adventure:
  {
    name: 'Outdoors & Adventure',
    color: '#B5FFB8',
    slug: 'outdoors-adventure',
    subcategories: [
      { name: 'Hiking', slug: 'hiking' },
      { name: 'Gardening', slug: 'gardening' },
      { name: 'Camping', slug: 'camping' },
      { name: 'Rock Climbing', slug: 'rock-climbing' }
    ]
  },
  {
    name: 'Books & Literature',
    color: '#AEDFF7',
    slug: 'books-literature',
    subcategories: [
      { name: 'Fiction', slug: 'fiction' },
      { name: 'Non‑Fiction', slug: 'non-fiction' },
      { name: 'Graphic Novels', slug: 'graphic-novels' },
      { name: 'Manga & Comics', slug: 'manga-comics' }
    ]
  },
  {
    name: 'Movies & TV',
    color: '#F7E9AE',
    slug: 'movies-tv',
    subcategories: [
      { name: 'Blu‑ray & DVD', slug: 'blu-ray-dvd' },
      { name: 'Streaming Gear', slug: 'streaming-gear' },
      { name: 'Posters & Merch', slug: 'posters-merch' }
    ]
  },
  {
    name: 'Language Learning',
    color: '#D3F7AE',
    slug: 'language-learning',
    subcategories: [
      { name: 'Textbooks', slug: 'textbooks' },
      { name: 'Audio Courses', slug: 'audio-courses' },
      { name: 'Flashcards', slug: 'flashcards' }
    ]
  }
];

const seed = async () => {
  const payload = await getPayload({ config });

  for (const category of categories) {
    // Check if parent category already exists
    const existingParent = await payload.find({
      collection: 'categories',
      where: { slug: { equals: category.slug } },
      limit: 1
    });

    let parentCategory;

    if (existingParent.docs.length > 0) {
      console.log(`Skipping existing category: ${category.slug}`);
      parentCategory = existingParent.docs[0];
    } else {
      parentCategory = await payload.create({
        collection: 'categories',
        data: {
          name: category.name,
          slug: category.slug,
          color: category.color,
          parent: null
        }
      });
      console.log(`Created category: ${category.slug}`);
    }

    for (const subCategory of category.subcategories || []) {
      const existingSub = await payload.find({
        collection: 'categories',
        where: { slug: { equals: subCategory.slug } },
        limit: 1
      });

      if (existingSub.docs.length > 0) {
        console.log(`Skipping existing subcategory: ${subCategory.slug}`);
        continue;
      }

      await payload.create({
        collection: 'categories',
        data: {
          name: subCategory.name,
          slug: subCategory.slug,
          parent: parentCategory.id
        }
      });

      console.log(`Created subcategory: ${subCategory.slug}`);
    }
  }
};

try {
  await seed();
  console.log('Seeding completed.');
  process.exit(0);
} catch (error) {
  console.error('Error during seed: ', error);
  process.exit(1);
}
