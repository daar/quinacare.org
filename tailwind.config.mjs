/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        qcRed: '#e11d48',
        qcBlack: '#111111',
        qcGray: '#fcfcfc'
      },
      fontFamily: {
        arimo: ['Arimo', 'sans-serif']
      }
    }
  },
  plugins: []
};
