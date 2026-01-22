# MATLAB language server
[![Open in MATLAB Online](https://www.mathworks.com/images/responsive/global/open-in-matlab-online.svg)](https://matlab.mathworks.com/open/github/v1?repo=mathworks/MATLAB-language-server)

MATLAB&reg; language server implements the Microsoft&reg; [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) for the MATLAB language.

MATLAB language server requires MATLAB version R2021b or later.

## Features Implemented
MATLAB language server implements several Language Server Protocol features and their related services:
* Code diagnostics — [publishDiagnostics](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_publishDiagnostics)
* Quick fixes — [codeActionProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_codeAction)
* Document formatting — [documentFormattingProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_formatting)
* Document range formatting - [documentRangeFormattingProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_rangeFormatting)
* Code completions — [completionProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_completion)
* Function signature help — [signatureHelpProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_signatureHelp)
* Go to definition — [definitionProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_definition)
* Go to references — [referencesProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_references)
* Document symbols — [documentSymbolProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentSymbol)
* Symbol rename - [renameProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_rename)
* Code folding - [foldingRangeProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_foldingRange)
* Document highlights - [highlightSymbolProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentHighlight)

## Clients
MATLAB language server supports these editors by installing the corresponding extension:
* Emacs - [Emacs-MATLAB-Mode](https://github.com/mathworks/Emacs-MATLAB-Mode)
* Neovim - [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
* Visual Studio&reg; Code - [MATLAB extension for Visual Studio Code](https://github.com/mathworks/MATLAB-extension-for-vscode)
* Zed - [MATLAB support for Zed](https://github.com/zed-extensions/matlab)

## Release Notes

### 1.3.0
Release date: 2024-12-18

Notice:
* The MATLAB language server no longer supports MATLAB R2021a. To make use of the advanced features of the extension or run and debug MATLAB code, you must have MATLAB R2021b or later installed.

Added:
* Debugging support
* Include snippets defined within MATLAB (requires MATLAB R2025a or later)

Fixed:
* Use default values when settings are missing from configuration

### 1.2.0
Release date: 2024-03-05

Added:
* Code execution support

Fixed:
* Prevent responses from MATLAB being intercepted by the incorrect request callback
* Fixed linting diagnostic suppression with MATLAB R2024a 

### 1.1.0
Release date: 2023-05-12

* Add support for documentSymbol (outline).

### 1.0.0
Release date: 2023-04-26

* Initial release.
