/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Enhanced logo-derived color palette with better contrast ratios
        'logo': {
          'teal': '#0891b2',        // WCAG AA compliant contrast
          'sky': '#0ea5e9',         // Enhanced sky blue
          'forest': '#059669',      // Deeper forest green
          'ocean': '#1e40af',       // Rich ocean blue
          'signal': '#10b981',      // Vibrant signal green
          'cloud': '#f8fafc',       // Pure cloud white
          'earth': '#92400e',       // Rich earth brown
          'gray': '#6b7280',        // Balanced gray
        },
        
        // Text hierarchy colors
        'text': {
          'primary': '#111827',     // Near black for maximum readability
          'secondary': '#4b5563',   // Dark gray for secondary content
          'light': '#6b7280',       // Light gray for tertiary content
          'inverse': '#f9fafb',     // Light text for dark backgrounds
        },
        
        // Background color system
        'bg': {
          'primary': '#ffffff',     // Pure white
          'secondary': '#f9fafb',   // Light gray
          'accent': '#f3f4f6',      // Accent background
          'dark': '#1f2937',        // Dark background
        },
        
        // Status colors with accessibility in mind
        'status': {
          'success': '#059669',     // Success green
          'warning': '#d97706',     // Warning orange
          'error': '#dc2626',       // Error red
          'info': '#0891b2',        // Info blue
        },
        
        // Legacy color mappings for backward compatibility
        'travel-blue': '#0891b2',   // Enhanced teal
        'travel-orange': '#10b981', // Signal green  
        'travel-green': '#059669',  // Forest green
      },
      
      fontFamily: {
        'sans': ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        'display': ['Inter', 'system-ui', 'sans-serif'],
      },
      
      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1.2' }],
        '6xl': ['3.75rem', { lineHeight: '1.1' }],
        '7xl': ['4.5rem', { lineHeight: '1.1' }],
      },
      
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      
      animation: {
        'bounce-gentle': 'bounceGentle 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-gentle': 'pulseGentle 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
      },
      
      keyframes: {
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(40px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGentle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
      },
      
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 30px -5px rgba(0, 0, 0, 0.1)',
        'strong': '0 10px 40px -10px rgba(0, 0, 0, 0.15), 0 20px 50px -10px rgba(0, 0, 0, 0.1)',
        'glow-teal': '0 0 20px rgba(8, 145, 178, 0.3)',
        'glow-signal': '0 0 20px rgba(16, 185, 129, 0.3)',
      },
      
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
      },
      
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-hero': 'linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)',
        'gradient-cta': 'linear-gradient(135deg, #0891b2 0%, #1e40af 100%)',
        'gradient-accent': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
      },
      
      // Screen reader only utilities
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
      },
      
      // Custom aspect ratios
      aspectRatio: {
        'auto': 'auto',
        'square': '1 / 1',
        'video': '16 / 9',
        'photo': '4 / 3',
        'golden': '1.618 / 1',
      },
      
      // Z-index scale
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
      
      // Container queries support
      container: {
        center: true,
        padding: {
          DEFAULT: '1rem',
          sm: '1.5rem',
          lg: '2rem',
          xl: '2.5rem',
          '2xl': '3rem',
        },
        screens: {
          sm: '640px',
          md: '768px',
          lg: '1024px',
          xl: '1280px',
          '2xl': '1400px',
        },
      },
    },
  },
  
  plugins: [
    // Custom plugin for additional utilities
    function({ addUtilities, addComponents, theme }) {
      // Add focus-visible utilities for better accessibility
      addUtilities({
        '.focus-visible': {
          '&:focus-visible': {
            outline: '2px solid ' + theme('colors.logo.teal'),
            outlineOffset: '2px',
            borderRadius: theme('borderRadius.md'),
          },
        },
        
        // Screen reader only content
        '.sr-only': {
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: '0',
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
        },
        
        // Skip link for accessibility
        '.skip-link': {
          position: 'absolute',
          top: '-40px',
          left: '6px',
          background: theme('colors.logo.ocean'),
          color: 'white',
          padding: '8px',
          textDecoration: 'none',
          borderRadius: theme('borderRadius.md'),
          zIndex: '1000',
          '&:focus': {
            top: '6px',
          },
        },
        
        // Loading state utilities
        '.loading': {
          position: 'relative',
          pointerEvents: 'none',
          '&::after': {
            content: '""',
            position: 'absolute',
            width: '16px',
            height: '16px',
            margin: 'auto',
            border: '2px solid transparent',
            borderTopColor: 'currentColor',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          },
        },
      });
      
      // Add component classes
      addComponents({
        '.btn': {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '44px',
          paddingLeft: theme('spacing.6'),
          paddingRight: theme('spacing.6'),
          paddingTop: theme('spacing.3'),
          paddingBottom: theme('spacing.3'),
          fontSize: theme('fontSize.base[0]'),
          fontWeight: theme('fontWeight.semibold'),
          lineHeight: theme('fontSize.base[1].lineHeight'),
          borderRadius: theme('borderRadius.lg'),
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'none',
          transition: 'all 0.2s ease',
          '&:focus-visible': {
            outline: '2px solid ' + theme('colors.logo.teal'),
            outlineOffset: '2px',
          },
          '&:disabled': {
            opacity: '0.5',
            cursor: 'not-allowed',
            pointerEvents: 'none',
          },
        },
        
        '.card-hover': {
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: theme('boxShadow.strong'),
          },
        },
        
        '.text-gradient': {
          background: 'linear-gradient(135deg, ' + theme('colors.logo.teal') + ' 0%, ' + theme('colors.logo.ocean') + ' 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        },
      });
    },
  ],
  
  // Ensure dark mode support
  darkMode: 'class',
  
  // Experimental features
  experimental: {
    optimizeUniversalDefaults: true,
  },
  
  // Future flags for upcoming features
  future: {
    hoverOnlyWhenSupported: true,
  },
};