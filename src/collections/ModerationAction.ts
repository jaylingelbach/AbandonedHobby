import {
  actionTypeLabels,
  actionTypes,
  roleLabels,
  roleTypes
} from '@/constants';
import {
  moderationFlagReasons,
  moderationSource,
  moderationReinstateReasons,
  moderationSelectOptions,
  moderationSelectOptionsLabel
} from '@/constants';
import { isStaff, isSuperAdmin } from '@/lib/access';
import { ClientUser, CollectionConfig } from 'payload';
import { ModerationActionCtx } from './utils/utils';
import { User } from '@/payload-types';

/**
 * Checks if the given value is an array and if all its elements are strings.
 * @param value The value to check.
 * @returns {boolean} True if the value is a string array, false otherwise.
 */
function isArrayOfStrings(value: unknown): value is string[] {
  // First, check if the value is an array
  if (!Array.isArray(value)) {
    return false;
  }

  // Then, check if every element in the array is a string
  return value.every((item) => typeof item === 'string');
}

const isProd: boolean = process.env.NODE_ENV === 'production';

export const ModerationActions: CollectionConfig = {
  slug: 'moderation-actions',
  /**
   * Compound indexes for hot queries
   *
   * Removed tab query shape is:
   * - where: { actionType: 'removed', product: { in: [...] } }
   * - sort: '-createdAt'
   *
   * This index supports:
   * - filtering by actionType + product
   * - reading results already ordered by createdAt desc
   */
  indexes: [
    {
      fields: ['actionType', 'product', 'createdAt']
    }
  ],
  access: {
    create: ({ req: { user } }) => isSuperAdmin(user) || isStaff(user),
    read: ({ req: { user } }) => isSuperAdmin(user) || isStaff(user),
    update: ({ req: { user } }) => !isProd && isSuperAdmin(user),
    delete: ({ req: { user } }) => !isProd && isSuperAdmin(user)
  },
  admin: {
    description: 'Moderation Actions'
  },
  hooks: {
    beforeValidate: [
      ({ data, req, operation }) => {
        if (operation !== 'create') return data;

        const user = req.user as User | ClientUser | null;
        if (!user) throw new Error('Not authenticated');

        if (!(isSuperAdmin(user) || isStaff(user))) {
          throw new Error('Forbidden');
        }

        if (!data) return data;
        data.actor = user.id;
        data.actorEmailSnapshot = user.email;
        data.actorUsernameSnapshot = user.username;
        data.actorRoleSnapshot = user.roles;

        if (!data.source) {
          data.source = 'admin_ui';
        }

        return data;
      }
    ],
    beforeChange: [
      ({ data, req, operation }) => {
        if (operation !== 'create') return data;
        const user = req.user as User | ClientUser | null;
        if (!user) throw new Error('Not authenticated');
        if (data.actor && data.actor !== user.id) {
          console.error(
            'Suspicious activity. Actor is not the same as user id'
          );
          throw new Error('Actor is not the same as user id. Logged.');
        }
        if (isSuperAdmin(user) || isStaff(user)) {
          data.actor = user.id;
          data.actorEmailSnapshot = user.email;
          data.actorUsernameSnapshot = user.username;
          data.actorRoleSnapshot = user.roles;
          if (!data.source) {
            data.source = 'admin_ui';
          }
          return data;
        } else {
          throw new Error('Forbidden');
        }
      }
    ]
  },
  fields: [
    {
      name: 'product',
      label: 'Product',
      index: true,
      type: 'relationship',
      relationTo: 'products',
      hasMany: false,
      required: true,
      admin: {
        description: 'Product id'
      }
    },
    // needs to be super-admin, currently no staff table.
    {
      name: 'actionType',
      label: 'Action Type',
      type: 'select',
      required: true,
      index: true,
      options: actionTypes.map((value) => ({
        label: actionTypeLabels[value],
        value
      })),
      admin: {
        description: 'Actions available to be taken for moderation'
      }
    },
    {
      name: 'reason',
      label: 'Reason',
      required: false,
      type: 'select',
      options: moderationSelectOptions.map((value) => ({
        label: moderationSelectOptionsLabel[value],
        value
      })),
      admin: {
        description:
          'Reason used by staff for this moderation action. required for removals or reinstatements).',
        condition: (_data, siblingData) =>
          siblingData?.actionType === 'removed' ||
          siblingData?.actionType === 'reinstated'
      },
      validate: (
        value: string | undefined | null,
        { siblingData }: ModerationActionCtx
      ) => {
        if (
          (siblingData?.actionType === 'removed' && !value) ||
          (siblingData?.actionType === 'reinstated' && !value)
        ) {
          return 'Reason is required when removing or reinstating.';
        }
        return true;
      },
      filterOptions: ({ siblingData }) => {
        if (siblingData?.actionType === 'reinstated') {
          return moderationReinstateReasons.map((value) => ({
            label: moderationSelectOptionsLabel[value],
            value
          }));
        }
        if (siblingData?.actionType === 'removed') {
          return moderationFlagReasons.map((value) => ({
            label: moderationSelectOptionsLabel[value],
            value
          }));
        }
        return [];
      }
    },
    {
      name: 'note',
      label: 'Note',
      required: false,
      type: 'textarea',
      admin: {
        description:
          'Internal note for support (visible only to staff). Use this to document the action taken and reason why. Required for removals or reinstatements',
        condition: (_data, siblingData) =>
          siblingData?.actionType === 'removed' ||
          siblingData?.actionType === 'reinstated'
      },
      validate: (
        value: string | undefined | null,
        { siblingData }: ModerationActionCtx
      ) => {
        const requiresDetail =
          siblingData?.actionType === 'removed' ||
          siblingData?.actionType === 'reinstated';
        if (requiresDetail && !value) {
          return 'Note is required when removing or reinstating.';
        }
        return true;
      }
    },
    {
      name: 'actor',
      label: 'Actor',
      type: 'relationship',
      relationTo: 'users',
      hasMany: false,
      required: true,
      admin: {
        description:
          'The authenticated staff user who performed this action. Set automatically.',
        condition: (_data, _siblingData, { user }) => isSuperAdmin(user)
      },
      access: {
        read: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => !isProd && isSuperAdmin(user)
      },
      filterOptions: ({ user }) => {
        if (!user) return false;
        if (isArrayOfStrings(user.roles)) {
          if (
            user.roles?.includes('super-admin') ||
            user.roles?.includes('support')
          ) {
            return {
              or: [
                { roles: { contains: 'super-admin' } },
                { roles: { contains: 'support' } }
              ]
            };
          }
        }
        return false;
      }
    },
    {
      name: 'actorRoleSnapshot',
      label: 'Actor Role Snapshot',
      type: 'select',
      hasMany: true,
      options: roleTypes.map((value) => ({
        label: roleLabels[value] || value,
        value
      })),
      access: {
        read: ({ req: { user } }) => isSuperAdmin(user)
      },
      admin: {
        description: `Snapshot of the actor’s roles at the moment this action was performed. Set automatically.`,
        condition: (_data, _siblingData, { user }) => isSuperAdmin(user)
      }
    },
    {
      name: 'actorEmailSnapshot',
      label: 'Actor Email Snapshot',
      type: 'email',
      access: {
        create: ({ req: { user } }) => !isProd && isSuperAdmin(user),
        read: ({ req: { user } }) => isSuperAdmin(user),
        update: ({ req: { user } }) => !isProd && isSuperAdmin(user)
      },
      admin: {
        description: 'Historical data for email at time of action.',
        condition: (_data, _siblingData, { user }) => isSuperAdmin(user)
      }
    },
    {
      name: 'actorUsernameSnapshot',
      label: 'Actor Username Snapshot',
      type: 'text',
      access: {
        read: ({ req: { user } }) => isSuperAdmin(user)
      },
      admin: {
        description: 'Historical data for username at time of action.',
        condition: (_data, _siblingData, { user }) => isSuperAdmin(user)
      }
    },
    {
      name: 'source',
      label: 'Source',
      type: 'select',
      index: true,
      options: [...moderationSource],
      defaultValue: 'admin_ui',
      access: {
        read: ({ req: { user } }) => isSuperAdmin(user)
      }
    },
    {
      name: 'intentId',
      label: 'Intent ID',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Dedupe id',
        condition: (_data, _siblingData, { user }) => isSuperAdmin(user)
      },
      access: {
        read: ({ req: { user } }) => isSuperAdmin(user),
        create: () => false,
        update: ({ req: { user } }) => isSuperAdmin(user)
      }
    }
  ]
};
