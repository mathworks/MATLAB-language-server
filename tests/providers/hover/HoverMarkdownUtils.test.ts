// Copyright 2026 The MathWorks, Inc. / Community
import assert from 'assert'
import { formatMatlabHelpToMarkdown } from '../../../src/providers/hover/HoverMarkdownUtils'

describe('HoverMarkdownUtils', () => {
    describe('#formatMatlabHelpToMarkdown', () => {
        it('should return empty string when input is empty or null', () => {
            assert.equal(formatMatlabHelpToMarkdown('', 'disp'), '')
            assert.equal(formatMatlabHelpToMarkdown('   ', 'disp'), '')
        })

        it('should format standard function help with syntax, arguments, and examples', () => {
            const raw = ` disp - Display value of variable

    Syntax
      disp(X)

    Input Arguments
      X - Input array
        array

    Examples
      openExample('matlab/DisplayVariableValuesExample')

    See also format, int2str

    Introduced in MATLAB before R2006a`

            const md = formatMatlabHelpToMarkdown(raw, 'disp')

            assert.ok(md.includes('### `disp`'), 'Should contain function title')
            assert.ok(md.includes('Display value of variable'), 'Should contain purpose description')
            assert.ok(md.includes('#### Syntax\n```matlab\ndisp(X)\n```'), 'Should highlight syntax in code block')
            assert.ok(md.includes('#### Input Arguments'), 'Should have Input Arguments header')
            assert.ok(md.includes('**`X`** — Input array'), 'Should format argument item')
            assert.ok(md.includes('#### Examples\n```matlab'), 'Should format Examples in code block')
            assert.ok(md.includes('**See also:** `format`, `int2str`'), 'Should format See also links')
            assert.ok(md.includes('*Introduced in MATLAB before R2006a*'), 'Should format version info in italics')
        })

        it('should format multi-part syntax with subheaders as comments', () => {
            const raw = ` plot - 2-D line plot

    Syntax
      Vector and Matrix Data
        plot(X,Y)
        plot(Y)

      Table Data
        plot(tbl,xvar,yvar)`

            const md = formatMatlabHelpToMarkdown(raw, 'plot')

            assert.ok(md.includes('% --- Vector and Matrix Data ---'), 'Should convert syntax subheadings to comments')
            assert.ok(md.includes('plot(X,Y)'), 'Should contain plot(X,Y)')
            assert.ok(md.includes('% --- Table Data ---'), 'Should contain Table Data subheader')
            assert.ok(md.includes('plot(tbl,xvar,yvar)'), 'Should contain table plot syntax')
        })

        it('should handle non-standard help without errors', () => {
            const raw = `My custom function description.
Line 2 of description.`

            const md = formatMatlabHelpToMarkdown(raw, 'myfun')

            assert.ok(md.includes('### `myfun`'), 'Should prepend word title')
            assert.ok(md.includes('My custom function description.'), 'Should preserve raw text')
        })
    })
})
