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
        // Logo-derived color palette
        'logo': {
          'teal': '#20B2AA',        // Primary brand color from WiFi signals
          'sky': '#87CEEB',         // Sky blue from location pin
          'forest': '#228B22',      // Forest green from landscape
          'ocean': '#1E3A8A',       // Deep blue for text/navigation
          'signal': '#10B981',      // Signal green for success/CTAs
          'cloud': '#F8FAFC',       // Cloud white for backgrounds
          'earth': '#8B4513',       // Earth brown for accents
          'gray': '#6B7280',        // Warm gray for secondary text
        },
        // Legacy color mappings for backward compatibility
        'travel-blue': '#20B2AA',   // Now maps to logo teal
        'travel-orange': '#10B981', // Now maps to logo signal green  
        'travel-green': '#228B22',  // Now maps to logo forest green
      },
      animation: {
        'bounce': 'bounce 1s infinite',
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        'marquee': 'marquee 20s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(-100%)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      gradientColorStops: {
        'logo-gradient': {
          'from': '#20B2AA',
          'via': '#87CEEB', 
          'to': '#1E3A8A',
        }
      }
    },
  },
  plugins: [],
}