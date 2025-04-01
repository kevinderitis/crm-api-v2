const OpenAI = require("openai");
const config = require("../config/config.js");
const { createAndSendTicket } = require("../utils/ticketFunctions");

const openai = new OpenAI({ apiKey: config.OPEN_AI_API_KEY });

class OpenAIError extends Error {
    constructor(message) {
        super(message);
        this.name = "OpenAIError";
    }
}

const functions = {
    crearTicketSoporte: async (params, threadId) => {
        console.log("✅ Creando ticket con:", params);
        await createAndSendTicket(threadId, 'Soporte', params.problem);
        return {
            success: true
        };
    },
    retirarDinero: async (params, threadId) => {
        console.log("✅ Retirando dinero con:", params);
        await createAndSendTicket(threadId, 'Retiro', params.monto);
        return {
            success: true,
            status: "pending"
        };
    }
};

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



const processFunctionCalls = async (toolCalls, threadId) => {
    return Promise.all(toolCalls.map(async (call) => {
        try {
            const result = await functions[call.function.name](JSON.parse(call.function.arguments), threadId);

            // Formato requerido por OpenAI:
            return {
                tool_call_id: call.id,
                output: JSON.stringify(result),
            };

        } catch (error) {
            return {
                tool_call_id: call.id,
                output: JSON.stringify({ error: "Fallo en la función" }),
            };
        }
    }));
};

const waitForRunCompletion = async (threadId, runId) => {
    let attempts = 20; // 👈 Aumenta los intentos
    while (attempts-- > 0) {
        try {
            const run = await openai.beta.threads.runs.retrieve(threadId, runId);
            console.log(`Run status: ${run.status}`); // 👈 Para debug

            switch (run.status) {
                case "completed":
                    return true;

                case "requires_action":
                    // Procesar y enviar resultados de la función
                    const toolOutputs = await processFunctionCalls(run.required_action.submit_tool_outputs.tool_calls, threadId);
                    await openai.beta.threads.runs.submitToolOutputs(threadId, runId, {
                        tool_outputs: toolOutputs,
                    });
                    attempts += 2; // 👈 Da más tiempo después de enviar outputs
                    break;

                case "failed":
                    throw new OpenAIError(`Error de OpenAI: ${run.last_error?.message}`);

                case "cancelled":
                    throw new OpenAIError("Ejecución cancelada");

                default:
                    await sleep(2500); // 👈 Reduce el tiempo de espera
            }
        } catch (error) {
            throw new OpenAIError(`Error en ejecución: ${error.message}`);
        }
    }
    throw new OpenAIError("Tiempo de espera agotado después de 20 intentos");
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