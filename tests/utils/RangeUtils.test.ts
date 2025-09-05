// Copyright 2025 The MathWorks, Inc.

import assert from 'assert'

import { Position, Range } from 'vscode-languageserver'
import { rangeContains } from '../../src/utils/RangeUtils'

const posL1C7 = Position.create(1, 7)
const posL3C3 = Position.create(3, 3)
const posL3C4 = Position.create(3, 4)
const posL3C6 = Position.create(3, 6)
const posL3C7 = Position.create(3, 7)
const posL5C5 = Position.create(5, 5)
const posL5C6 = Position.create(5, 6)
const posL7C4 = Position.create(7, 4)

// single-line
const rangeL3C3ToL3C6 = Range.create(posL3C3, posL3C6)
const rangeL3C4ToL3C6 = Range.create(posL3C4, posL3C6)
const rangeL3C4ToL3C7 = Range.create(posL3C4, posL3C7)
const rangeL5C5ToL5C6 = Range.create(posL5C5, posL5C6)

// multi-line
const rangeL1C7ToL7C4 = Range.create(posL1C7, posL7C4)
const rangeL3C3ToL5C5 = Range.create(posL3C3, posL5C5)
const rangeL3C3ToL5C5Dup = Range.create(posL3C3, posL5C5)
const rangeL3C3ToL5C6 = Range.create(posL3C3, posL5C6)

describe('RangeUtils', () => {
    describe('#rangeContains', () => {
        it('should return true when A and B represent the same range', () => {
            assert.ok(rangeContains(rangeL3C3ToL5C5, rangeL3C3ToL5C5Dup))
        })

        it('should return true when A contains B and they end at the same position', () => {
            assert.ok(rangeContains(rangeL3C3ToL3C6, rangeL3C4ToL3C6))
        })

        it('should return true when A contains B and they start at the same position', () => {
            assert.ok(rangeContains(rangeL3C4ToL3C7, rangeL3C4ToL3C6))
        })

        it('should correctly take line numbers into account', () => {
            assert.ok(rangeContains(rangeL1C7ToL7C4, rangeL3C3ToL5C5))
        })

        it('should return false if A starts after B', () => {
            assert.ok(!rangeContains(rangeL3C4ToL3C7, rangeL3C3ToL3C6))
        })

        it('should return false if A ends before B', () => {
            assert.ok(!rangeContains(rangeL3C3ToL5C5, rangeL3C3ToL5C6))
        })

        it("should not return true just because A's character range contains B's", () => {
            assert.ok(!rangeContains(rangeL3C3ToL3C6, rangeL5C5ToL5C6))
        })

        it('should correctly take argument order into account', () => {
            assert.ok(!rangeContains(rangeL3C3ToL5C5, rangeL1C7ToL7C4))
        })
    })
})
