// Copyright 2024 The MathWorks, Inc.
const fs = require('fs')
const path = require('path')

const sourceDir = path.join(__dirname, '..', 'src', 'licensing', 'gui', 'build')
const targetDir = path.join(__dirname, '..', 'out', 'licensing', 'static')

fs.cp(sourceDir, targetDir, { recursive: true }, (err) => {
    if (err) {
        console.error('Error copying files: ', err)
    } else {
        console.log('Files copied successfully.')
    }
})
