import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        poolOptions: {
            threads: {
                singleThread: true
            }
        },
        setupFiles: [path.resolve(__dirname, 'src/test-setup.ts')],
        include: ['src/renderer/**/*.spec.ts'],
        reporters: ['default'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: './coverage/renderer',
            include: ['src/renderer/**/*.ts'],
            exclude: [
                'src/renderer/**/*.spec.ts',
                'src/renderer/**/*.test.ts',
                '**/node_modules/**',
                '**/dist/**',
                'src/test-setup.ts',
            ],
        },
    },
    resolve: {
        alias: {
            '@app': path.resolve(__dirname, './src/renderer/app'),
            '@env': path.resolve(__dirname, './src/environments'),
        },
        mainFields: ['module'], // Force ESM for Angular packages
    },
});
