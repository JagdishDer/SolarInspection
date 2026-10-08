/** Design tokens for the field-service UI. Kept flat and dependency-free. */

export const colors = {
  background: '#F4F6F8',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F4',
  border: '#DFE4EA',

  text: '#101828',
  textSecondary: '#52607A',
  textTertiary: '#8A94A6',

  primary: '#0B5FFF',
  primaryPressed: '#0A54E4',
  primarySoft: '#E8F0FF',

  success: '#128A50',
  successSoft: '#E4F6EC',
  warning: '#B25E09',
  warningSoft: '#FCEFE0',
  danger: '#C0392F',
  dangerSoft: '#FAE7E5',

  offline: '#64748B',
  offlineSoft: '#E9EDF2',

  /** Solar theme accents. */
  sun: '#F5A623',
  sunDeep: '#D97706',
  sunSoft: '#FCF0DC',
  skySoft: '#EAF2FF',
  panelDark: '#243044',
  hill: '#DCE8D6',
  hillDeep: '#C7DABD',

  tabBarActive: '#0B5FFF',
  tabBarInactive: '#8A94A6',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' as const, color: colors.text },
  heading: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.textSecondary },
  caption: { fontSize: 12, color: colors.textTertiary },
} as const;

/** Minimum touch target height for interactive elements (accessibility). */
export const touchTarget = 48;

export const listMargins = {
  /** Horizontal padding applied to list content containers. */
  horizontal: 16,
  /** Gap between cards inside virtualized lists. */
  cardGap: 12,
  /** Bottom padding so content clears the tab bar. */
  bottom: 32,
} as const;
