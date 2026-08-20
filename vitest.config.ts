import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'node',
        include: ['server/**/*.test.js', 'src/**/*.test.{ts,tsx}'],
        setupFiles: ['./server/test/env.setup.js'],
        testTimeout: 30000,
        hookTimeout: 60000,
    },
});
