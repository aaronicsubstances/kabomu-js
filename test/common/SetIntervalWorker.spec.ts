import nativeAssert from "assert/strict"
import { expect, assert } from "chai";

import { SetIntervalWorker } from "../../src/common/SetIntervalWorker";

describe("SetIntervalWorker", function() {
    it("testNoWork", async function() {
        // arrange
        const instance = new SetIntervalWorker()

        // act
        const actual = await instance.tryStartWork()

        // assert
        assert.equal(actual, true)
    })

    it("testWorkOneOff", async function() {
        // arrange
        let callCount = 0
        const instance = new SetIntervalWorker()
        instance.workTimeoutSecs = -1
        instance.doWorkFunc = function() {
            callCount++
            return false
        }

        // act
        const actual = await instance.tryStartWork()

        // assert
        assert.equal(actual, true)
        assert.equal(callCount, 1)
    })

    it("testInternalPending", async function() {
        // arrange
        let callCount = 0
        const instance = new SetIntervalWorker()
        instance.continueCurrentExecutionOnWorkTimeout = true
        instance.doWorkFunc = function() {
            callCount++
            return callCount < 3
        }

        // act
        const actual = await instance.tryStartWork()

        // assert
        assert.equal(actual, true)
        assert.equal(callCount, 3)
    })

    it("testExternalPending", async function() {
        // arrange
        let callCount = 0
        let internalRes: any
        const instance = new SetIntervalWorker()
        instance.doWorkFunc = async function() {
            callCount++
            if (callCount < 10) {
                // to set externalPending to true.
                internalRes = await this.tryStartWork();
            }
        }

        // act
        const actual = await instance.tryStartWork()

        // assert
        assert.equal(actual, true)
        assert.equal(internalRes, false)
        assert.equal(callCount, 10)
    })

    it("testAsyncWorkForPossibleInterleaving", async function() {
        // arrange
        this.timeout(5000)
        let callCount = 0
        const instance = new SetIntervalWorker()
        instance.doWorkFunc = async function() {
            callCount++
            return new Promise<any>((resolve) => {
                setTimeout(() => {
                    resolve(callCount < 10)
                }, 200)
            })
        }
        const promises = [instance.tryStartWork()]
        for (let i = 0; i < 5; i++) {
            const delayPromise = new Promise<any>((resolve) => {
                setTimeout(async () => {
                    await instance.tryStartWork()
                    resolve(0)
                }, 1000 + (i * 150))
            });
            promises.push(delayPromise)
        }
        promises.push(new Promise<any>((resolve) => {
            setTimeout(async () => {
                instance.doWorkFunc = async function() {
                    callCount++
                    return new Promise<any>((resolve) => {
                        setTimeout(() => {
                            resolve(callCount < 20)
                        }, 200)
                    })
                }
                await instance.tryStartWork()
                resolve(0)
            }, 2200)
        }))

        // act
        await Promise.all(promises)

        // assert
        assert.equal(callCount, 20)
    })

    it("testTimeoutWithReportCallback", async function() {
        // arrange
        this.timeout(5000)
        const testStartTime = new Date().getTime()
        let callCount = 0, reportCallCount = 0, reportTime = 0
        const instance = new SetIntervalWorker()
        instance.workTimeoutSecs = 1
        instance.doWorkFunc = async function() {
            callCount++
            return new Promise<any>((resolve) => {
                setTimeout(() => {
                    resolve(false)
                }, 2000)
            })
        }
        instance.reportWorkTimeoutFunc = function(t: Date) {
            reportTime = t.getTime()
            reportCallCount++
        }

        // act
        const actual = await instance.tryStartWork()

        // assert
        assert.equal(actual, true)
        assert.equal(callCount, 1)
        assert.equal(reportCallCount, 1)
        expect(reportTime).to.be.closeTo(testStartTime, 1000)
    })

    it("testTimeoutWithContinueCurrentExecutionOnWorkTimeout", async function() {
        // arrange
        this.timeout(5000)
        const testStartTime = new Date().getTime()
        let callCount = 0, reportCallCount = 0
        const reportTimes = new Array<number>()
        const instance = new SetIntervalWorker()
        instance.workTimeoutSecs = 1
        instance.continueCurrentExecutionOnWorkTimeout = true
        instance.doWorkFunc = async function() {
            callCount++
            return new Promise<any>((resolve) => {
                setTimeout(() => {
                    resolve(false)
                }, 2500)
            })
        },
        instance.reportWorkTimeoutFunc = function(t: Date) {
            reportTimes.push(t.getTime())
            reportCallCount++
        }

        // act
        const actual = await instance.tryStartWork()

        // assert
        assert.equal(actual, true)
        assert.equal(callCount, 1)
        assert.equal(reportCallCount, 2)
        expect(reportTimes[0]).to.be.closeTo(testStartTime, 1000)
        expect(reportTimes[1]).to.be.closeTo(reportTimes[0], 1000)
    })

    it("testAsyncWorkCompletionBeforeTimeout", async function() {
        // arrange
        this.timeout(5000)
        let callCount = 0, reportCallCount = 0
        const instance = new SetIntervalWorker()
        instance.workTimeoutSecs = 4
        instance.doWorkFunc = async function() {
            callCount++
            return new Promise<any>((resolve) => {
                setTimeout(() => {
                    resolve(false)
                }, 2000)
            })
        },
        instance.reportWorkTimeoutFunc = function() {
            reportCallCount++
        }

        // act
        const actual = await instance.tryStartWork()

        // assert
        assert.equal(actual, true)
        assert.equal(callCount, 1)
        assert.equal(reportCallCount, 0)
    })

    it("testTimeoutWithNoReportCallback", async function() {
        // arrange
        this.timeout(5000)
        let callCount = 0
        const instance = new SetIntervalWorker()
        instance.workTimeoutSecs = 1
        instance.doWorkFunc = async function() {
            callCount++
            return new Promise<any>((resolve) => {
                setTimeout(() => {
                    resolve(true)
                }, 2500)
            })
        }

        // act
        const actual = await instance.tryStartWork()

        // assert
        assert.equal(actual, true)
        assert.equal(callCount, 1)
    })

    it('test with error 1', async function() {
        // arrange
        const instance = new SetIntervalWorker()
        instance.workTimeoutSecs = -20
        instance.doWorkFunc = async function(): Promise<any> {
            throw new Error("error 1") 
        }

        // act
        await nativeAssert.rejects(async () => {
            await instance.tryStartWork();
        }, {
            message: "error 1"
        });

        // confirm that doWorkFunc was the problem
        instance.doWorkFunc = null as any;
        const retryResult = await instance.tryStartWork()
        assert.ok(retryResult)
    })

    it('test with error 2', async function() {
        // arrange
        const instance = new SetIntervalWorker()
        instance.workTimeoutSecs = 2000
        instance.continueCurrentExecutionOnWorkTimeout = true
        instance.doWorkFunc = async function(): Promise<any> {
            return new Promise((_, reject) => {
                setTimeout(() => reject(new Error("error 2")),
                    1200)
            })
        }

        // act
        await nativeAssert.rejects(async () => {
            await instance.tryStartWork();
        }, {
            message: "error 2"
        });

        // confirm that doWorkFunc was the problem
        instance.doWorkFunc = null as any;
        const retryResult = await instance.tryStartWork()
        assert.ok(retryResult)
    })
})
