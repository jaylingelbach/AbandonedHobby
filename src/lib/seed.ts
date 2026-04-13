import dotenv from 'dotenv';
import { getPayload } from 'payload';

import config from '@payload-config';
import { categories } from './categories';
import { stripe } from './stripe';

dotenv.config();

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
