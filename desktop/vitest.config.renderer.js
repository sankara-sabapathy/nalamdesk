module.exports = {
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/renderer/**/*.spec.ts'],
        setupFiles: ['src/test-setup.ts'],
        reporters: ['default', 'json', 'html'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/web/**'],
    },
};
