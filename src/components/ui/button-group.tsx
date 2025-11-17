import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const focusStyles = '[&>*]:focus-visible:z-10 [&>*]:focus-visible:relative';
const selectTriggerStyles =
  "[&>[data-slot=select-trigger]:not([class*='w-'])]:w-fit";
const inputStyles = '[&>input]:flex-1';
const nestedGroupStyles = 'has-[>[data-slot=button-group]]:gap-2';
const hiddenSelectStyles =
  'has-[select[aria-hidden=true]:last-child]:[&>[data-slot=select-trigger]:last-of-type]:rounded-r-md';

const buttonGroupVariants = cva(
  `flex w-fit items-stretch ${focusStyles} ${selectTriggerStyles} ${inputStyles} ${hiddenSelectStyles} ${nestedGroupStyles}`,
  {
    variants: {
      orientation: {
        horizontal:
          '[&>*:not(:first-child)]:rounded-l-none [&>*:not(:first-child)]:border-l-0 [&>*:not(:last-child)]:rounded-r-none',
        vertical:
          'flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:first-child)]:border-t-0 [&>*:not(:last-child)]:rounded-b-none'
      }
    },
    defaultVariants: {
      orientation: 'horizontal'
    }
  }
);

/**
 * Renders a container for grouping related buttons and applies orientation-specific styling.
 *
 * @param className - Additional class names appended to the component's computed classes
 * @param orientation - Layout orientation; `"horizontal"` arranges children in a row, `"vertical"` stacks them in a column. Defaults to `"horizontal"`.
 * @returns A JSX element representing the button group container with role="group" and orientation applied via data attributes and styles
 */
function ButtonGroup({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  );
}

/**
 * Renders a styled container for text inside a ButtonGroup, using either a native div or a Slot when composed as a child.
 *
 * @param className - Additional CSS classes to apply to the container
 * @param asChild - If `true`, renders a `Slot` so the consumer's element is used as the underlying node; otherwise renders a `div`
 * @returns A React element that serves as the text/content container for a ButtonGroup; any extra props are forwarded to the rendered element
 */
function ButtonGroupText({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & {
  asChild?: boolean;
}) {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      className={cn(
        "bg-muted flex items-center gap-2 rounded-md border px-4 text-sm font-medium shadow-xs [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
}

/**
 * Renders a Separator customized for placement inside a ButtonGroup.
 *
 * @param className - Additional CSS classes to apply to the separator
 * @param orientation - Layout direction of the separator; 'vertical' places a vertical divider, 'horizontal' places a horizontal divider
 * @returns The Separator element with button-group-specific data attribute and composed classes
 */
function ButtonGroupSeparator({
  className,
  orientation = 'vertical',
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      data-slot="button-group-separator"
      orientation={orientation}
      className={cn(
        'bg-input relative m-0 self-stretch data-[orientation=vertical]:h-auto',
        className
      )}
      {...props}
    />
  );
}

export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants
};