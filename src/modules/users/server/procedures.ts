import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure } from '@/trpc/init';
import { computeOnboarding } from '@/modules/onboarding/server/utils';
import { OnboardingStepEnum, UIState, UIStateSchema } from '@/hooks/types';

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
    if (!id)
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'No ID found for user'
      });

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

    type MaybeVerified = {
      _verified?: boolean | null;
      _verifiedAt?: string | Date | null;
      tenants?: unknown[] | null;
      uiState: unknown;
    };

    const u = dbUser as MaybeVerified;

    // consider either boolean true OR a non-null verifiedAt as verified
    const verified = u._verified === true || !!u._verifiedAt;

    const parsed = UIStateSchema.safeParse(u.uiState ?? {});
    const uiState: UIState = parsed.success ? parsed.data : {};

    const user = {
      id: String(dbUser.id),
      _verified: verified,
      tenants: Array.isArray(u.tenants) ? u.tenants : [],
      uiState
    };

    const onboarding = computeOnboarding(user);
    return { user, onboarding };
  }),

  dismissOnboardingBanner: protectedProcedure
    .input(
      z.object({
        step: OnboardingStepEnum,
        forever: z.boolean().optional()
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = ctx.session.user?.id;
      if (!id) throw new TRPCError({ code: 'UNAUTHORIZED' });

      const current = await ctx.db.findByID({
        collection: 'users',
        id,
        depth: 0
      });

      const parsed = UIStateSchema.safeParse(
        (current as { uiState?: unknown }).uiState ?? {}
      );
      const prev: UIState = parsed.success ? parsed.data : {};

      // Persist only the “forever” preference; session-only dismiss happens client-side
      if (input.forever === true && prev.hideOnboardingBanner !== true) {
        await ctx.db.update({
          collection: 'users',
          id,
          data: { uiState: { ...prev, hideOnboardingBanner: true } }
        });
      }

      return { ok: true };
    })
});
