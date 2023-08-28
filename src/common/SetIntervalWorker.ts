import { whenAnyPromiseSettles } from "./MiscUtils";

/**
 * Generic solution for wrapping function argument to NodeJS setInterval,
 * in order to avoid interleaving of function executions; and also 
 * to make it possible to invoke same function argument outside of
 * setInterval mechanism.
 */
export class SetIntervalWorker {
    private _externalProceed?: boolean;
    private _isCurrentlyExecuting?: boolean;

    // public properties
    workTimeoutSecs?: number;
    continueCurrentExecutionOnWorkTimeout?: boolean;
    reportWorkTimeoutFunc?: (timestamp: Date) => void;
    doWorkFunc?: () => any;
    
    async tryStartWork()  {
        this._externalProceed = true;
        if (this._isCurrentlyExecuting) {
            return false;
        }
        this._isCurrentlyExecuting = true;
        await this._startWork();
        return true;
    }

    private async _startWork() {
        let continueLoop = true;
        while (continueLoop) {
            this._externalProceed = false; // also prevents endless looping
                                           // if no error is thrown.
            let result = [false, false]
            let errOccured = false;
            try {
                result = await this._doWorkWithTimeout();
            }
            catch (err) {
                errOccured = true;
                throw err;
            }
            finally {
                continueLoop = this._loopPostUpdates(errOccured || result[0],
                    result[1]);
            }
        }
    }

    private _loopPostUpdates(errOccured: boolean, internalProceed: boolean) {
        if (errOccured || (!this._externalProceed && !internalProceed)) {
            this._isCurrentlyExecuting = false;
            return false;
        }
        else {
            return true;
        }
    }

    private async _doWorkWithTimeout(): Promise<boolean[]> {
        let workTimeoutSecs = this.workTimeoutSecs || 0;
        if (workTimeoutSecs === 0) {
            workTimeoutSecs = 3600; // default of 1 hour.
        }
        const pendingWorkTimestamp = new Date();
        const doWorkFunc = this.doWorkFunc;
        const actualWork = Promise.resolve(doWorkFunc ? doWorkFunc.call(this) : undefined);
        // interpret negative value to mean disabling of timeout.
        if (workTimeoutSecs < 0) {
            const internalProceed = await actualWork;
            return [false, !!internalProceed];
        }
        do {
            let timeoutId;
            let delayResolve: any;
            try {
                const delayPromise = new Promise<any>((resolve) => {
                    delayResolve = resolve
                    timeoutId = setTimeout(() => {
                        resolve(undefined);
                    }, workTimeoutSecs * 1000);
                });
                const winnerIdx = await whenAnyPromiseSettles(
                    [delayPromise, actualWork]);
                if (winnerIdx) {
                    const internalProceed = await actualWork;
                    return [false, !!internalProceed];
                }
            }
            finally {
                clearTimeout(timeoutId);
                delayResolve()
            }
            const reportWorkTimeoutFunc = this.reportWorkTimeoutFunc;
            if (reportWorkTimeoutFunc) {
                try {
                    // don't wait.
                    reportWorkTimeoutFunc.call(this, pendingWorkTimestamp);
                }
                catch {} // ignore
            }
        } while (this.continueCurrentExecutionOnWorkTimeout);
        return [true, false];
    }
}
