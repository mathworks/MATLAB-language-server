import assert from 'assert'

import { Position } from "vscode-languageserver"

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
})
