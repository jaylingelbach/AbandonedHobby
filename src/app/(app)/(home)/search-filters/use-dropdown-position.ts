import { RefObject } from 'react';

// div wrapping button is the dropdown ref in category-dropdown
export const useDropdownPosition = (ref: RefObject<HTMLDivElement | null>) => {
  const getDropdownPosition = () => {
    if (!ref.current) return { top: 0, left: 0 };

    const rect = ref.current.getBoundingClientRect();
    const dropdownWidth = 240; // width of dropdown (w-60 = 15rem = 240px)

    // cal init position
    let left = rect.left + window.scrollX;
    const top = rect.bottom + window.scrollY;

    // will downdown go off right edge of view?
    if (left + dropdownWidth > window.innerWidth) {
      // align to right edge of button
      left = rect.right + window.scrollX - dropdownWidth;

      // if still off-screen align to right edge of view with padding added.
      if (left < 0) {
        left = window.innerWidth - dropdownWidth - 16;
      }
    }
    // ensure dropdown doesn't go off left edge
    if (left < 0) {
      left = 16;
    }
    return { top, left };
  };
  return { getDropdownPosition };
};
