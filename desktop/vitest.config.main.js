module.exports = {
    test: {
        globals: true,
        environment: 'node',
        include: ['src/main/**/*.spec.ts'],
        reporters: ['default', 'json', 'html'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: './coverage/main',
            include: ['src/main/**/*.ts'],
            exclude: [
                'src/main/**/*.spec.ts',
                'src/main/**/*.test.ts',
                '**/node_modules/**',
                '**/dist/**',
            ],
        },
        exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/web/**'],
    },
};
