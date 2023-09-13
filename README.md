# MATLAB language server
MATLAB&reg; language server implements the Microsoft&reg; [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) for the MATLAB language.

## Features Implemented
MATLAB language server implements several Language Server Protocol features and their related services:
* Code diagnostics — [publishDiagnostics](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_publishDiagnostics)
* Quick fixes — [codeActionProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_codeAction)
* Document formatting — [documentFormattingProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_formatting)
* Code completions — [completionProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_completion)
* Function signature help — [signatureHelpProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_signatureHelp)
* Go to definition — [definitionProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_definition)
* Go to references — [referencesProvider](https://microsoft.github.io/language-server-protocol/specifications/specification-current/#textDocument_references)
* Document symbols — [documentSymbol](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_documentSymbol)

## Clients
MATLAB language server supports these editors by installing the corresponding extension:
* Neovim — [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
* Visual Studio&reg; Code — [MATLAB extension for Visual Studio Code](https://github.com/mathworks/MATLAB-extension-for-vscode)

## Release Notes

### Unreleased

### 1.1.5
Release date: 2023-09-13

Fixed:
* Fixed issue connecting to MATLAB with Node.js&reg; version 18 and later.

### 1.1.4
Release date: 2023-08-14

Fixed:
* Patched CVE-2023-26136 and CVE-2022-25883

### 1.1.3
Release date: 2023-07-10

Fixed:
* Diagnostic suppression should be placed at correct location when '%' is contained within string
* Improved navigation to files inside MATLAB packages within the VS Code workspace but not on the MATLAB path
* Prevented navigation to private/local functions from other files
* MATLAB sign-in is no longer blocked on Windows

### 1.1.2
Release date: 2023-05-31

Fixed:
* Improves responsiveness of documentSymbol support
* Clear linting diagnostics from closed files
* MATLAB should launch with `onDemand` setting

### 1.1.1
Release date: 2023-05-12

* Resolves linting errors

### 1.1.0
Release date: 2023-05-12

* Add support for documentSymbol (outline).

### 1.0.0
Release date: 2023-04-26

* Initial release.
