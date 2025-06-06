// src/lib/seed.ts
import dotenv from 'dotenv';
import { getPayload } from 'payload';
import type { PayloadRequest } from 'payload/dist/types';
import config from '@payload-config'; // Adjust this path if your payload config is located elsewhere
import { stripe } from './stripe'; // Adjust this path if your stripe helper is elsewhere

dotenv.config();

interface Category {
  name: string;
  slug: string;
  color?: string;
  subcategories?: Array<{
    name: string;
    slug: string;
    subcategories?: Array<{ name: string; slug: string }>;
  }>;
}

const categories: Category[] = [
  {
    name: 'All',
    slug: 'all',
    color: '#CCCCCC'
  },
  {
    name: 'Writing & Publishing',
    color: '#D8B5FF',
    slug: 'writing-publishing',
    subcategories: [
      { name: 'Notebooks', slug: 'notebooks' },
      { name: 'Writing devices', slug: 'writing-devices' },
      { name: 'Calligraphy', slug: 'calligraphy' },
      { name: 'Planners & Bullet Journals', slug: 'planners-bullet-journals' },
      { name: 'Book restoration', slug: 'book-restoration' }
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
          { name: 'Audiophile', slug: 'audiophile' },
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
      { name: 'Other', slug: 'other' },
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
      { name: 'Film Photography', slug: 'film-photography' },
      { name: 'Instant Cameras & Film', slug: 'instant-cameras-film' }
    ]
  },
  {
    name: 'Crafts & Hobbies',
    color: '#B5B9FF',
    slug: 'crafts-hobbies',
    subcategories: [
      { name: 'Astrology', slug: 'astrology' },
      { name: 'Astronomy', slug: 'astronomy' },
      { name: 'Knitting', slug: 'knitting' },
      { name: 'Candle making', slug: 'candle-making' },
      { name: 'Crocheting', slug: 'crocheting' },
      { name: 'Homebrewing', slug: 'homebrewing' },
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
  {
    name: 'Collecting',
    color: '#C3F584',
    slug: 'collecting',
    subcategories: [
      { name: 'Coins', slug: 'coins' },
      { name: 'Stamps', slug: 'stamps' },
      { name: 'Action Figures', slug: 'action-figures' },
      { name: 'Trading Cards', slug: 'trading-cards' },
      { name: 'Button Collecting', slug: 'button-collecting' }
    ]
  },
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
  {
    name: 'Cooking & Baking',
    color: '#FFDAC1',
    slug: 'cooking-baking',
    subcategories: [
      { name: 'Baking', slug: 'baking' },
      { name: 'Meal Prep', slug: 'meal-prep' },
      { name: 'Cake Decorating', slug: 'cake-decorating' },
      { name: 'Bread Making', slug: 'bread-making' },
      { name: 'Homebrewing', slug: 'homebrewing' }
    ]
  },
  {
    name: 'Outdoors & Adventure',
    color: '#B5FFB8',
    slug: 'outdoors-adventure',
    subcategories: [
      { name: 'Airsoft', slug: 'airsoft' },
      { name: 'Archery', slug: 'archery' },
      { name: 'Bicycling', slug: 'bicycling' },
      { name: 'Bird Watching', slug: 'birding' },
      { name: 'Beekeeping', slug: 'beekeeping' },
      { name: 'Backpacking', slug: 'backpacking' },
      { name: 'Camping', slug: 'camping' },
      { name: 'Caving', slug: 'caving' },
      { name: 'Hiking', slug: 'hiking' },
      { name: 'Gardening', slug: 'gardening' },
      { name: 'Rock Climbing', slug: 'rock-climbing' }
    ]
  },
  {
    name: 'Books & Literature',
    color: '#AEDFF7',
    slug: 'books-literature',
    subcategories: [
      { name: 'Fiction', slug: 'fiction' },
      { name: 'Non-Fiction', slug: 'non-fiction' },
      { name: 'Graphic Novels', slug: 'graphic-novels' },
      { name: 'Manga & Comics', slug: 'manga-comics' },
      { name: 'Book restoration', slug: 'book-restoration' }
    ]
  },
  {
    name: 'Movies & TV',
    color: '#F7E9AE',
    slug: 'movies-tv',
    subcategories: [
      { name: 'Blu-ray & DVD', slug: 'blu-ray-dvd' },
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
  },
  {
    name: 'Sports and sporting goods',
    color: '#FFD1DC',
    slug: 'sporting-goods',
    subcategories: [
      { name: 'Billiards', slug: 'billiards' },
      { name: 'Bicycling', slug: 'bicycling' },
      { name: 'Airsoft', slug: 'airsoft' },
      { name: 'Board sports', slug: 'board-sports' },
      { name: 'Body Building', slug: 'body-building' }
    ]
  }
];

async function seed() {
  // 1) Initialize Payload + Mongo
  const payload = await getPayload({ config });

  // ───────────────────────────────────────────────────────
  // 2) Seed an "admin" tenant and user (skip if they already exist)
  // ───────────────────────────────────────────────────────
  try {
    // 2a) Check if the "admin" tenant already exists
    const existingTenantResult = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'admin' } },
      limit: 1
    });
    let adminTenantId: string;

    if (existingTenantResult.docs.length > 0) {
      adminTenantId = existingTenantResult.docs[0].id;
      console.log(
        `⚡️ "admin" tenant already exists (ID: ${adminTenantId}). Skipping creation.`
      );
    } else {
      // 2b) Create the "admin" tenant
      const adminAccount = await stripe.accounts.create({
        type: 'standard',
        business_type: 'individual',
        business_profile: { url: 'https://your-domain.com' }
      });
      const createdTenant = await payload.create({
        collection: 'tenants',
        data: {
          name: 'admin',
          slug: 'admin',
          stripeAccountId: adminAccount.id
        }
      });
      adminTenantId = createdTenant.id;
      console.log(`✅ Created "admin" tenant (ID: ${adminTenantId}).`);
    }

    // 2c) Check if the admin user already exists
    const existingUserResult = await payload.find({
      collection: 'users',
      where: { email: { equals: 'jay@demo.com' } },
      limit: 1
    });

    if (existingUserResult.docs.length > 0) {
      console.log(
        `⚡️ Admin user "jay@demo.com" already exists. Skipping creation.`
      );
    } else {
      // 2d) Create the "admin" user
      await payload.create({
        collection: 'users',
        data: {
          email: 'jay@demo.com',
          password: 'xXGolden69420%21xX', // Ensure this matches your ENV or is hashed as needed
          roles: ['super-admin'],
          username: 'admin',
          tenants: [{ tenant: adminTenantId }]
        }
      });
      console.log('✅ Created admin user jay@demo.com.');
    }
  } catch (error) {
    console.error('Error seeding admin tenant/user:', error);
  }

  // ───────────────────────────────────────────────────────
  // 3) Seed categories & subcategories (idempotent)
  // ───────────────────────────────────────────────────────
  for (const category of categories) {
    try {
      // 3a) Check if the parent category already exists
      const existingParentResult = await payload.find({
        collection: 'categories',
        where: { slug: { equals: category.slug } },
        limit: 1
      });

      let parentCategoryId: string;
      if (existingParentResult.docs.length > 0) {
        parentCategoryId = existingParentResult.docs[0].id;
        console.log(`⚡️ Skipping existing category: ${category.slug}`);
      } else {
        // 3b) Create the parent category
        const createdParent = await payload.create({
          collection: 'categories',
          data: {
            name: category.name,
            slug: category.slug,
            color: category.color || null,
            parent: null
          }
        });
        parentCategoryId = createdParent.id;
        console.log(`✅ Created category: ${category.slug}`);
      }

      // 3c) For each subcategory, repeat the pattern
      if (category.subcategories && category.subcategories.length > 0) {
        for (const subCategory of category.subcategories) {
          // Check if subcategory exists
          const existingSubResult = await payload.find({
            collection: 'categories',
            where: { slug: { equals: subCategory.slug } },
            limit: 1
          });

          let currentParentId: string;
          if (existingSubResult.docs.length > 0) {
            currentParentId = existingSubResult.docs[0].id;
            console.log(
              `⚡️ Skipping existing subcategory: ${subCategory.slug}`
            );
          } else {
            // Create subcategory with parent = parentCategoryId
            const createdSub = await payload.create({
              collection: 'categories',
              data: {
                name: subCategory.name,
                slug: subCategory.slug,
                color: subCategory.color || null,
                parent: parentCategoryId
              }
            });
            currentParentId = createdSub.id;
            console.log(`✅ Created subcategory: ${subCategory.slug}`);
          }

          // 3d) If there are nested sub-subcategories, repeat again
          if (
            subCategory.subcategories &&
            subCategory.subcategories.length > 0
          ) {
            for (const nested of subCategory.subcategories) {
              // Check if nested category exists
              const existingNestedResult = await payload.find({
                collection: 'categories',
                where: { slug: { equals: nested.slug } },
                limit: 1
              });

              if (existingNestedResult.docs.length > 0) {
                console.log(
                  `⚡️ Skipping existing nested category: ${nested.slug}`
                );
              } else {
                // Create nested category with parent = currentParentId
                await payload.create({
                  collection: 'categories',
                  data: {
                    name: nested.name,
                    slug: nested.slug,
                    color: null,
                    parent: currentParentId
                  }
                });
                console.log(`✅ Created nested category: ${nested.slug}`);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error seeding category "${category.slug}":`, error);
    }
  }
}

try {
  await seed();
  console.log('🌱 Seeding completed.');
  process.exit(0);
} catch (err) {
  console.error('🌱 Seed script caught error:', err);
  process.exit(1);
}
