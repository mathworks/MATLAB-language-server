// Copyright 2025 The MathWorks, Inc.

import { Range } from 'vscode-languageserver'
import { isPositionGreaterThanOrEqualTo, isPositionLessThanOrEqualTo } from './PositionUtils'

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
