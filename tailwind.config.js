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
        'travel-orange': '#ff6b35',
        'travel-blue': '#004e89',
        'travel-green': '#1a936f',
      },
    },
  },
  plugins: [],
}