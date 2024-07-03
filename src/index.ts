// Copyright 2022 - 2024 The MathWorks, Inc.

// Start up the LSP server
import ClientConnection from './ClientConnection'
import * as server from './server'

// Start up the language server
server.startServer()

// Listen on the client connection
ClientConnection.getConnection().listen()
