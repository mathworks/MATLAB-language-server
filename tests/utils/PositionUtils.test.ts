// Copyright 2025 The MathWorks, Inc.

import assert from 'assert'

import { Position, Range } from 'vscode-languageserver'

import * as PositionUtils from '../../src/utils/PositionUtils'

describe('PositionUtils', () => {
    describe('#isPositionLessThan', () => {
        it('should return true when A is less than B on same line', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(3, 8)
            assert.ok(PositionUtils.isPositionLessThan(posA, posB))
        })

        it('should return true when A is less than B on different lines', () => {
            const posA = Position.create(2, 8)
            const posB = Position.create(3, 5)
            assert.ok(PositionUtils.isPositionLessThan(posA, posB))
        })

        it('should return false when A is equal to B', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(3, 5)
            assert.ok(!PositionUtils.isPositionLessThan(posA, posB))
        })

        it('should return false when A is greater than B on same line', () => {
            const posA = Position.create(3, 8)
            const posB = Position.create(3, 5)
            assert.ok(!PositionUtils.isPositionLessThan(posA, posB))
        })

        it('should return false when A is greater than B on different lines', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(2, 8)
            assert.ok(!PositionUtils.isPositionLessThan(posA, posB))
        })
    })

    describe('#isPositionLessThanOrEqualTo', () => {
        it('should return true when A is less than B on same line', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(3, 8)
            assert.ok(PositionUtils.isPositionLessThanOrEqualTo(posA, posB))
        })

        it('should return true when A is less than B on different lines', () => {
            const posA = Position.create(2, 8)
            const posB = Position.create(3, 5)
            assert.ok(PositionUtils.isPositionLessThanOrEqualTo(posA, posB))
        })

        it('should return true when A is equal to B', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(3, 5)
            assert.ok(PositionUtils.isPositionLessThanOrEqualTo(posA, posB))
        })

        it('should return false when A is greater than B on same line', () => {
            const posA = Position.create(3, 8)
            const posB = Position.create(3, 5)
            assert.ok(!PositionUtils.isPositionLessThanOrEqualTo(posA, posB))
        })

        it('should return false when A is greater than B on different lines', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(2, 8)
            assert.ok(!PositionUtils.isPositionLessThanOrEqualTo(posA, posB))
        })
    })

    describe('#isPositionGreaterThan', () => {
        it('should return true when A is greater than B on same line', () => {
            const posA = Position.create(3, 8)
            const posB = Position.create(3, 5)
            assert.ok(PositionUtils.isPositionGreaterThan(posA, posB))
        })

        it('should return true when A is greater than B on different lines', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(2, 8)
            assert.ok(PositionUtils.isPositionGreaterThan(posA, posB))
        })

        it('should return false when A is equal to B', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(3, 5)
            assert.ok(!PositionUtils.isPositionGreaterThan(posA, posB))
        })

        it('should return false when A is less than B on the same line', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(3, 8)
            assert.ok(!PositionUtils.isPositionGreaterThan(posA, posB))
        })

        it('should return false when A is less than B on different lines', () => {
            const posA = Position.create(2, 8)
            const posB = Position.create(3, 5)
            assert.ok(!PositionUtils.isPositionGreaterThan(posA, posB))
        })
    })

    describe('#isPositionGreaterThanOrEqualTo', () => {
        it('should return true when A is greater than B on same line', () => {
            const posA = Position.create(3, 8)
            const posB = Position.create(3, 5)
            assert.ok(PositionUtils.isPositionGreaterThanOrEqualTo(posA, posB))
        })

        it('should return true when A is greater than B on different lines', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(2, 8)
            assert.ok(PositionUtils.isPositionGreaterThanOrEqualTo(posA, posB))
        })

        it('should return true when A is equal to B', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(3, 5)
            assert.ok(PositionUtils.isPositionGreaterThanOrEqualTo(posA, posB))
        })

        it('should return false when A is less than B on the same line', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(3, 8)
            assert.ok(!PositionUtils.isPositionGreaterThanOrEqualTo(posA, posB))
        })

        it('should return false when A is less than B on different lines', () => {
            const posA = Position.create(2, 8)
            const posB = Position.create(3, 5)
            assert.ok(!PositionUtils.isPositionGreaterThanOrEqualTo(posA, posB))
        })
    })

    describe('#arePositionsEqual', () => {
        it('should return true when both line and character are equal', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(3, 5)
            assert.ok(PositionUtils.arePositionsEqual(posA, posB))
        })

        it('should return false when lines are equal but characters are not', () => {
            const posA = Position.create(3, 5)
            const posB = Position.create(3, 8)
            assert.ok(!PositionUtils.arePositionsEqual(posA, posB))
        })

        it('should return false when characters are equal but lines are not', () => {
            const posA = Position.create(2, 5)
            const posB = Position.create(3, 5)
            assert.ok(!PositionUtils.arePositionsEqual(posA, posB))
        })

        it('should return false when both line and character are not equal', () => {
            const posA = Position.create(2, 5)
            const posB = Position.create(3, 8)
            assert.ok(!PositionUtils.arePositionsEqual(posA, posB))
        })
    })

    describe('#isPositionWithinRange', () => {
        it('should return false when position is before the range', () => {
            const position = Position.create(2, 6)
            const range = Range.create(3, 5, 5, 10)
            assert.ok(!PositionUtils.isPositionWithinRange(position, range))
        })

        it('should return true when position is at the range start', () => {
            const position = Position.create(1, 0)
            const range = Range.create(1, 0, 4, 15)
            assert.ok(PositionUtils.isPositionWithinRange(position, range))
        })

        it('should return true when position is in the middle of the range', () => {
            const position = Position.create(7, 1)
            const range = Range.create(6, 8, 9, 20)
            assert.ok(PositionUtils.isPositionWithinRange(position, range))
        })

        it('should return true when position is at the range end', () => {
            const position = Position.create(10, 25)
            const range = Range.create(8, 3, 10, 25)
            assert.ok(PositionUtils.isPositionWithinRange(position, range))
        })

        it('should return false when position is after the range', () => {
            const position = Position.create(14, 35)
            const range = Range.create(12, 0, 14, 30)
            assert.ok(!PositionUtils.isPositionWithinRange(position, range))
        })
    })
})
