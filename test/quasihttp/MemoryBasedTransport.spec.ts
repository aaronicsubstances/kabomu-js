import { assert } from "chai"
import { MemoryBasedClientTransport } from "../shared/quasihttp/MemoryBasedClientTransport"
import { MemoryBasedServerTransport } from "../shared/quasihttp/MemoryBasedServerTransport"
import { IQuasiHttpTransport } from "../../src/quasihttp/types"
import * as IOUtils from "../../src/common/IOUtils"
import * as ByteUtils from "../../src/common/ByteUtils"
import { getRndInteger } from "../../src/common/MiscUtils"

const connectionHashCodes = new Array<any>()

describe("MemoryBasedTransport", function() {
    it("test operations", async function() {
        let latestConnectionAtAccra: any
        let latestConnectionAtKumasi: any
        const accraEndpoint = "accra"
        const kumasiEndpoint = "kumasi"
        const accraBasedServer = new MemoryBasedServerTransport({
            acceptConnectionFunc: c => {
                latestConnectionAtAccra = c
            }
        })
        const kumasiBasedServer = new MemoryBasedServerTransport({
            acceptConnectionFunc: c => {
                latestConnectionAtKumasi = c
            }
        })
        const instanceA = new MemoryBasedClientTransport(
            new Map([
                [kumasiEndpoint, kumasiBasedServer]
            ]))
        const instanceK = new MemoryBasedClientTransport(
            new Map([
                [accraEndpoint, accraBasedServer]
            ]))
        const promises = new Array<any>()
        connectionHashCodes.length = 0 // reset
        for (let i = 0; i < 5; i++) {
            if (getRndInteger(0, 2)) {
                const clientC = await instanceA.allocateConnection(
                    kumasiEndpoint, null as any)
                assert.strictEqual(latestConnectionAtKumasi, clientC)
                const connection = clientC!.connection
                connectionHashCodes.push(connection)
                promises.push(performProcessing(instanceA,
                    connection, true, true))
                promises.push(performProcessing(kumasiBasedServer,
                    connection, false, false))
            }
            else {
                const clientC = await instanceK.allocateConnection(
                    accraEndpoint, null as any)
                assert.strictEqual(latestConnectionAtAccra, clientC)
                const connection = clientC!.connection
                connectionHashCodes.push(connection)
                promises.push(performProcessing(instanceK,
                    connection, true, false))
                promises.push(performProcessing(accraBasedServer,
                    connection, false, true))
            }
        }
        await Promise.allSettled(promises)
    })
})

interface TestMessage {
    input: number,
    output?: boolean,
    priority: number,
    cannotAnswerQuestions: boolean
}

async function performProcessing(transport: IQuasiHttpTransport,
        connection: any, isClient: boolean, isAtAccra: boolean) {
    const transportReader = transport.getReader(connection)
    const transportWriter = transport.getWriter(connection)
    
    // ensure at least one question to answer
    const maxQuestionsToAnswer = getRndInteger(1, 10);
    logMsg(describeMaxQuestionsToAnswer(connection, maxQuestionsToAnswer,
        isClient, isAtAccra));
    let peerCannotAnswerQuestions = false;
    let numOfQuestionsAnswered = 0;

    // ensure client asks question first time,
    // and server waits to answer question the first time.
    let localPriority = isClient ? 1 : 0;
    let peerPriority = isClient ? 0 : 1;

    let localCalculationResult = isAtAccra ? 1 : 0;

    while (numOfQuestionsAnswered < maxQuestionsToAnswer ||
            !peerCannotAnswerQuestions) {
        // determine whether question is to be asked or answered.
        let ask = false;
        if (peerCannotAnswerQuestions) {
            ask = false;
        }
        else if (numOfQuestionsAnswered >= maxQuestionsToAnswer) {
            ask = true;
        }
        else {
            if (isClient) {
                ask = localPriority >= peerPriority;
            }
            else {
                ask = localPriority > peerPriority;
            }
        }
        if (ask) {
            localPriority = getRndInteger()
            const outgoingQuestion: TestMessage = {
                input: getRndInteger(),
                priority: localPriority,
                cannotAnswerQuestions: numOfQuestionsAnswered >= maxQuestionsToAnswer
            }
            logMsg(describeMsg(connection, outgoingQuestion, true, true,
                isClient, isAtAccra, 0, 0))
            await writeMsg(transportWriter, outgoingQuestion)
            const incomingAnswer = await readMsg(transportReader)
            // check answer
            assert.equal(incomingAnswer.output,
                outgoingQuestion.input % 2 != localCalculationResult)
            peerPriority = incomingAnswer.priority
            peerCannotAnswerQuestions = incomingAnswer.cannotAnswerQuestions
        }
        else {
            const incomingQuestion = await readMsg(transportReader)
            logMsg(describeMsg(connection, incomingQuestion, true, false,
                isClient, isAtAccra, numOfQuestionsAnswered, maxQuestionsToAnswer))
            peerPriority = incomingQuestion.priority
            peerCannotAnswerQuestions = incomingQuestion.cannotAnswerQuestions
            // answer question
            ++numOfQuestionsAnswered
            localPriority = getRndInteger()
            const outgoingAnswer: TestMessage = {
                input: incomingQuestion.input,
                output: incomingQuestion.input % 2 == localCalculationResult,
                priority: localPriority,
                cannotAnswerQuestions: numOfQuestionsAnswered >= maxQuestionsToAnswer
            }
            logMsg(describeMsg(connection, outgoingAnswer, false, true,
                isClient, isAtAccra, numOfQuestionsAnswered - 1,
                maxQuestionsToAnswer))
            await writeMsg(transportWriter, outgoingAnswer)
        }
    }
    await transport.releaseConnection(connection);
    logMsg(describeRelease(connection, isClient, isAtAccra));
}

function logMsg(msg: string) {
}

function describeMaxQuestionsToAnswer(connection: any,
        maxQuestionsToAnswer: number, isClient: boolean,
        isAtAccra: boolean) {
    const part1 = isClient ? "client" : "server"
    const part2 = isAtAccra ? "Accra" : "Kumasi"
    return `#${connectionHashCodes.indexOf(connection)}# ` +
        `maxQuestionsToAnswer = ` +
        `${maxQuestionsToAnswer} at ${part1} in ${part2}`
}

function describeRelease(connection: any,
        isClient: boolean, isAtAccra: boolean) {
    const part1 = isClient ? "client" : "server"
    const part2 = isAtAccra ? "Accra" : "Kumasi"
    return `#${connectionHashCodes.indexOf(connection)}# ` +
        `release connection at ${part1} in ${part2}`
}

function describeMsg(connection: any, msg: TestMessage,
        isQuestion: boolean, isOutgoing: boolean, isClient: boolean,
        isAtAccra: boolean, num: number, maxNum: number) {
    let part0 = ""
    if (maxNum > 0) {
        part0 = `${num + 1}/${maxNum} `
    }
    const part1 = isQuestion ? "question" : "answer";
    const part2 = isOutgoing ? "to be sent from" : "received at";
    const part3 = isClient ? "client" : "server";
    const part4 = isAtAccra ? "Accra" : "Kumasi";
    let part5 = '';
    if (isAtAccra) {
        if (isQuestion) {
            part5 = isOutgoing ? "even" : "odd";
        }
        else {
            part5 = isOutgoing ? "odd" : "even";
        }
    }
    else {
        if (isQuestion) {
            part5 = isOutgoing ? "odd" : "even";
        }
        else {
            part5 = isOutgoing ? "even" : "odd";
        }
    }
    let part6 = "";
    if (!isQuestion) {
        part6 = msg.output ? " Yes" : " No";
    }
    return `#${connectionHashCodes.indexOf(connection)}# ` +
        `${part0}${part1} ${part2} ${part3} in ${part4}: is ` +
        `${msg.input} ${part5}?${part6}\n` +
        `(Input=${msg.input},Output=${msg.output},Priority=${msg.priority},CAQ=${msg.cannotAnswerQuestions})`
}

async function readMsg(reader: any) {
    const msgBytes = Buffer.alloc(10)
    await IOUtils.readBytesFully(reader, msgBytes)
    const msg: TestMessage = {
        input: 0,
        priority: 0,
        cannotAnswerQuestions: false,
        output: false
    }
    msg.input = ByteUtils.deserializeUpToInt32BigEndian(msgBytes,
        0, 4, true)
    msg.priority = ByteUtils.deserializeUpToInt32BigEndian(msgBytes,
        4, 4, true)
    msg.cannotAnswerQuestions = !!msgBytes[8]
    msg.output = !!msgBytes[9]
    return msg
}

async function writeMsg(writer: any, msg: TestMessage) {
    const msgBytes = Buffer.alloc(10)
    ByteUtils.serializeUpToInt32BigEndian(msg.input,
        msgBytes, 0, 4)
    ByteUtils.serializeUpToInt32BigEndian(msg.priority,
        msgBytes, 4, 4)
    msgBytes[8] = msg.cannotAnswerQuestions ? 1 : 0
    msgBytes[9] = msg.output ? 1 : 0
    await IOUtils.writeBytes(writer, msgBytes)
}