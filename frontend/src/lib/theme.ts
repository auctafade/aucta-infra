// Sprint-2 Design System Theme
// Apple-smooth UX with calm, ultra-clear design tokens

export const theme = {
  // Color palette
  colors: {
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe',
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9',
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e',
    },
    gray: {
      50: '#f9fafb',
      100: '#f3f4f6',
      200: '#e5e7eb',
      300: '#d1d5db',
      400: '#9ca3af',
      500: '#6b7280',
      600: '#4b5563',
      700: '#374151',
      800: '#1f2937',
      900: '#111827',
    },
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      200: '#bbf7d0',
      500: '#22c55e',
      600: '#16a34a',
      700: '#15803d',
    },
    warning: {
      50: '#fefce8',
      100: '#fef3c7',
      200: '#fde68a',
      500: '#eab308',
      600: '#ca8a04',
      700: '#a16207',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      200: '#fecaca',
      500: '#ef4444',
      600: '#dc2626',
      700: '#b91c1c',
    },
  },

  // Typography
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      mono: '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", monospace',
    },
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem', // 30px
      '4xl': '2.25rem', // 36px
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },

  // Spacing (8/12 grid)
  spacing: {
    0: '0',
    1: '0.25rem',  // 4px
    2: '0.5rem',   // 8px
    3: '0.75rem',  // 12px
    4: '1rem',     // 16px
    5: '1.25rem',  // 20px
    6: '1.5rem',   // 24px
    8: '2rem',     // 32px
    10: '2.5rem',  // 40px
    12: '3rem',    // 48px
    16: '4rem',    // 64px
    20: '5rem',    // 80px
    24: '6rem',    // 96px
  },

  // Border radius
  borderRadius: {
    none: '0',
    sm: '0.25rem',   // 4px
    base: '0.5rem',  // 8px
    md: '0.75rem',   // 12px
    lg: '1rem',      // 16px
    xl: '1.25rem',   // 20px
    full: '9999px',
  },

  // Shadows
  shadows: {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  },

  // Transitions
  transitions: {
    fast: '150ms ease-in-out',
    base: '250ms ease-in-out',
    slow: '350ms ease-in-out',
  },

  // Z-index
  zIndex: {
    0: 0,
    10: 10,
    20: 20,
    30: 30,
    40: 40,
    50: 50,
    sticky: 100,
    dropdown: 200,
    modal: 300,
    popover: 400,
    tooltip: 500,
  },

  // Breakpoints
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },
};

// CSS-in-JS helper functions
export const applyTheme = (property: string, value: string) => {
  const path = property.split('.');
  let current: any = theme;
  
  for (const key of path) {
    if (current[key]) {
      current = current[key];
    } else {
      return value; // fallback
    }
  }
  
  return current[value] || value;
};

// Common component styles
export const componentStyles = {
  // Buttons
  button: {
    base: `
      inline-flex items-center justify-center
      font-medium rounded-lg
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
    `,
    primary: `
      bg-blue-600 text-white
      hover:bg-blue-700 active:bg-blue-800
      focus:ring-blue-500
    `,
    secondary: `
      bg-gray-100 text-gray-700
      hover:bg-gray-200 active:bg-gray-300
      focus:ring-gray-500
    `,
    ghost: `
      bg-transparent text-gray-600
      hover:bg-gray-100 active:bg-gray-200
      focus:ring-gray-500
    `,
    sizes: {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    },
  },

  // Inputs
  input: {
    base: `
      w-full px-4 py-2
      bg-white border border-gray-300 rounded-lg
      text-gray-900 placeholder-gray-400
      transition-all duration-200
      focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
      disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
    `,
    error: `
      border-red-500 focus:ring-red-500
    `,
    sizes: {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-5 py-3 text-lg',
    },
  },

  // Cards
  card: {
    base: `
      bg-white rounded-xl
      border border-gray-200
      shadow-sm
    `,
    padding: {
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    },
  },

  // Labels
  label: {
    base: `
      block text-sm font-medium text-gray-700 mb-1
    `,
    required: `
      after:content-['*'] after:ml-0.5 after:text-red-500
    `,
    optional: `
      text-gray-500 font-normal
    `,
  },

  // Sections
  section: {
    base: `
      space-y-6
    `,
    title: `
      text-lg font-semibold text-gray-900
    `,
    subtitle: `
      text-sm text-gray-500 mt-1
    `,
  },
};

// Accessibility utilities
export const a11y = {
  srOnly: `
    absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0
  `,
  focusVisible: `
    focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
  `,
  skipLink: `
    sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4
    bg-blue-600 text-white px-4 py-2 rounded-lg z-50
  `,
};

// Animation utilities
export const animations = {
  fadeIn: `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    animation: fadeIn 250ms ease-in-out;
  `,
  slideUp: `
    @keyframes slideUp {
      from { transform: translateY(10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    animation: slideUp 300ms ease-out;
  `,
  pulse: `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  `,
  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    animation: spin 1s linear infinite;
  `,
};

export default theme;
