export const VFS_PAGE_PROFILES = {
  STANDARD_V1: 'VFS_STANDARD_V1',
  CALENDAR_V1: 'VFS_CALENDAR_V1',
  EARLIEST_SLOT_V1: 'VFS_EARLIEST_SLOT_V1',
} as const;

export type VfsPageProfileType =
  (typeof VFS_PAGE_PROFILES)[keyof typeof VFS_PAGE_PROFILES];

export interface VfsPageProfileDefinition {
  profileId: VfsPageProfileType | string;
  availabilityUiType: 'CALENDAR' | 'EARLIEST_SLOT';
  description: string;
}

export const KNOWN_VFS_PAGE_PROFILES: Record<string, VfsPageProfileDefinition> = {
  [VFS_PAGE_PROFILES.STANDARD_V1]: {
    profileId: VFS_PAGE_PROFILES.STANDARD_V1,
    availabilityUiType: 'EARLIEST_SLOT',
    description: 'Standard VFS sequential booking wizard with earliest slot banner',
  },
  [VFS_PAGE_PROFILES.CALENDAR_V1]: {
    profileId: VFS_PAGE_PROFILES.CALENDAR_V1,
    availabilityUiType: 'CALENDAR',
    description: 'Interactive monthly appointment calendar grid with time slot pills',
  },
  [VFS_PAGE_PROFILES.EARLIEST_SLOT_V1]: {
    profileId: VFS_PAGE_PROFILES.EARLIEST_SLOT_V1,
    availabilityUiType: 'EARLIEST_SLOT',
    description: 'Dedicated earliest-slot appointment page',
  },
};
