
module.exports = {
    test: {
        globals: true,
        environment: 'node',
        environmentMatchGlobs: [
            ['src/renderer/**/*.spec.ts', 'jsdom'],
            ['src/main/**/*.spec.ts', 'node']
        ],
        include: ['src/**/*.spec.ts'],
        reporters: ['default', 'json', 'html'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
    },
};
