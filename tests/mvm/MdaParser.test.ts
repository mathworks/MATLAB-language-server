// Copyright 2025 The MathWorks, Inc.

import assert from 'assert'
import sinon from 'sinon'

import parse from '../../src/mvm/MdaParser'
import Logger from '../../src/logging/Logger'

describe('MdaParser', () => {
    describe('#parse', () => {
        it ('should correctly parse simple data types', () => {
            const simpleData = [
                123,    // number
                'abc',  // 1-d char vector
                true    // boolean
            ]

            simpleData.forEach(value => {
                const parsed = parse(value)
                assert.deepStrictEqual(parsed, value)
            })
        })

        it ('should correctly parse a string array', () => {
            const stringArray1 = {
                mwtype: 'string',
                mwsize: [1, 5],
                mwdata: ['hello', 'world', 'foo', 'bar', 'baz']
            }

            const stringArray2 = {
                mwtype: 'string',
                mwsize: [5, 1],
                mwdata: ['hello', 'world', 'foo', 'bar', 'baz']
            }

            const expected = ['hello', 'world', 'foo', 'bar', 'baz']
 
            let actual = parse(stringArray1)
            assert.deepStrictEqual(actual, expected)

            actual = parse(stringArray2)
            assert.deepStrictEqual(actual, expected)
        })

        it ('should correctly parse a 2D string array', () => {
            const stringArray2D = {
                mwtype: 'string',
                mwsize: [2, 3],
                mwdata: ['abc', 'jkl', 'def', 'mno', 'ghi', 'pqr']
            }

            const expected = [
                ['abc', 'def', 'ghi'],
                ['jkl', 'mno', 'pqr']
            ]
            const actual = parse(stringArray2D)
            assert.deepStrictEqual(actual, expected)
        })

        it ('should correctly parse a 2D char vector', () => {
            const charVector2D = {
                mwtype: 'char',
                mwsize: [2, 3],
                mwdata: ['adbecf']
            }

            const expected = ['abc', 'def']
            const actual = parse(charVector2D)
            assert.deepStrictEqual(actual, expected)
        })

        it ('should correctly parse a simple cell array', () => {
            const cellArray = {
                mwtype: 'cell',
                mwsize: [1, 3],
                mwdata: [123, 'abc', true]
            }

            const expected = [123, 'abc', true]
            const actual = parse(cellArray)
            assert.deepStrictEqual(actual, expected)
        })

        it ('should correctly parse a simple 2D cell array', () => {
            const cellArray2D = {
                mwtype: 'cell',
                mwsize: [3, 2],
                mwdata: [123, 'abc', true, 321, 'cba', false]
            }

            const expected = [
                [123, 321],
                ['abc', 'cba'],
                [true, false]
            ]
            const actual = parse(cellArray2D)
            assert.deepStrictEqual(actual, expected)
        })

        it ('should correctly parse a simple struct', () => {
            const struct = {
                field1: 123,
                field2: 'abc',
                field3: true
            }

            const expected = struct
            const actual = parse(struct)
            assert.deepStrictEqual(actual, expected)
        })

        it ('should correctly parse a simple 1D struct array', () => {
            const structArray = {
                mwtype: 'struct',
                mwsize: [1, 3],
                mwdata: {
                    field1: [123, 456, 789],
                    field2: ['abc', 'def', 'ghi'],
                    field3: [true, false, true]
                }
            }

            const expected = [
                {
                    field1: 123,
                    field2: 'abc',
                    field3: true
                },
                {
                    field1: 456,
                    field2: 'def',
                    field3: false
                },
                {
                    field1: 789,
                    field2: 'ghi',
                    field3: true
                }
            ]
            const actual = parse(structArray)
            assert.deepStrictEqual(actual, expected)
        })

        it ('should correctly parse a simple 2D struct array', () => {
            const structArray2D = {
                mwtype: 'struct',
                mwsize: [2, 2],
                mwdata: {
                    field1: [12, 56, 34, 78],
                    field2: ['ab', 'ef', 'cd', 'gh'],
                    field3: [true, false, true, false]
                }
            }

            const expected = [
                [
                    {
                        field1: 12,
                        field2: 'ab',
                        field3: true
                    },
                    {
                        field1: 34,
                        field2: 'cd',
                        field3: true
                    }
                ],
                [
                    {
                        field1: 56,
                        field2: 'ef',
                        field3: false
                    },
                    {
                        field1: 78,
                        field2: 'gh',
                        field3: false
                    }
                ]
            ]
            const actual = parse(structArray2D)
            assert.deepStrictEqual(actual, expected)
        })

        it ('should correctly parse a complex MDA object', () => {
            const complexMda = {
                mwtype: 'cell',
                mwsize: [2, 2],
                mwdata: [
                    {
                        mwtype: 'struct',
                        mwsize: [2, 1],
                        mwdata: {
                            field1: [123, 456],
                            field2: [[1, 2, 3], [4, 5, 6]]
                        }
                    },
                    123,
                    {
                        mwtype: 'string',
                        mwsize: [1, 2],
                        mwdata: ['abc', 'def']
                    },
                    {
                        mwtype: 'cell',
                        mwsize: [1, 2],
                        mwdata: [123, true]
                    }
                ]
            }

            const expected = [
                [
                    [
                        {
                            field1: 123,
                            field2: [1, 2, 3]
                        },
                        {
                            field1: 456,
                            field2: [4, 5, 6]
                        }
                    ],
                    ['abc', 'def']
                ],
                [
                    123,
                    [123, true]
                ]
            ]
            const actual = parse(complexMda)
            assert.deepStrictEqual(actual, expected)
        })

        it ('should warn and not parse unknown mwtype', () => {
            const loggerSpy = sinon.spy(Logger, 'warn')
            
            const unknownType = {
                mwtype: 'unknown',
                mwsize: [1, 1],
                mwdata: ['abc']
            }

            const expected = unknownType
            const actual = parse(unknownType)

            assert.deepStrictEqual(actual, expected)
            assert.ok(loggerSpy.called, 'Logger.warn should be called twice (two messages are printed)')

            loggerSpy.restore()
        })
    })
})
