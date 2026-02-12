
/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/renderer/**/*.{html,ts}",
    ],
    safelist: [
        'btn', 'btn-primary', 'btn-secondary', 'btn-ghost', 'btn-error', 'btn-success', 'btn-circle', 'btn-sm', 'btn-outline',
        'badge', 'badge-primary', 'badge-secondary', 'badge-ghost', 'badge-error', 'badge-neutral', 'badge-lg', 'badge-sm',
        'card', 'card-body', 'card-title',
        'table', 'table-lg',
        'stats', 'stat', 'stat-title', 'stat-value',
        'avatar', 'placeholder',
        'join', 'join-item',
        'bg-base-100', 'bg-base-200', 'bg-base-300',
        'bg-primary', 'text-primary', 'text-primary-content', 'text-secondary', 'text-error',
        'py-20', 'gap-4', 'opacity-50', 'opacity-80', 'animate-pulse',
        'backdrop-blur', 'backdrop-blur-xl', 'shadow-2xl', 'shadow-lg', 'shadow-primary',
        'hover:shadow-xl', 'hover:shadow-primary'
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Inter"', 'sans-serif'],
                display: ['"Plus Jakarta Sans"', 'sans-serif'],
            },
        },
    },
    plugins: [
        require('@tailwindcss/typography'),
        require('daisyui'),
    ],
    daisyui: {
        themes: [
            {
                enterprise: {
                    "primary": "#1868db", // User selected blue
                    "primary-content": "#ffffff", // Force pure white text
                    "secondary": "#475569", // Slate 600
                    "secondary-content": "#ffffff",
                    "accent": "#0ea5e9", // Sky 500
                    "accent-content": "#ffffff",
                    "neutral": "#1e293b", // Slate 800
                    "base-100": "#ffffff",
                    "base-200": "#f8fafc", // Slate 50
                    "base-300": "#f1f5f9", // Slate 100
                    "base-content": "#0f172a", // Slate 900

                    "info": "#0ea5e9",
                    "success": "#22c55e",
                    "warning": "#eab308",
                    "error": "#ef4444",
                },
            },
        ],
        darkTheme: "enterprise",
    },
}
