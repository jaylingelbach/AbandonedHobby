import { CollectionAfterChangeHook } from 'payload';
import { getDraftStatus } from '../../utils';

// If tracking inventory: archive when quantity hits 0; unarchive when increased above 0.
export const autoArchiveOrUnarchiveOnInventoryChange: CollectionAfterChangeHook =
  async ({ req, doc, previousDoc, operation }) => {
    // Prevent loop if we've already set archived in this request
    if (req.context?.ahSkipAutoArchive) return;

    // If drafts are enabled, do not auto-publish
    const status = getDraftStatus(doc);
    if (status && status !== 'published') return;

    // if (operation === 'update') {
    //   const prevTrack = Boolean(previousDoc?.trackInventory);
    //   const prevQty =
    //     typeof previousDoc?.stockQuantity === 'number'
    //       ? previousDoc.stockQuantity
    //       : 0;
    //   const track = Boolean(doc.trackInventory);
    //   const qty = typeof doc.stockQuantity === 'number' ? doc.stockQuantity : 0;
    //   if (prevTrack === track && prevQty === qty) return;
    // }
    const track = Boolean(doc.trackInventory);
    const qty = typeof doc.stockQuantity === 'number' ? doc.stockQuantity : 0;
    const archived = Boolean(doc.isArchived);

    if (track && qty === 0 && !archived) {
      // Auto-archive sold out listings so they disappear from the store
      await req.payload.update({
        collection: 'products',
        id: doc.id,
        data: { isArchived: true },
        overrideAccess: true,
        draft: false,
        context: { ahSkipAutoArchive: true }
      });
    }

    // If quantity was increased from 0, optionally unarchive:
    if (track && qty > 0 && archived) {
      await req.payload.update({
        collection: 'products',
        id: doc.id,
        data: { isArchived: false },
        overrideAccess: true,
        draft: false,
        context: { ahSkipAutoArchive: true }
      });
    }
  };
