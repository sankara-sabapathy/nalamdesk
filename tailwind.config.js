
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
        'bg-error', 'bg-gradient-to-r', 'from-primary', 'to-secondary', 'bg-clip-text', 'text-transparent',
        'backdrop-blur', 'backdrop-blur-xl', 'shadow-2xl', 'shadow-lg', 'shadow-primary',
        'hover:shadow-xl', 'hover:shadow-primary'
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Inter"', 'sans-serif'],
                display: ['"Plus Jakarta Sans"', 'sans-serif'],
            },
            colors: {
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9',
                    600: '#0284c7', // Brand Primary
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c4a6e',
                },
                secondary: {
                    50: '#f8fafc',
                    100: '#f1f5f9',
                    200: '#e2e8f0',
                    300: '#cbd5e1',
                    400: '#94a3b8',
                    500: '#64748b',
                    600: '#475569',
                    700: '#334155',
                    800: '#1e293b',
                    900: '#0f172a',
                }
            }
        },
    },
    plugins: [
        require('daisyui'),
    ],
    daisyui: {
        themes: [
            {
                light: {
                    "primary": "#2563eb", // Blue 600 - Standard Blue
                    "primary-content": "#ffffff",
                    "secondary": "#475569", // Slate 600
                    "secondary-content": "#ffffff",
                    "accent": "#059669", // Emerald 600 - Standard Green
                    "accent-content": "#ffffff",
                    "neutral": "#1e293b", // Slate 800
                    "neutral-content": "#ffffff",
                    "base-100": "#ffffff",
                    "base-200": "#e5e7eb", // Gray 200 - Clearly distinct from white
                    "base-300": "#d1d5db", // Gray 300
                    "base-content": "#1f2937", // Gray 800
                    "info": "#3b82f6",
                    "success": "#16a34a", // Green 600
                    "warning": "#eab308",
                    "error": "#ef4444",
                    "--rounded-box": "0.5rem",
                    "--rounded-btn": "0.3rem",
                    "--rounded-badge": "1.9rem",
                    "--animation-btn": "0.2s",
                    "--animation-input": "0.2s",
                    "--btn-focus-scale": "0.98",
                    "--border-btn": "1px",
                    "--tab-border": "1px",
                    "--tab-radius": "0.3rem",
                },
                dark: {
                    "primary": "#38bdf8", // Sky 400
                    "primary-content": "#0f172a",
                    "secondary": "#94a3b8", // Slate 400
                    "secondary-content": "#0f172a",
                    "accent": "#2dd4bf", // Teal 400
                    "accent-content": "#0f172a",
                    "neutral": "#cbd5e1", // Slate 300
                    "neutral-content": "#0f172a",
                    "base-100": "#0f172a", // Slate 900
                    "base-200": "#1e293b", // Slate 800
                    "base-300": "#334155", // Slate 700
                    "base-content": "#f8fafc", // Slate 50
                    "info": "#60a5fa",
                    "success": "#4ade80",
                    "warning": "#facc15",
                    "error": "#f87171",
                    "--rounded-box": "0.5rem",
                    "--rounded-btn": "0.3rem",
                    "--rounded-badge": "1.9rem",
                    "--animation-btn": "0.2s",
                    "--animation-input": "0.2s",
                    "--btn-focus-scale": "0.98",
                    "--border-btn": "1px",
                    "--tab-border": "1px",
                    "--tab-radius": "0.3rem",
                },
            },
        ],
    },
}
