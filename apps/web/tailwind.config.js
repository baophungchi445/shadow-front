/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: '#0b0e11',
          900: '#12161b',
          850: '#171c22',
          800: '#1d232a',
          700: '#2a323b',
          600: '#3a444f',
          500: '#56626e',
        },
        mil: { 300: '#b6d98a', 400: '#9cc96a', 500: '#7fb24a', 600: '#62903a', 700: '#4a6d2c' },
        warn: { 400: '#f2a54a', 500: '#e98a2b', 600: '#c86f1a' },
        alert: { 500: '#e04848' },
      },
      fontFamily: {
        display: ['Rajdhani', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
