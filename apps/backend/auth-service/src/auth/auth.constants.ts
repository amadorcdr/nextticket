export const AUTH_ROLES = {
  CLIENT: 'CLIENT',
  ORGANIZER: 'ORGANIZER',
  VALIDATOR: 'VALIDATOR',
} as const;

export type AuthRoleName = (typeof AUTH_ROLES)[keyof typeof AUTH_ROLES];

export const AUTH_PROVIDERS = {
  LOCAL: 'LOCAL',
  GOOGLE: 'GOOGLE',
} as const;

export type AuthProviderName = (typeof AUTH_PROVIDERS)[keyof typeof AUTH_PROVIDERS];