// Copyright 2025 The MathWorks, Inc.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: './', // To allow the app to be hostable at any endpoint
    build: {
    // Mimicking the structure produced by CRA to avoid changes to matlab-proxy's source code.
        outDir: 'build',
        assetsDir: 'static',
        rollupOptions: {
            output: {
                entryFileNames: 'static/js/[name].[hash].js',
                chunkFileNames: 'static/js/[name].[hash].js',
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name.split('.');
                    let extType = info[info.length - 1];
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico|woff|woff2|ttf|eot/i.test(extType)) {
                        extType = 'media';
                    }
                    return `static/${extType}/[name].[hash][extname]`;
                },
            },
        },
    },
    plugins: [react()],
    test: {
        globals: true, 
        environment: 'jsdom',
        setupFiles: './src/setupTests.js',
        reporters: 'vitest-teamcity-reporter',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html', 'lcov'],
            reportsDirectory: './coverage'
        }
    },
    css: {
        devSourcemap: false
    },
    server: {
        proxy: {
            // Need to specify all API endpoints that matlab-proxy supports. 
            // Static files will be served by vite dev server whereas the rest of the requests will be proxied to the matlab-proxy server.
            
            // Approach 1: Explicitly state all REST endpoints that matlab-proxy handles. This is harder to maintain as there maybe frequent changes to matlab-proxy endpoints
            // '^/(get_status|authenticate|get_auth_token|get_env_config|start_matlab|clear_client_id|stop_matlab|set_licensing_info|update_entitlement|shutdown_integration)': {
            
            // Approach 2: Proxy anything which doesn't match the specified path below. This is easier to maintain as proxy everthing other than static content
            '^(?!/favicon\.ico|/index\.html|/manifest\.json|/robots\.txt|/static/|/index\.css|/src/|/@vite/client|/node_modules/|/@react-refresh).*': {
                // URL at which matlab-proxy server is running at
                target: 'http://localhost:8889',
                changeOrigin: true, 
            }
        }
    }
});
