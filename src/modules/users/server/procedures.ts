import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { OnboardingStepEnum, UIState, UIStateSchema } from '@/hooks/types';
import { computeOnboarding } from '@/modules/onboarding/server/utils';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { isSuperAdmin } from '@/lib/access';

/**
 * Checks whether the provided value is an array containing only strings.
 *
 * @param value - The value to test
 * @returns `true` if `value` is a readonly array whose every element is a `string`, `false` otherwise
 */
function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

export const usersRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(
      z.object({
        userId: z.string()
      })
    )
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.findByID({
        collection: 'users',
        id: input.userId,
        depth: 0
      });
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `User ${input.userId} not found`
        });
      }
      return { id: user.id, username: user.username };
    }),

  me: protectedProcedure.query(async ({ ctx }) => {
    const id = ctx.session.user?.id;
    if (!id) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No ID found for user'
      });
    }

    const dbUser = await ctx.db.findByID({
      collection: 'users',
      id,
      depth: 1
    });

    if (!dbUser) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found.'
      });
    }

    type MaybeUser = {
      _verified?: boolean | null;
      _verifiedAt?: string | Date | null;
      tenants?: unknown[] | null;
      uiState?: unknown;
      roles?: unknown;
    };

    const u = dbUser as MaybeUser;

    const verified = u._verified === true || !!u._verifiedAt;

    const parsed = UIStateSchema.safeParse(u.uiState ?? {});
    const uiState: UIState = parsed.success ? parsed.data : {};

    const roles = Array.isArray(u.roles) ? u.roles : [];
    const canReinstate =
      roles.every((role) => typeof role === 'string') &&
      roles.includes('super-admin');

    const user = {
      id: String(dbUser.id),
      _verified: verified,
      tenants: Array.isArray(u.tenants) ? u.tenants : [],
      uiState
    };

    const onboarding = computeOnboarding(user);

    return { user, onboarding, canReinstate };
  }),

  dismissOnboardingBanner: protectedProcedure
    .input(
      z.object({
        step: OnboardingStepEnum,
        forever: z.boolean().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      void input.step;
      const id = ctx.session.user?.id;
      if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const current = await ctx.db.findByID({
        collection: 'users',
        id,
        depth: 0
      });

      if (!current) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const rawPrev = ((current as { uiState?: unknown }).uiState ??
        {}) as Record<string, unknown>;
      const parsed = UIStateSchema.safeParse(rawPrev);
      const prev: UIState = parsed.success ? parsed.data : {};

      if (input.forever === true && prev.hideOnboardingBanner !== true) {
        await ctx.db.update({
          collection: 'users',
          id,
          data: { uiState: { ...rawPrev, hideOnboardingBanner: true } }
        });
      }

      return { ok: true };
    })
});