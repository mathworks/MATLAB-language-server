// Copyright 2024 The MathWorks, Inc.
import { _Connection, createConnection, ProposedFeatures } from 'vscode-languageserver/node'

export type Connection = _Connection

export default class ClientConnection {
    private static connection: Connection | undefined

    /**
     * Retrieves the connection to the client. If no connection currently exists,
     * a new connection is created.
     *
     * @returns The connection to the client
     */
    public static getConnection (): Connection {
        if (ClientConnection.connection == null) {
            ClientConnection.connection = createConnection(ProposedFeatures.all)
        }

        return ClientConnection.connection
    }

    /**
     * Sets the ClientConnection to a given object.
     * This API is primarily meant for testing purposes.
     *
     * @param connection The connection object to set
     */
    public static _setConnection (connection: Connection): void {
        ClientConnection.connection = connection
    }

    /**
     * Clears the current connection.
     * This API is primarily meant for testing purposes.
     */
    public static _clearConnection (): void {
        ClientConnection.connection = undefined
    }
}
