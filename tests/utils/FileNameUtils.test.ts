// Copyright 2025 The MathWorks, Inc.

import assert from 'assert'
import * as FileNameUtils from '../../src/utils/FileNameUtils'
import path from 'path'

describe('FileNameUtils', () => {
    describe('#isMFile', () => {
        it('should return true for .m files', () => {
            const uri = 'file:///path/to/file.m'
            assert.strictEqual(FileNameUtils.isMFile(uri), true)
        })

        it('should return false for non-.m files', () => {
            const uri = 'file:///path/to/file.txt'
            assert.strictEqual(FileNameUtils.isMFile(uri), false)
        })

        it('should return false for files without extensions', () => {
            const uri = 'file:///path/to/file'
            assert.strictEqual(FileNameUtils.isMFile(uri), false)
        })
    })
    
    describe('#getFilePathFromUri', () => {
        describe('when shouldCoerceToMExt is false', () => {
            it('should return correct path for .m file', () => {
                const uri = 'file:///path/to/file.m'
                const expected = path.join('/path', 'to', 'file.m')
                const actual = FileNameUtils.getFilePathFromUri(uri)
                assert.strictEqual(actual, expected)
            })

            it('should return correct path for .ipynb file', () => {
                const uri = 'file:///path/to/file.ipynb'
                const expected = path.join('/path', 'to', 'file.ipynb')
                const actual = FileNameUtils.getFilePathFromUri(uri)
                assert.strictEqual(actual, expected)
            })

            it('should return correct path for non-M file', () => {
                const uri = 'file:///path/to/file.txt'
                const expected = path.join('/path', 'to', 'file.txt')
                const actual = FileNameUtils.getFilePathFromUri(uri)
                assert.strictEqual(actual, expected)
            })

            it('should return correct path for file without extension', () => {
                const uri = 'file:///path/to/file'
                const expected = path.join('/path', 'to', 'file')
                const actual = FileNameUtils.getFilePathFromUri(uri)
                assert.strictEqual(actual, expected)
            })
        })

        describe('when shouldCoerceToMExt is true', () => {
            it('should return correct path with .m extension for .m file', () => {
                const uri = 'file:///path/to/file.m'
                const expected = path.join('/path', 'to', 'file.m')
                const actual = FileNameUtils.getFilePathFromUri(uri, true)
                assert.strictEqual(actual, expected)
            })

            it('should return "untitled.m" for .ipynb file', () => {
                const uri = 'file:///path/to/file.ipynb'
                const expected = 'untitled.m'
                const actual = FileNameUtils.getFilePathFromUri(uri, true)
                assert.strictEqual(actual, expected)
            })

            it('should return correct path with .m extension for non-M file', () => {
                const uri = 'file:///path/to/file.txt'
                const expected = path.join('/path', 'to', 'file.m')
                const actual = FileNameUtils.getFilePathFromUri(uri, true)
                assert.strictEqual(actual, expected)
            })

            it('should return correct path with .m extension for file without extension', () => {
                const uri = 'file:///path/to/file'
                const expected = path.join('/path', 'to', 'file.m')
                const actual = FileNameUtils.getFilePathFromUri(uri, true)
                assert.strictEqual(actual, expected)
            })
        })
    })
})
