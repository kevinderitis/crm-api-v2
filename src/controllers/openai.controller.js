const OpenAI = require("openai");
const config = require("../config/config.js");

const openai = new OpenAI({ apiKey: config.OPEN_AI_API_KEY });

class OpenAIError extends Error {
    constructor(message) {
        super(message);
        this.name = "OpenAIError";
    }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createAndRun = async (msg, assistantId) => {
    try {
        const run = await openai.beta.threads.createAndRun({
            assistant_id: assistantId,
            thread: { messages: [{ role: "user", content: msg }] },
        });
        return { threadId: run.thread_id, runId: run.id };
    } catch (error) {
        console.log(error)
        throw new OpenAIError("Error al crear y ejecutar el hilo.");
    }
};

const addMessage = async (msg, threadId) => {
    try {
        await openai.beta.threads.messages.create(threadId, {
            role: "user",
            content: msg,
        });
    } catch (error) {
        throw new OpenAIError("Error al añadir mensaje al hilo.");
    }
};

const listMessages = async (threadId) => {
    try {
        const messages = await openai.beta.threads.messages.list(threadId);
        for (const message of messages.data) {
            if (message.role !== "user") {
                if (message.content[0]?.type === "text") {
                    return message.content[0].text.value;
                }
                if (message.content[0]?.type === "tool_calls") {
                    console.log('tool_calls', message.content[0].tool_calls)
                }
            }
        }
        return "No se recibió respuesta del asistente.";
    } catch (error) {
        throw new OpenAIError("Error al listar mensajes del hilo.");
    }
};

const runThread = async (threadId, assistantId) => {
    try {
        const run = await openai.beta.threads.runs.create(threadId, { assistant_id: assistantId });
        return run.id;
    } catch (error) {
        throw new OpenAIError("Error al ejecutar el hilo.");
    }
};

// const waitForRunCompletion = async (threadId, runId) => {
//     try {
//         let attempts = 10;
//         while (attempts > 0) {
//             const run = await openai.beta.threads.runs.retrieve(threadId, runId);
//             if (run.status === "completed") {
//                 return true;
//             } else if (run.status === "failed" || run.status === "cancelled") {
//                 throw new OpenAIError("La ejecución del asistente falló o fue cancelada.");
//             }
//             await sleep(2000);
//             attempts--;
//         }
//         throw new OpenAIError("Tiempo de espera agotado para la ejecución del asistente.");
//     } catch (error) {
//         throw new OpenAIError("Error al esperar la finalización del hilo.");
//     }
// };

const processFunctionCalls = async (toolCalls) => {
    const outputs = [];

    for (const call of toolCalls) {
        try {
            const func = functions[call.function.name];
            if (!func) throw new Error(`Función ${call.function.name} no existe`);

            const args = JSON.parse(call.function.arguments);
            const result = await func(args);

            outputs.push({
                tool_call_id: call.id,
                output: JSON.stringify(result)
            });

        } catch (error) {
            console.error("Error procesando función:", error);
            outputs.push({
                tool_call_id: call.id,
                output: JSON.stringify({ error: error.message })
            });
        }
    }
    return outputs;
};

const waitForRunCompletion = async (threadId, runId) => {
    let attempts = 10;
    while (attempts-- > 0) {
        const run = await openai.beta.threads.runs.retrieve(threadId, runId);

        switch (run.status) {
            case "completed":
                return true;

            case "requires_action":
                const toolOutputs = await processFunctionCalls(run.required_action.submit_tool_outputs.tool_calls);
                await openai.beta.threads.runs.submitToolOutputs(
                    threadId,
                    runId,
                    { tool_outputs: toolOutputs }
                );
                break;

            case "failed":
                throw new OpenAIError("Ejecución fallida");

            default:
                await sleep(2000);
        }
    }
    throw new OpenAIError("Tiempo de espera agotado");
};


const sendMessage = async (msg, threadId = null) => {
    try {
        let runId;
        let newThread;

        if (!threadId) {
            const runData = await createAndRun(msg, config.ASSISTANT_ID);
            threadId = runData.threadId;
            newThread = threadId;
            runId = runData.runId;
        } else {
            await addMessage(msg, threadId);
            runId = await runThread(threadId, config.ASSISTANT_ID);
        }

        await waitForRunCompletion(threadId, runId);
        const text = await listMessages(threadId);
        return { text, newThread };
    } catch (error) {
        console.log(error)
        throw new OpenAIError("Error al enviar el mensaje.");
    }
};

exports.sendMessage = sendMessage;