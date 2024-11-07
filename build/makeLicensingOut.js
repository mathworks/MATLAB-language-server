// Copyright 2024 The MathWorks, Inc.
const fs = require('fs')
const path = require('path')

const dirPath = path.join(__dirname, '..', 'out', 'licensing', 'static')

fs.mkdir(dirPath, { recursive: true }, (err) => {
    if (err) {
        console.error('Error creating directory: ', err)
    } else {
        console.log('Directory created successfully: ', dirPath)
    }
})
