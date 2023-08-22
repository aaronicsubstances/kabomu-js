import { IQuasiHttpApplication, IQuasiHttpRequest, IQuasiHttpResponse, IReceiveProtocolInternal } from "../../../src/quasihttp/types"
import { ExpectationViolationError, MissingDependencyError } from "../../common/errors"

export class AltReceiveProtocolInternal implements IReceiveProtocolInternal {
    application: IQuasiHttpApplication
    request: IQuasiHttpRequest

    constructor(application: IQuasiHttpApplication,
            request: IQuasiHttpRequest) {
        this.application = application
        this.request = request
    }

    async cancel(): Promise<void> {
    }

    receive(): Promise<IQuasiHttpResponse | null> {
        if (!this.application) {
            throw new MissingDependencyError("application")
        }
        if (!this.request)
        {
            throw new ExpectationViolationError("request")
        }
        return this.application.processRequest(this.request)
    }
}
