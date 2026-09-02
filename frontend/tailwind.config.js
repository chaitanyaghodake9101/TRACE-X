/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        police: {
          900: '#0b132b',
          800: '#1c2541',
          700: '#3a506b',
          600: '#5bc0be',
          50: '#f0f7f7',
        },
        quality: {
          high: '#10b981',    // Green >= 0.70
          medium: '#f59e0b',  // Yellow 0.40 - 0.70
          low: '#ef4444',     // Red < 0.40
        }
      }
    },
  },
  plugins: [],
}
