
module.exports = {
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['src/test-setup.ts'],
        reporters: ['default', 'json', 'html'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/server/**', '**/web/**'],
    },
};
