// import 'dotenv/config';
// import { getPayload } from 'payload';
// import config from '@payload-config';

// // Normalize "media" dir and build S3 base
// function baseUrl(): string {
//   const fromEnv = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
//   if (fromEnv) return fromEnv;
//   const bucket = process.env.S3_BUCKET!;
//   const region = process.env.AWS_REGION!;
//   return `https://${bucket}.s3.${region}.amazonaws.com`;
// }
// const PREFIX = 'media'; // matches your s3Storage({ collections.media.prefix })

// function toS3Url(filename?: string): string | undefined {
//   if (!filename) return undefined;
//   return `${baseUrl()}/${PREFIX}/${filename}`.replace(/([^:]\/)\/+/g, '$1');
// }

// function looksLegacy(u?: unknown): u is string {
//   return typeof u === 'string' && u.startsWith('/api/media/file/');
// }

// async function main() {
//   const payload = await getPayload({ config });

//   // Find media with legacy/local URLs
//   const legacy = await payload.find({
//     collection: 'media',
//     pagination: false,
//     depth: 0,
//     where: {
//       or: [
//         { url: { like: '/api/media/file/' } },
//         { 'sizes.thumbnail.url': { like: '/api/media/file/' } },
//         { 'sizes.medium.url': { like: '/api/media/file/' } }
//       ]
//     }
//   });

//   console.log(`Found ${legacy.docs.length} legacy media docs to fix.`);

//   for (const doc of legacy.docs as Array<{
//     id: string;
//     filename?: string;
//     url?: string;
//     sizes?: Record<string, { filename?: string; url?: string }>;
//   }>) {
//     const patch: any = {};
//     let changed = false;

//     // main url
//     if (looksLegacy(doc.url)) {
//       const next = toS3Url(doc.filename);
//       if (next) {
//         patch.url = next;
//         changed = true;
//       } else {
//         console.warn(`Skip ${doc.id}: missing filename for main url`);
//       }
//     }

//     // sizes
//     if (doc.sizes && typeof doc.sizes === 'object') {
//       for (const [sizeName, sizeObj] of Object.entries(doc.sizes)) {
//         if (looksLegacy(sizeObj?.url)) {
//           const next = toS3Url(sizeObj?.filename);
//           if (next) {
//             patch.sizes = patch.sizes || {};
//             patch.sizes[sizeName] = { ...sizeObj, url: next };
//             changed = true;
//           } else {
//             console.warn(
//               `Skip size ${sizeName} on ${doc.id}: missing filename`
//             );
//           }
//         }
//       }
//     }

//     if (changed) {
//       await payload.update({
//         collection: 'media',
//         id: doc.id,
//         data: patch,
//         depth: 0
//       });
//       console.log(`Updated ${doc.id}`);
//     }
//   }

//   console.log('Done.');
// }

// main().catch((e) => {
//   console.error(e);
//   process.exit(1);
// });
