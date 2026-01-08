// Copyright 2022 - 2025 The MathWorks, Inc.

import { Position, Range } from 'vscode-languageserver'

/**
 * Determines whether two positions are equivalent.
 *
 * @param a The first position
 * @param b The second position
 * @returns true if position A and position B represent the same position
 */
export function arePositionsEqual (a: Position, b: Position): boolean {
    return a.line === b.line && a.character === b.character
}

/**
 * Determines whether a position is less than another position.
 *
 * @param a The first position
 * @param b The second position
 * @returns true if position A is before position B
 */
export function isPositionLessThan (a: Position, b: Position): boolean {
    return checkLessThan(a, b)
}

/**
 * Determines whether a position is less than or equal to another position.
 *
 * @param a The first position
 * @param b The second position
 * @returns true if position A is before position B, or the same position
 */
export function isPositionLessThanOrEqualTo (a: Position, b: Position): boolean {
    return checkLessThan(a, b, true)
}

/**
 * Determines whether a position is greater than another position.
 *
 * @param a The first position
 * @param b The second position
 * @returns True if position A is after position B
 */
export function isPositionGreaterThan (a: Position, b: Position): boolean {
    return checkGreaterThan(a, b)
}

/**
 * Determines whether a position is greater than or equal to another position.
 *
 * @param a The first position
 * @param b The second position
 * @returns True if position A is after position B, or the same position
 */
export function isPositionGreaterThanOrEqualTo (a: Position, b: Position): boolean {
    return checkGreaterThan(a, b, true)
}

/**
 * Determines whether a position is within a given range.
 *
 * @param position The position
 * @param range The range
 * @returns True if the position is within the given range; false otherwise
 */
export function isPositionWithinRange (position: Position, range: Range): boolean {
    return isPositionGreaterThanOrEqualTo(position, range.start) && isPositionLessThanOrEqualTo(position, range.end)
}

/**
 * Performs a "less than (or equal to)" check on two positions.
 *
 * @param a The first position
 * @param b The second position
 * @param orEqual Whether or not an "or equal to" check should be performed
 * @returns true if position A is before position B
 */
function checkLessThan (a: Position, b: Position, orEqual = false): boolean {
    if (a.line < b.line) {
        return true
    }

    if (a.line === b.line) {
        return orEqual
            ? a.character <= b.character
            : a.character < b.character
    }

    return false
}

/**
 * Performs a "greater than (or equal to)" check on two positions.
 *
 * @param a The first position
 * @param b The second position
 * @param orEqual Whether or not an "or equal to" check should be performed
 * @returns true if position A is after position B
 */
function checkGreaterThan (a: Position, b: Position, orEqual = false): boolean {
    if (a.line > b.line) {
        return true
    }

    if (a.line === b.line) {
        return orEqual
            ? a.character >= b.character
            : a.character > b.character
    }

    return false
}
