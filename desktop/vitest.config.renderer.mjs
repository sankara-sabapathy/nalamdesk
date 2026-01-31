import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import path from 'path';

export default defineConfig({
    plugins: [
        angular({
            tsconfig: './tsconfig.spec.json',
            jit: true,
        }),
    ],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: ['src/test-setup.ts'],
        include: ['src/renderer/**/*.spec.ts'],
        reporters: ['default'],
        alias: {
            '@app': path.resolve(__dirname, './src/renderer/app'),
            '@env': path.resolve(__dirname, './src/environments'),
        }
    },
    resolve: {
        mainFields: ['module'], // Force ESM for Angular packages
    },
});
