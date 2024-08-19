# MATLAB language server
[![Open in MATLAB Online](https://www.mathworks.com/images/responsive/global/open-in-matlab-online.svg)](https://matlab.mathworks.com/open/github/v1?repo=mathworks/MATLAB-language-server)

MATLAB&reg; language server implements the Microsoft&reg; [Language Server Protocol](https://github.com/Microsoft/language-server-protocol) for the MATLAB language.

MATLAB language server requires MATLAB version R2021a or later.

**Note:** This language server will no longer support MATLAB R2021a in a future release. To use advanced features or run MATLAB code, you will need to have MATLAB R2021b or later installed.

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
* Symbol rename - [renameProvider](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#textDocument_rename)

## Clients
MATLAB language server supports these editors by installing the corresponding extension:
* Neovim — [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig)
* Visual Studio&reg; Code — [MATLAB extension for Visual Studio Code](https://github.com/mathworks/MATLAB-extension-for-vscode)

## Release Notes

### Unreleased

### 1.2.5
Release date: 2024-08-16

Added:
* Symbol rename support

Fixed:
* Leading or trailing whitespace in `installPath` setting is ignored when connecting to MATLAB

### 1.2.4 
Release date: 2024-07-12

Added:
* Improvements to code folding (requires MATLAB R2024b or later)

Fixed:
* Allow connection to MATLAB when a single quote appears in the extension installation path
* Resolve error with code navigation when using with MATLAB R2024b

### 1.2.3
Release date: 2024-06-14

Notice:
* The MATLAB language server will no longer support MATLAB R2021a in a future release. To make use of the advanced features of the extension or run MATLAB code, you will need to have MATLAB R2021b or later installed.

Added:
* Added a system to detect if the connected MATLAB release is supported by the language server. This will inform the client, which may display a notification to the user about this.

Fixed:
* Resolved issue with connecting to Intel MATLAB installation on Apple Silicon machines
* Resolved error if MATLAB process is killed unexpectedly
* Fixed bug where "never" startup timing was ignored

### 1.2.2
Release date: 2024-05-17

Fixed:
* Resolved packaging failure on Mac
* Resolved connecting to MATLAB in proxy environment
* General bug fixes

### 1.2.1
Release date: 2024-04-04

Added:
* Supports connecting to MATLAB when the New Desktop for MATLAB is enabled

Fixed:
* Fixed launching App Designer and Simulink through MATLAB code execution

### 1.2.0
Release date: 2024-03-05

Added:
* Code execution support

Fixed:
* Prevent responses from MATLAB being intercepted by the incorrect request callback
* Fixed linting diagnostic suppression with MATLAB R2024a 

### 1.1.8
Release date: 2024-01-16

Fixed:
* Fixed linting with mlint on Windows
* Fixed regression with code navigation when using with MATLAB R2024a

### 1.1.7
Release date: 2023-12-06

Fixed:
* Fixed code navigation when using with MATLAB R2024a
* Handle symbolic link to MATLAB when linting with mlint (Thanks @MoetaYuko!)
* Handle maca64 architecture when linting with mlint (Thanks @tiagovla!)

### 1.1.6
Release date: 2023-10-11

* Add support for MATLAB sections in the documentSymbol (outline).

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
