/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#050a14',
        surface: 'rgba(26, 31, 46, 0.6)',
        border: 'rgba(0, 229, 255, 0.2)',
        primary: '#00e5ff',
        'primary-dim': 'rgba(0, 229, 255, 0.5)',
      },
      fontFamily: {
        mono: ['"Fira Code"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
