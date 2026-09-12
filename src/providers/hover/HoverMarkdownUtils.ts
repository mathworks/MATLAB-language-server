// Copyright 2026 The MathWorks, Inc. / Community
// Formats raw MATLAB help output into structured, rich Markdown for LSP Hover

/**
 * Converts raw MATLAB help text into structured Markdown with code highlighting
 * for syntax and examples, and clean text formatting for arguments and descriptions.
 *
 * @param rawHelp The raw text returned by MATLAB help() or database
 * @param word The symbol/function name being queried
 * @returns Structured Markdown string
 */
export function formatMatlabHelpToMarkdown (rawHelp: string, word: string): string {
    if (rawHelp == null || rawHelp.trim() === '') {
        return ''
    }

    const lines = rawHelp.split(/\r?\n/)
    let md = ''

    // 1. Extract function title and short purpose from top line (e.g. "disp - Display value of variable")
    let startIdx = 0
    for (let i = 0; i < Math.min(lines.length, 6); i++) {
        const trimmed = lines[i].trim()
        const headerMatch = trimmed.match(/^([a-zA-Z0-9_.]+)\s+-\s+(.+)$/)
        if (headerMatch != null) {
            const funcName = headerMatch[1]
            const purpose = headerMatch[2]
            md += `### \`${funcName}\`\n\n${purpose}\n\n`
            startIdx = i + 1
            break
        }
    }

    if (md === '' && word !== '') {
        md += `### \`${word}\`\n\n`
    }

    type SectionType = 'none' | 'syntax' | 'args' | 'examples' | 'seealso' | 'misc'
    let currentSection: SectionType = 'none'
    let buffer: string[] = []

    const flushSection = (): void => {
        if (buffer.length === 0) return
        const text = buffer.join('\n').trim()
        buffer = []
        if (text === '') return

        switch (currentSection) {
            case 'syntax':
                md += `#### Syntax\n\`\`\`matlab\n${text}\n\`\`\`\n\n`
                break
            case 'examples':
                md += `#### Examples\n\`\`\`matlab\n${text}\n\`\`\`\n\n`
                break
            case 'args':
            case 'seealso':
            case 'misc':
            default:
                md += `${text}\n\n`
                break
        }
    }

    for (let i = startIdx; i < lines.length; i++) {
        const rawLine = lines[i]
        const trimmed = rawLine.trim()

        if (trimmed === '') {
            if (currentSection === 'syntax' || currentSection === 'examples') {
                buffer.push('')
            }
            continue
        }

        // Detect section headers
        if (/^Syntax\s*$/i.test(trimmed)) {
            flushSection()
            currentSection = 'syntax'
            continue
        }

        if (/^(Input Arguments|Output Arguments|Name-Value Arguments|Parameters)\s*$/i.test(trimmed)) {
            flushSection()
            currentSection = 'args'
            buffer.push(`#### ${trimmed}`)
            continue
        }

        if (/^Examples\s*$/i.test(trimmed)) {
            flushSection()
            currentSection = 'examples'
            continue
        }

        if (/^See also\b/i.test(trimmed)) {
            flushSection()
            currentSection = 'seealso'
            const rest = trimmed.replace(/^See also\s*:?/i, '').trim()
            buffer.push(`**See also:** ${rest}`)
            continue
        }

        if (/^(Introduced in|Documentation for|Other uses of)\b/i.test(trimmed)) {
            flushSection()
            currentSection = 'misc'
            buffer.push(`*${trimmed}*`)
            continue
        }

        // Handle section content
        if (currentSection === 'syntax') {
            // Sub-headings in syntax (e.g. "Vector and Matrix Data") converted to comments for highlight
            if (!/[()=]/.test(trimmed) && !trimmed.startsWith('%')) {
                buffer.push(`% --- ${trimmed} ---`)
            } else {
                buffer.push(trimmed)
            }
        } else if (currentSection === 'examples') {
            buffer.push(trimmed)
        } else if (currentSection === 'seealso') {
            buffer[buffer.length - 1] += ' ' + trimmed
        } else if (currentSection === 'args') {
            const argMatch = trimmed.match(/^([a-zA-Z0-9_]+)\s+-\s+(.+)$/)
            if (argMatch != null) {
                buffer.push(`\n- **\`${argMatch[1]}\`** — ${argMatch[2]}`)
            } else {
                buffer.push(`  ${trimmed}`)
            }
        } else {
            buffer.push(trimmed)
        }
    }

    flushSection()

    // Format "See also" items with inline code tags
    md = md.replace(/\*\*See also:\*\*\s*(.+)/g, (_match, items: string) => {
        const tokens = items.split(/,\s*/).map(t => {
            const clean = t.trim().replace(/\.$/, '')
            return clean !== '' ? `\`${clean}\`` : ''
        }).filter(t => t !== '')
        return `**See also:** ${tokens.join(', ')}`
    })

    return md.trim()
}
