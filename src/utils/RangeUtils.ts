// Copyright 2025 The MathWorks, Inc.

import { Range } from 'vscode-languageserver'
import { arePositionsEqual, isPositionGreaterThanOrEqualTo, isPositionLessThanOrEqualTo } from './PositionUtils'

/**
 * Determines whether a range completely contains another range.
 * 
 * @param a The first range
 * @param b The second range
 * @returns true if range A completely contains range B (i.e.,
 *     no part of range B is outside of range A)
 */
export function rangeContains (a: Range, b: Range): boolean {
    return isPositionGreaterThanOrEqualTo(b.start, a.start)
        && isPositionLessThanOrEqualTo(b.end, a.end)
}

/**
 * Determines whether two ranges are equivalent.
 * 
 * @param a The first range
 * @param b The second range
 * @returns true if range A and range B represent the same range
 */
export function areRangesEqual (a: Range, b: Range): boolean {
    return arePositionsEqual(a.start, b.start) && arePositionsEqual(a.end, b.end)
}
