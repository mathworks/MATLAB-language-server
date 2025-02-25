// Copyright 2025 The MathWorks, Inc.
import Logger from '../logging/Logger'

/* eslint-disable @typescript-eslint/no-explicit-any */

// Currently, parsing does not support n-dimensional matrices where n > 2
type Size = [nRows: number, nCols: number]

interface MatlabDataArray {
    mwtype: string
    mwsize: Size
    mwdata: any
}

function isMatlabDataArray (obj: any): obj is MatlabDataArray {
    return obj != null && typeof obj === 'object' && 'mwtype' in obj && 'mwsize' in obj && 'mwdata' in obj
}

/**
 * Parses a value returned by the MVM. This parser will remove the
 * MATLAB Data Array format and return a value which is much closer
 * to the data's format in MATLAB.
 *
 * Note: There are values which are representable in MATLAB but not
 * in JavaScript. This does not attempt to handle those cases, as
 * they are not currently necessary in the language server.
 *
 * @param obj A value or object returned by the MVM
 * @returns A parsed value or object
 */
export default function parse (obj: any): any {
    if (isMatlabDataArray(obj)) {
        if (obj.mwsize.length !== 2) {
            Logger.error(`Unexpected size when parsing: [${obj.mwsize.join(', ')}]`)
        }

        switch (obj.mwtype) {
            case 'string':
                return parseString(obj)
            case 'char':
                return parseCharVector(obj)
            case 'cell':
                return parseCellArray(obj)
            case 'struct':
                return parseStructArray(obj)
            default:
                Logger.warn(`Unexpected mwtype encountered: ${obj.mwtype}`)
                Logger.warn('  An additional parser may be needed.')
                return obj
        }
    } else if (Array.isArray(obj)) {
        // Handle simple matrices
        return parseArray(obj)
    } else if (typeof obj === 'object') {
        // Handle structs
        return parseStruct(obj)
    } else {
        // Basic data types (e.g. numbers, 1-D char vectors, booleans)
        return obj
    }
}

/**
 * Parses an array, recursively parsing each item within the array.
 *
 * @param obj An array representing a basic MATLAB matrix
 * @returns A recursively parsed array
 */
function parseArray (obj: any[]): any[] {
    if (obj.length === 1) {
        // 1-D arrays are wrapped in an extra array
        return obj[0].map(parse)
    } else {
        return obj.map(parse)
    }
}

/**
 * Parses a MATLAB struct object, recursively parsing the values of each field.
 *
 * @param obj An object representing a MATLAB struct
 * @returns A recursively parsed object
 */
function parseStruct (obj: {[key: string]: any}, index?: number): any {
    const parsedStruct: any = {}
    for (const key in obj) {
        if (key in obj) {
            parsedStruct[key] = (index == null) ? parse(obj[key]) : parse(obj[key][index])
        }
    }
    return parsedStruct
}

function parseStructArray (obj: MatlabDataArray): any {
    const parsedStructArray: any[] = []
    const length = obj.mwsize[0] * obj.mwsize[1]
    for (let i = 0; i < length; i++) {
        parsedStructArray.push(parseStruct(obj.mwdata, i))
    }

    // Now, still may need to reformat the data, but do not need to re-parse
    return reformatData(parsedStructArray, obj.mwsize, false)
}

/**
 * Parses a MATLAB string
 *
 * @param obj A MATLAB Data Array representing a string
 * @returns The parsed string(s)
 */
function parseString (obj: MatlabDataArray): string | string[] {
    return reformatData(obj.mwdata, obj.mwsize, false) // No need to recursively parse the contents - we know they are strings
}

/**
 * Parses a MATLAB char vector
 *
 * @param obj A MATLAB Data Array representing a char vector
 * @returns The parsed char vector(s)
 */
function parseCharVector (obj: MatlabDataArray): string | string[] {
    return reformatCharVector(obj.mwdata[0] as string, obj.mwsize)
}

/**
 * Parses a MATLAB cell array.
 *
 * @param obj A MATLAB Data Array representing a cell array
 * @returns The parsed cell array
 */
function parseCellArray (obj: MatlabDataArray): any[] {
    return reformatData(obj.mwdata, obj.mwsize)
}

/**
 * Reformats an array of values into the specified size. If the size is 1-dimensional,
 * the values are simply mapped and parsed (if requested). For 2-dimensional sizes,
 * the values are reformatted into a 2D array.
 *
 * This is because the MATLAB Data Array format stores values in a 1-dimensional array,
 * even for 2-dimensional matrices, in a column-major order.
 *
 * Special case: If the desired size has has a value of 0 in any dimension, an empty
 * array will be returned.
 *
 * @param values The data to be reformatted
 * @param size The size the data should be reformatted to
 * @param shouldParse Whether or not the values should be recursively parsed.
 * @returns An array of the desired size containing the reformatted and (optionally) parsed values.
 */
function reformatData (values: any[], size: Size, shouldParse: boolean = true): any {
    const [nRows = 1, nCols = 1] = size

    if (nRows === 0 || nCols === 0) {
        // If 0-dimensional, return an empty array
        return []
    }

    if (nRows === 1 || nCols === 1) {
        // If 1-dimensional, no need to reformat. Just parse the data.
        return values.map(value => shouldParse ? parse(value) : value)
    }

    const result: any[][] = []
    for (let r = 0; r < nRows; r++) {
        const rowVals: any[] = []
        for (let c = 0; c < nCols; c++) {
            const index = r + c * nRows
            let value = values[index]

            if (shouldParse) {
                value = parse(value)
            }

            rowVals.push(value)
        }
        result.push(rowVals)
    }

    return result
}

/**
 * Similar to {@link reformatData}, this function reformats a character vector based on
 * the specified size.
 *
 * Special case: If the desired size has a value of 0 in any dimension, an empty
 * string will be returned.
 *
 * @param charVector The string representing the character vector
 * @param size The size the data should be reformatted to
 * @returns A string or array of the desired size containing the reformatted char vector
 */
function reformatCharVector (charVector: string, size: Size): string | string[] {
    const [nRows = 1, nCols = 1] = size

    if (nRows === 0 || nCols === 0) {
        // If 0-dimensional, return an empty string
        return ''
    }

    if (nRows === 1 || nCols === 1) {
        // 1D char vector
        return charVector
    }

    const result = []
    for (let r = 0; r < nRows; r++) {
        let rowVal = ''
        for (let c = 0; c < nCols; c++) {
            const index = r + c * nRows
            const charVal = charVector.charAt(index)
            rowVal += charVal
        }
        result.push(rowVal)
    }
    return result
}
