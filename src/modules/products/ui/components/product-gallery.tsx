'use client';

import Image from 'next/image';
import React, {
  JSX,
  KeyboardEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';

/**
 * Represents a single gallery image item.
 */
export interface GalleryImageItem {
  /**
   * Absolute URL to the image (must be allowed in next.config.ts images.remotePatterns).
   */
  url: string;
  /**
   * Optional alt text for accessibility.
   */
  alt?: string;
}

/**
 * Props for the neo-brutalist product gallery component.
 */
export interface ProductGalleryProps {
  /**
   * Ordered list of images (first is treated as primary).
   */
  items: ReadonlyArray<GalleryImageItem>;
  /**
   * Optional extra class names for the root section.
   */
  className?: string;
  /**
   * Number of thumbnail columns on larger screens.
   * Default: 8.
   */
  thumbColsDesktop?: number;
  /**
   * Aspect ratio for the hero image area.
   * - 'square' (default)
   * - '4/3'
   * - '16/9'
   */
  heroAspect?: 'square' | '4/3' | '16/9';
  /**
   * Show a small “Primary” badge on the selected thumbnail (default true).
   */
  showPrimaryBadge?: boolean;
}

/**
 * Neo-brutalist product gallery:
 * - Big hero image with thick border and offset shadow
 * - Clickable thumbnails with a bold selected state
 * - Keyboard navigation (← → Home End)
 * - Type-safe (no `any`), resilient to prop changes
 *
 * Usage:
 * ```tsx
 * <ProductGalleryBrutalist
 *   items={[
 *     { url: 'https://…/img1.jpg', alt: 'Front' },
 *     { url: 'https://…/img2.jpg', alt: 'Back' },
 *   ]}
 * />
 * ```
 */
export default function ProductGallery(
  props: ProductGalleryProps
): JSX.Element | null {
  const {
    items,
    className,
    thumbColsDesktop = 8,
    heroAspect = 'square',
    showPrimaryBadge = false
  } = props;

  /**
   * Filter out any invalid entries defensively.
   */
  const safeItems = useMemo<GalleryImageItem[]>(
    () => (items ?? []).filter((imageItem) => Boolean(imageItem?.url)),
    [items]
  );

  /**
   * Index of the currently active (hero) image.
   */
  const [activeIndex, setActiveIndex] = useState<number>(0);

  /**
   * Keep activeIndex within range whenever the list length changes.
   */
  useEffect(() => {
    if (safeItems.length === 0) return;
    setActiveIndex((currentIndex) =>
      Math.min(Math.max(0, currentIndex), safeItems.length - 1)
    );
  }, [safeItems.length]);

  /**
   * Nothing to render if there are no valid images.
   */
  if (safeItems.length === 0) {
    return null;
  }

  /**
   * At this point we know the array is non-empty.
   * We also ensure `activeImage` is ALWAYS defined by falling back to the first item.
   * This avoids the “possibly undefined” error even with `noUncheckedIndexedAccess` enabled.
   */
  const nonEmptyItems = safeItems as [GalleryImageItem, ...GalleryImageItem[]];
  const [firstItem] = nonEmptyItems;
  const boundedIndex = Math.min(activeIndex, nonEmptyItems.length - 1);
  const activeImage: GalleryImageItem =
    nonEmptyItems[boundedIndex] ?? firstItem;

  /**
   * Tailwind aspect class for the hero region.
   */
  const heroAspectClass =
    heroAspect === '4/3'
      ? 'aspect-[4/3]'
      : heroAspect === '16/9'
        ? 'aspect-video'
        : 'aspect-square';

  /**
   * Keyboard navigation handler (Left/Right/Home/End).
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveIndex(
          (currentIndex) => (currentIndex + 1) % nonEmptyItems.length
        );
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex(
          (currentIndex) =>
            (currentIndex - 1 + nonEmptyItems.length) % nonEmptyItems.length
        );
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActiveIndex(nonEmptyItems.length - 1);
      }
    },
    [nonEmptyItems.length]
  );

  /**
   * Select a specific image when a thumbnail is clicked.
   */
  const handleThumbClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      event.preventDefault();
      setActiveIndex(index);
    },
    []
  );

  return (
    <section
      className={['ah-gallery space-y-4 outline-none', className ?? ''].join(
        ' '
      )}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Product image gallery"
    >
      {/* Hero Image */}
      <div className="relative w-full overflow-hidden rounded-sm border-2 border-black bg-white shadow-[8px_8px_0_#000]">
        <div className={`relative ${heroAspectClass}`}>
          <Image
            src={activeImage.url}
            alt={activeImage.alt ?? 'Product image'}
            fill
            className="object-cover"
            sizes="(min-width:1024px) 800px, 100vw"
            priority
          />
        </div>
      </div>

      {/* Thumbnails */}
      <div
        className={[
          'grid gap-3',
          'grid-cols-4 sm:grid-cols-6 md:grid-cols-8'
        ].join(' ')}
        // allow easy override of columns via inline style if desired
        style={{
          gridTemplateColumns: `repeat(${thumbColsDesktop}, minmax(0, 1fr))`
        }}
        aria-label="Product thumbnails"
      >
        {nonEmptyItems.map((imageItem, imageIndex) => {
          const isSelected = imageIndex === boundedIndex;
          return (
            <button
              key={`${imageItem.url}-${imageIndex}`}
              type="button"
              onClick={(event) => handleThumbClick(event, imageIndex)}
              aria-label={`Show image ${imageIndex + 1}`}
              aria-current={isSelected ? 'true' : undefined}
              className={[
                'group relative aspect-square overflow-hidden rounded-sm border-2 bg-white',
                isSelected
                  ? 'border-black shadow-[4px_4px_0_#000]'
                  : 'border-black/60 hover:border-black hover:shadow-[4px_4px_0_#000]',
                'focus-visible:outline-2 focus-visible:outline-black'
              ].join(' ')}
            >
              <Image
                src={imageItem.url}
                alt={imageItem.alt ?? 'Product thumbnail'}
                fill
                className={[
                  'object-cover transition-transform duration-150',
                  isSelected ? 'scale-100' : 'group-hover:scale-[1.03]'
                ].join(' ')}
                sizes="120px"
              />
              {showPrimaryBadge && isSelected && (
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-pink-400 border-2 border-black text-black">
                  Primary
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
