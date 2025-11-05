import dotenv from 'dotenv';
import { getPayload } from 'payload';

import config from '@payload-config';
import { stripe } from './stripe';

dotenv.config();

interface Category {
  name: string;
  slug: string;
  color?: string;
  subcategories?: Array<{
    name: string;
    slug: string;
    color?: string;
    subcategories?: Array<{ name: string; slug: string; color?: string }>;
  }>;
}

/**
 * Produce a canonical, URL-safe username slug from an arbitrary string.
 *
 * Converts the input to lowercase, removes diacritical marks, trims surrounding whitespace,
 * replaces runs of characters other than a–z, 0–9, `.`, `_`, or `-` with a single hyphen,
 * and removes leading or trailing hyphens.
 *
 * @param input - The raw username to normalize
 * @returns The normalized username containing only lowercase letters, digits, `.`, `_`, and `-` with no leading or trailing hyphens
 */
function normalizeUsername(input: string): string {
  return input
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const categories: Category[] = [
  {
    name: 'All categories',
    slug: 'all',
    color: '#CCCCCC'
  },
  {
    name: 'Books & Literature',
    slug: 'books-literature',
    color: '#AEDFF7',
    subcategories: [
      { name: 'Book restoration', slug: 'book-restoration' },
      { name: 'Fiction', slug: 'fiction' },
      { name: 'Graphic Novels', slug: 'graphic-novels' },
      { name: 'Manga & Comics', slug: 'manga-comics' },
      { name: 'Non-Fiction', slug: 'non-fiction' }
    ]
  },
  {
    name: 'Collecting',
    slug: 'collecting',
    color: '#C3F584',
    subcategories: [
      { name: 'Action Figures', slug: 'action-figures' },
      { name: 'Button Collecting', slug: 'button-collecting' },
      { name: 'Coins', slug: 'coins' },
      { name: 'Stamps', slug: 'stamps' },
      { name: 'Trading Cards', slug: 'trading-cards' }
    ]
  },
  {
    name: 'Cooking & Baking',
    slug: 'cooking-baking',
    color: '#FFDAC1',
    subcategories: [
      { name: 'Baking', slug: 'baking' },
      { name: 'Bread Making', slug: 'bread-making' },
      { name: 'Cake Decorating', slug: 'cake-decorating' },
      { name: 'Homebrewing', slug: 'homebrewing' },
      { name: 'Meal Prep', slug: 'meal-prep' }
    ]
  },
  {
    name: 'Crafts & Hobbies',
    slug: 'crafts-hobbies',
    color: '#B5B9FF',
    subcategories: [
      { name: 'Astrology', slug: 'astrology' },
      { name: 'Astronomy', slug: 'astronomy' },
      { name: 'Candle making', slug: 'candle-making' },
      { name: 'Crocheting', slug: 'crocheting' },
      { name: 'Cross Stich', slug: 'cross-stitch' },
      { name: 'Homebrewing', slug: 'homebrewing' },
      { name: 'Homebrewing & Fermentation', slug: 'homebrewing-fermentation' },
      { name: 'Knitting', slug: 'knitting' },
      { name: 'LEGO & Building Blocks', slug: 'lego-building-blocks' },
      { name: 'Model Building', slug: 'model-building' },
      { name: 'Pottery', slug: 'pottery' },
      { name: 'Quilting', slug: 'quilting' },
      { name: 'Scrapbooking', slug: 'scrapbooking' },
      { name: 'Woodworking', slug: 'woodworking' }
    ]
  },
  {
    name: 'Drawing & Painting',
    slug: 'drawing-painting',
    color: '#FFB347',
    subcategories: [
      { name: 'Acrylic', slug: 'acrylic' },
      { name: 'Charcoal', slug: 'charcoal' },
      { name: 'Completed Artwork', slug: 'completed-artwork' },
      { name: 'Oil', slug: 'oil' },
      { name: 'Other Supplies', slug: 'other-supplies' },
      { name: 'Pastel', slug: 'pastel' },
      { name: 'Watercolor', slug: 'watercolor' }
    ]
  },
  {
    name: 'Electronics',
    slug: 'electronics',
    color: '#96E6B3',
    subcategories: [
      {
        name: 'Computers',
        slug: 'computers',
        subcategories: [
          { name: 'Audiophile', slug: 'audiophile' },
          { name: 'Drones & RC', slug: 'drones-rc' },
          { name: 'Single Board Computers', slug: 'single-board-computers' },
          { name: 'VR & Wearables', slug: 'vr-wearables' }
        ]
      },
      { name: 'Components', slug: 'components' }
    ]
  },
  {
    name: 'Fitness & Health',
    slug: 'fitness-health',
    color: '#FF9AA2',
    subcategories: [
      { name: 'Wearable Trackers', slug: 'wearable-trackers' },
      { name: 'Workout Equipment', slug: 'workout-equipment' },
      { name: 'Yoga & Mindfulness', slug: 'yoga-mindfulness' }
    ]
  },
  {
    name: 'Gaming',
    slug: 'gaming',
    color: '#8BD3DD',
    subcategories: [
      { name: 'Board Games', slug: 'board-games' },
      { name: 'Card Games', slug: 'card-games' },
      { name: 'Tabletop RPGs', slug: 'tabletop-rpgs' },
      { name: 'Video Games', slug: 'video-games' }
    ]
  },
  {
    name: 'Language Learning',
    slug: 'language-learning',
    color: '#D3F7AE',
    subcategories: [
      { name: 'Audio Courses', slug: 'audio-courses' },
      { name: 'Flashcards', slug: 'flashcards' },
      { name: 'Textbooks', slug: 'textbooks' }
    ]
  },
  {
    name: 'Mind Games & Puzzles',
    slug: 'mind-games-puzzles',
    color: '#FF6F91',
    subcategories: [
      { name: 'Crossword Puzzles', slug: 'crossword-puzzles' },
      { name: "Rubik's Cubes", slug: 'rubiks-cubes' },
      { name: 'Sudoku', slug: 'sudoku' },
      { name: 'Jigsaw Puzzles', slug: 'jigsaw-puzzles' }
    ]
  },
  {
    name: 'Movies & TV',
    slug: 'movies-tv',
    color: '#F7E9AE',
    subcategories: [
      { name: 'Blu-ray & DVD', slug: 'blu-ray-dvd' },
      { name: 'Posters & Merch', slug: 'posters-merch' },
      { name: 'Streaming Gear', slug: 'streaming-gear' }
    ]
  },
  {
    name: 'Music',
    slug: 'music',
    color: '#FFD700',
    subcategories: [
      { name: 'Casette Tapes', slug: 'cassette-tapes' },
      { name: 'Compact Discs', slug: 'compact-discs' },
      { name: 'Digital Audio Workstations', slug: 'daws' },
      { name: 'Musical Instruments', slug: 'musical-instruments' },
      { name: 'Other', slug: 'other' },
      { name: 'Records', slug: 'records' }
    ]
  },
  {
    name: 'Musical Instruments',
    slug: 'musical-instruments',
    color: '#BD9B16',
    subcategories: [
      { name: 'Acoustic Guitars & Basses', slug: 'acoustic-guitars' },
      { name: 'Electric Guitars & Basses', slug: 'electric-guitars' },
      { name: 'Other', slug: 'other' },
      { name: 'Pedals & Effects', slug: 'pedals-effects' },
      { name: 'Synthesizers & MIDI', slug: 'synthesizers-midi' }
    ]
  },
  {
    name: 'Outdoors & Adventure',
    slug: 'outdoors-adventure',
    color: '#B5FFB8',
    subcategories: [
      { name: 'Airsoft', slug: 'airsoft' },
      { name: 'Archery', slug: 'archery' },
      { name: 'Backpacking', slug: 'backpacking' },
      { name: 'Beekeeping', slug: 'beekeeping' },
      { name: 'Bicycling', slug: 'bicycling' },
      { name: 'Bird Watching', slug: 'birding' },
      { name: 'Camping', slug: 'camping' },
      { name: 'Caving', slug: 'caving' },
      { name: 'Gardening', slug: 'gardening' },
      { name: 'Hiking', slug: 'hiking' },
      { name: 'Rock Climbing', slug: 'rock-climbing' }
    ]
  },
  {
    name: 'Photography',
    slug: 'photography',
    color: '#FF6B6B',
    subcategories: [
      { name: 'Camera Equipment', slug: 'camera-equipment' },
      { name: 'Cameras', slug: 'cameras' },
      { name: 'Film Photography', slug: 'film-photography' },
      { name: 'Instant Cameras & Film', slug: 'instant-cameras-film' }
    ]
  },
  {
    name: 'Sports and sporting goods',
    slug: 'sporting-goods',
    color: '#FFC09F',
    subcategories: [
      { name: 'Airsoft', slug: 'airsoft' },
      { name: 'Billiards', slug: 'billiards' },
      { name: 'Bicycling', slug: 'bicycling' },
      { name: 'Board sports', slug: 'board-sports' },
      { name: 'Body Building', slug: 'body-building' }
    ]
  },
  {
    name: 'Tech & DIY',
    slug: 'tech-diy',
    color: '#A0E7E5',
    subcategories: [
      { name: '3D Printing', slug: '3d-printing' },
      { name: 'Arduino Projects', slug: 'arduino-projects' },
      { name: 'Electronics Kits', slug: 'electronics-kits' },
      { name: 'Raspberry Pi', slug: 'raspberry-pi' }
    ]
  },
  {
    name: 'Writing & Publishing',
    slug: 'writing-publishing',
    color: '#D8B5FF',
    subcategories: [
      { name: 'Book restoration', slug: 'book-restoration' },
      { name: 'Calligraphy', slug: 'calligraphy' },
      { name: 'Notebooks', slug: 'notebooks' },
      { name: 'Planners & Bullet Journals', slug: 'planners-bullet-journals' },
      { name: 'Writing devices', slug: 'writing-devices' }
    ]
  }
];

/**
 * Ensures initial application data exists: an admin user, an "admin" tenant (and a Stripe account if needed), and the configured categories with nested subcategories.
 *
 * The operation is idempotent — existing users, tenants, and categories are reused and missing items are created; the admin user is linked to the admin tenant when absent.
 */
async function seed() {
  const payload = await getPayload({ config });

  // ───────────────────────────────────────────────────────
  // 2) Seed an "admin" tenant and user (skip if they already exist)
  // ───────────────────────────────────────────────────────
  try {
    const adminEmail = process.env.ADMIN_SEED_EMAIL ?? 'admin@example.com';
    const adminPassword = process.env.ADMIN_SEED_PASSWORD;
    const desiredAdminUsernameRaw = process.env.ADMIN_SEED_USERNAME ?? 'admin';
    const desiredAdminUsername = normalizeUsername(desiredAdminUsernameRaw);

    if (!adminPassword)
      throw new Error('Admin password needed to seed account');

    // Look for existing admin by email OR username (normalized)
    const existingAdmin = (
      await payload.find({
        collection: 'users',
        where: {
          or: [
            { email: { equals: adminEmail } },
            { username: { equals: desiredAdminUsername } }
          ]
        },
        limit: 1,
        overrideAccess: true,
        depth: 0
      })
    ).docs[0];

    let adminUserId: string;
    let adminUserEmail: string;

    if (existingAdmin) {
      adminUserId = String(existingAdmin.id);
      adminUserEmail = String(existingAdmin.email);
      console.log(
        '⚡️ Admin user exists (by email or username):',
        adminUserEmail
      );
    } else {
      const created = await payload.create({
        collection: 'users',
        data: {
          email: adminEmail,
          password: adminPassword,
          username: desiredAdminUsername,
          roles: ['super-admin'],
          firstName: process.env.ADMIN_SEED_FIRST_NAME || 'Admin',
          lastName: process.env.ADMIN_SEED_LAST_NAME || 'User',
          welcomeEmailSent: true,
          tenants: []
        },
        overrideAccess: true
      });

      adminUserId = String(created.id);
      adminUserEmail = String(created.email);
      console.log('✅ Created admin user:', adminUserEmail);
    }

    // 2b) Ensure admin tenant exists (create if needed)
    let adminTenant = (
      await payload.find({
        collection: 'tenants',
        where: { slug: { equals: 'admin' } },
        limit: 1,
        overrideAccess: true,
        depth: 0
      })
    ).docs[0];

    if (!adminTenant) {
      const adminAccount = await stripe.accounts.create({
        type: 'standard',
        business_type: 'individual',
        business_profile: { url: process.env.APP_URL }
      });

      adminTenant = await payload.create({
        collection: 'tenants',
        data: {
          name: 'admin',
          slug: 'admin',
          stripeAccountId: adminAccount.id,
          primaryContact: adminUserId,
          notificationEmail: adminUserEmail,
          stripeDetailsSubmitted: true
        },
        overrideAccess: true
      });
      console.log('✅ Created "admin" tenant', adminTenant.id);
    } else {
      console.log('⚡️ "admin" tenant exists', adminTenant.id);
    }

    // Link user -> tenant if missing
    const adminUser = await payload.findByID({
      collection: 'users',
      id: adminUserId,
      overrideAccess: true,
      depth: 0
    });

    const hasTenant =
      Array.isArray(adminUser.tenants) &&
      adminUser.tenants.some(
        (t: unknown) =>
          t &&
          typeof t === 'object' &&
          'tenant' in t &&
          String((t as { tenant?: unknown }).tenant) === String(adminTenant!.id)
      );

    if (!hasTenant) {
      await payload.update({
        collection: 'users',
        id: adminUserId,
        data: {
          tenants: [
            ...(Array.isArray(adminUser.tenants) ? adminUser.tenants : []),
            { tenant: adminTenant.id }
          ]
        },
        overrideAccess: true
      });
      console.log('🔗 Linked admin user -> admin tenant');
    }
  } catch (error) {
    console.error('Error seeding admin tenant/user:', error);
  }

  // ───────────────────────────────────────────────────────
  // 3) Seed categories & subcategories (idempotent)
  // ───────────────────────────────────────────────────────
  for (const category of categories) {
    try {
      const existingParentResult = await payload.find({
        collection: 'categories',
        where: { slug: { equals: category.slug } },
        limit: 1
      });

      let parentCategoryId: string;
      if (
        existingParentResult.docs.length > 0 &&
        existingParentResult.docs[0]
      ) {
        parentCategoryId = existingParentResult.docs[0].id as string;
        console.log(`⚡️ Skipping existing category: ${category.slug}`);
      } else {
        const createdParent = await payload.create({
          collection: 'categories',
          data: {
            name: category.name,
            slug: category.slug,
            color: category.color || null,
            parent: null
          }
        });
        parentCategoryId = createdParent.id as string;
        console.log(`✅ Created category: ${category.slug}`);
      }

      if (category.subcategories && category.subcategories.length > 0) {
        for (const subCategory of category.subcategories) {
          const existingSubResult = await payload.find({
            collection: 'categories',
            where: { slug: { equals: subCategory.slug } },
            limit: 1
          });

          let currentParentId: string;
          if (existingSubResult.docs.length > 0 && existingSubResult.docs[0]) {
            currentParentId = existingSubResult.docs[0].id as string;
            console.log(
              `⚡️ Skipping existing subcategory: ${subCategory.slug}`
            );
          } else {
            const createdSub = await payload.create({
              collection: 'categories',
              data: {
                name: subCategory.name,
                slug: subCategory.slug,
                color: subCategory.color || null,
                parent: parentCategoryId
              }
            });
            currentParentId = createdSub.id as string;
            console.log(`✅ Created subcategory: ${subCategory.slug}`);
          }

          if (
            subCategory.subcategories &&
            subCategory.subcategories.length > 0
          ) {
            for (const nested of subCategory.subcategories) {
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
