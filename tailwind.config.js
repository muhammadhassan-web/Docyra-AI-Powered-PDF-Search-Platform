import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                docyraBlue: '#002e5d', // Corporate Banking Blue
            }
        },
    },
    plugins: [tailwindcssAnimate],
}
