
module.exports = {
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['src/test-setup.ts'],
        include: ['src/**/*.spec.ts'],
        reporters: ['default', 'json', 'html'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
    },
};
