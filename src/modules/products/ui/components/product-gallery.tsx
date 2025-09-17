// src/modules/products/ui/components/product-gallery.tsx
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
 * A single image for the product gallery.
 */
export interface GalleryImageItem {
  /** Absolute URL to the image (must be allowed in next.config images.remotePatterns). */
  url: string;
  /** Optional alt text for accessibility. */
  alt?: string;
}

/**
 * Props for the product gallery component.
 */
export interface ProductGalleryProps {
  /** Ordered list of images (first is treated as primary). */
  items: ReadonlyArray<GalleryImageItem>;
  /** Optional extra class names for the root element. */
  className?: string;
  /** Number of thumbnail columns on larger screens (defaults to 6). */
  thumbColsDesktop?: number;
  /**
   * Aspect ratio for the hero image area.
   * - 'square' (default)
   * - '4/3'
   * - '16/9'
   */
  heroAspect?: 'square' | '4/3' | '16/9';
}

/**
 * Product gallery:
 * - Big hero image with thick border and offset shadow
 * - Clickable thumbnails with clear selected state
 * - Keyboard navigation (← → Home End)
 * - All hooks called unconditionally to satisfy the Rules of Hooks
 */
export default function ProductGallery(
  props: ProductGalleryProps
): JSX.Element | null {
  const {
    items,
    className,
    thumbColsDesktop = 6,
    heroAspect = 'square'
  } = props;

  // Filter out any empty entries defensively
  const safeItems = useMemo<GalleryImageItem[]>(
    () => (items ?? []).filter((imageItem) => Boolean(imageItem?.url)),
    [items]
  );
  const safeCount = safeItems.length;

  // Index of the currently active (hero) image.
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Keep activeIndex within range whenever the list length changes.
  useEffect(() => {
    if (safeCount === 0) {
      // Reset to 0 when empty so we don't carry an out-of-range index.
      setActiveIndex(0);
      return;
    }
    setActiveIndex((currentIndex) =>
      Math.min(Math.max(0, currentIndex), safeCount - 1)
    );
  }, [safeCount]);

  // Keyboard navigation handler (Left/Right/Home/End).
  // NOTE: Declared before any early return; internally no-op when empty.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (safeCount === 0) return;

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setActiveIndex((currentIndex) => (currentIndex + 1) % safeCount);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setActiveIndex(
          (currentIndex) => (currentIndex - 1 + safeCount) % safeCount
        );
      } else if (event.key === 'Home') {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setActiveIndex(safeCount - 1);
      }
    },
    [safeCount]
  );

  // Select a specific image when a thumbnail is clicked.
  const handleThumbClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>, index: number) => {
      event.preventDefault();
      if (safeCount === 0) return;
      const clamped = Math.min(Math.max(0, index), safeCount - 1);
      setActiveIndex(clamped);
    },
    [safeCount]
  );

  // From here on, we can exit early if there are no images.
  if (safeCount === 0) {
    return null;
  }

  // Choose a Tailwind aspect class for the hero area.
  const heroAspectClass =
    heroAspect === '4/3'
      ? 'aspect-[4/3]'
      : heroAspect === '16/9'
        ? 'aspect-video'
        : 'aspect-square';

  const boundedIndex = Math.min(activeIndex, safeCount - 1);
  const activeImage = safeItems[boundedIndex]!; // safe because safeCount > 0

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
        className="grid gap-3 grid-cols-4 sm:grid-cols-6"
        style={{
          gridTemplateColumns: `repeat(${thumbColsDesktop}, minmax(0, 1fr))`
        }}
        aria-label="Product thumbnails"
      >
        {safeItems.map((imageItem, imageIndex) => {
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
            </button>
          );
        })}
      </div>
    </section>
  );
}
