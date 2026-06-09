export type AppTheme = 'burgundy' | 'emerald' | 'ocean' | 'lavender' | 'night' | 'royal' | 'coffee';

export const THEMES: Record<AppTheme, {
  name: string;
  colors: {
    '--sap-primary': string;
    '--sap-primary-hover': string;
    '--sap-secondary': string;
    '--sap-shell': string;
    '--sap-background': string;
    '--sap-surface': string;
    '--sap-border': string;
    '--sap-text': string;
    '--sap-text-variant': string;
    '--sap-highlight': string;
  }
}> = {
  burgundy: {
    name: 'النبيتي (الافتراضي)',
    colors: {
      '--sap-primary': '#800020',
      '--sap-primary-hover': '#5e0018',
      '--sap-secondary': '#C5A059',
      '--sap-shell': '#2D3748',
      '--sap-background': '#F9FAFB',
      '--sap-surface': '#ffffff',
      '--sap-border': '#E2E8F0',
      '--sap-text': '#1A202C',
      '--sap-text-variant': '#718096',
      '--sap-highlight': '#FDF2F8'
    }
  },
  emerald: {
    name: 'الزمردي (الطبيعة)',
    colors: {
      '--sap-primary': '#059669',
      '--sap-primary-hover': '#047857',
      '--sap-secondary': '#F59E0B',
      '--sap-shell': '#1E293B',
      '--sap-background': '#F8FAFC',
      '--sap-surface': '#ffffff',
      '--sap-border': '#E2E8F0',
      '--sap-text': '#0F172A',
      '--sap-text-variant': '#64748B',
      '--sap-highlight': '#ECFDF5'
    }
  },
  ocean: {
    name: 'المحيطي (هادئ)',
    colors: {
      '--sap-primary': '#0284C7',
      '--sap-primary-hover': '#0369A1',
      '--sap-secondary': '#38BDF8',
      '--sap-shell': '#172554',
      '--sap-background': '#F0F9FF',
      '--sap-surface': '#ffffff',
      '--sap-border': '#E0F2FE',
      '--sap-text': '#082F49',
      '--sap-text-variant': '#0284C7',
      '--sap-highlight': '#E0F2FE'
    }
  },
  lavender: {
    name: 'اللافندر (عصري)',
    colors: {
      '--sap-primary': '#7C3AED',
      '--sap-primary-hover': '#6D28D9',
      '--sap-secondary': '#F472B6',
      '--sap-shell': '#2E1065',
      '--sap-background': '#FAF5FF',
      '--sap-surface': '#ffffff',
      '--sap-border': '#E9D5FF',
      '--sap-text': '#3B0764',
      '--sap-text-variant': '#7E22CE',
      '--sap-highlight': '#F3E8FF'
    }
  },
  night: {
    name: 'الوضع الليلي',
    colors: {
      '--sap-primary': '#38BDF8',
      '--sap-primary-hover': '#0EA5E9',
      '--sap-secondary': '#C084FC',
      '--sap-shell': '#0F172A',
      '--sap-background': '#020617',
      '--sap-surface': '#1E293B',
      '--sap-border': '#334155',
      '--sap-text': '#F8FAFC',
      '--sap-text-variant': '#94A3B8',
      '--sap-highlight': '#0B1120'
    }
  },
  royal: {
    name: 'الذهبي الملكي',
    colors: {
      '--sap-primary': '#B8860B', // Dark Goldenrod
      '--sap-primary-hover': '#9B7617',
      '--sap-secondary': '#1A1A1A',
      '--sap-shell': '#111111',
      '--sap-background': '#FAFAFA',
      '--sap-surface': '#ffffff',
      '--sap-border': '#EAEAEA',
      '--sap-text': '#2A2A2A',
      '--sap-text-variant': '#888888',
      '--sap-highlight': '#FFF9E6'
    }
  },
  coffee: {
    name: 'القهوة (دافئ)',
    colors: {
      '--sap-primary': '#5D4037', // Brown
      '--sap-primary-hover': '#3E2723',
      '--sap-secondary': '#D7CCC8',
      '--sap-shell': '#3E2723',
      '--sap-background': '#FDFBF7',
      '--sap-surface': '#ffffff',
      '--sap-border': '#EFEBE9',
      '--sap-text': '#3E2723',
      '--sap-text-variant': '#8D6E63',
      '--sap-highlight': '#EFEBE9'
    }
  }
};

export const applyTheme = (themeNode: AppTheme) => {
  const theme = THEMES[themeNode] || THEMES.burgundy;
  Object.entries(theme.colors).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
};
