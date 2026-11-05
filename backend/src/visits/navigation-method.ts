export const NAVIGATION_METHODS = [
  'typed',
  'link',
  'back',
  'forward',
  'history',
  'search',
] as const;
export type NavigationMethod = (typeof NAVIGATION_METHODS)[number];
