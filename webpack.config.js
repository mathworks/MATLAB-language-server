'use strict'

const path = require('path')

const config = {
    target: 'node',
    mode: 'none',

    entry: './src/index.ts',
    output: {
        path: path.resolve(__dirname, 'out'),
        filename: 'index.js',
        libraryTarget: 'commonjs2'
    },
    devtool: 'source-map',
    resolve: {
        extensions: ['.ts', '.js']
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: 'ts-loader'
                    }
                ]
            }
        ]
    }
}

module.exports = config
