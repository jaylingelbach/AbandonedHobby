import { CollectionBeforeValidateHook } from 'payload';

// Ensure category + subcategory exist and that the subcategory belongs to the selected category.

export const validateCategoryPercentage: CollectionBeforeValidateHook = async ({
  data,
  req,
  operation,
  originalDoc
}) => {
  if (operation !== 'create' && operation !== 'update') return data;

  const categoryRel = data?.category ?? originalDoc?.category;
  const subcategoryRel = data?.subcategory ?? originalDoc?.subcategory;

  if (!categoryRel || !subcategoryRel) {
    throw new Error('Please choose both Category and Subcategory.');
  }

  const categoryId =
    typeof categoryRel === 'object' ? categoryRel.id : categoryRel;
  const subcategoryId =
    typeof subcategoryRel === 'object' ? subcategoryRel.id : subcategoryRel;

  // Confirm the subcategory belongs to the selected category
  const subDoc = await req.payload.findByID({
    collection: 'categories',
    id: subcategoryId,
    depth: 0
  });

  const parentId =
    typeof subDoc?.parent === 'object'
      ? (subDoc?.parent as { id?: string })?.id
      : (subDoc?.parent as string | undefined);

  if (!parentId || String(parentId) !== String(categoryId)) {
    throw new Error(
      'Selected subcategory does not belong to the chosen category.'
    );
  }

  return data;
};
