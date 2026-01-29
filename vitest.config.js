
module.exports = {
    test: {
        globals: true,
        reporters: ['default', 'json', 'html'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
        exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/server/**', '**/web/**'],
    },
};
