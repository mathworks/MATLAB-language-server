import sinon from 'sinon'

export default function getMockConnection (): any {
    const mockConnection = {
        console: {
            connection: {},
            error: sinon.stub(),
            warn: sinon.stub(),
            info: sinon.stub(),
            log: sinon.stub()
        },
        sendNotification: sinon.stub()
    }

    return mockConnection
}
