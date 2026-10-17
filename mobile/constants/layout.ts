export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  full: 999,
} as const;

export function cardShadow(theme: 'light' | 'dark') {
  return {
    shadowColor: theme === 'dark' ? '#000' : '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: theme === 'dark' ? 0.35 : 0.12,
    shadowRadius: 14,
    elevation: 6,
  };
}
