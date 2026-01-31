module.exports = {
    test: {
        globals: true,
        environment: 'node',
        include: ['src/main/**/*.spec.ts'],
        reporters: ['default', 'json', 'html'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/web/**'],
    },
};
