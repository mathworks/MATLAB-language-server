import sinon from 'sinon'

export default function getMockMvm (): any {
    const mockMvm = {
        waitUntilReady: sinon.stub(),
        feval: sinon.stub()
    }

    return mockMvm
}
