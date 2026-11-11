/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./views/**/*.ejs", "./public/js/**/*.js"],
    darkMode: 'class', // Enables dark mode toggling
    theme: {
        extend: {
            colors: {
                brand: {
                    navy: '#0B0F19',       // Deep background
                    slate: '#1E293B',      // Card background
                    violet: '#8B5CF6',     // Primary Accent
                    cyan: '#06B6D4',       // Secondary Accent
                    light: '#F8FAFC'       // Text color for dark mode
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'], // Modern SaaS font
            },
            boxShadow: {
                'glow-violet': '0 0 20px -5px rgba(139, 92, 246, 0.5)',
                'glow-cyan': '0 0 20px -5px rgba(6, 182, 212, 0.5)',
            }
        },
    },
    plugins: [],
}