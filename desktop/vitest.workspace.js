module.exports = [
    {
        extends: './vitest.config.js',
        test: {
            name: 'renderer',
            include: ['src/renderer/**/*.spec.ts'],
            environment: 'jsdom',
        },
    },
    {
        extends: './vitest.config.js',
        test: {
            name: 'main',
            include: ['src/main/**/*.spec.ts', 'src/shared/**/*.spec.ts', 'src/server/**/*.spec.ts'],
            environment: 'node',
        },
    },
];
