export const PROVIDERS = ["openai", "anthropic", "gemini", "openrouter"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PROVIDER_LABELS: Record<Provider, string> = {
	openai: "OpenAI",
	anthropic: "Anthropic Claude",
	gemini: "Google Gemini",
	openrouter: "OpenRouter",
};

const REQUEST_TIMEOUT_MS = 60_000;

export class ProviderError extends Error {
	constructor(
		message: string,
		readonly status: number,
	) {
		super(message);
	}
}

export type CompletionRequest = {
	provider: Provider;
	model: string;
	apiKey: string;
	system: string;
	user: string;
};

const TRANSIENT_STATUSES = [502, 503, 504];
const RETRY_DELAYS_MS = [2_000, 5_000];

export async function completeJson(request: CompletionRequest): Promise<string> {
	for (let attempt = 0; ; attempt++) {
		try {
			return await completeOnce(request);
		} catch (error) {
			const transient = error instanceof ProviderError && TRANSIENT_STATUSES.includes(error.status);
			if (!transient || attempt >= RETRY_DELAYS_MS.length) throw error;
			await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
		}
	}
}

async function completeOnce(request: CompletionRequest): Promise<string> {
	try {
		return await completeWithProvider(request);
	} catch (error) {
		if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
			throw new ProviderError("Poskytovatel neodpověděl včas.", 504);
		}
		throw error;
	}
}

async function completeWithProvider(request: CompletionRequest): Promise<string> {
	switch (request.provider) {
		case "openai":
			return completeOpenAiCompatible("https://api.openai.com/v1/chat/completions", request, true, {
				authorization: `Bearer ${request.apiKey}`,
			});
		case "openrouter":
			return completeOpenAiCompatible("https://openrouter.ai/api/v1/chat/completions", request, false, {
				authorization: `Bearer ${request.apiKey}`,
			});
		case "anthropic":
			return completeAnthropic(request);
		case "gemini":
			return completeGemini(request);
	}
}

async function completeOpenAiCompatible(
	url: string,
	request: CompletionRequest,
	jsonMode: boolean,
	headers: Record<string, string>,
): Promise<string> {
	const response = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json", ...headers },
		body: JSON.stringify({
			model: request.model,
			messages: [
				{ role: "system", content: request.system },
				{ role: "user", content: request.user },
			],
			...(jsonMode ? { response_format: { type: "json_object" } } : {}),
			temperature: 0.2,
		}),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	const data = (await readJson(response)) as {
		choices?: Array<{ message?: { content?: string } }>;
		error?: { message?: string; code?: number };
	};
	if (data.error) {
		throw new ProviderError(
			`Poskytovatel vrátil chybu: ${data.error.message ?? "neznámá chyba"}`,
			data.error.code ?? 502,
		);
	}
	return data.choices?.[0]?.message?.content ?? "";
}

async function completeAnthropic(request: CompletionRequest): Promise<string> {
	const response = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-api-key": request.apiKey,
			"anthropic-version": "2023-06-01",
		},
		body: JSON.stringify({
			model: request.model,
			max_tokens: 4096,
			system: request.system,
			messages: [{ role: "user", content: request.user }],
		}),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	const data = (await readJson(response)) as { content?: Array<{ type?: string; text?: string }> };
	return (data.content ?? [])
		.filter((block) => block.type === "text")
		.map((block) => block.text ?? "")
		.join("");
}

async function completeGemini(request: CompletionRequest): Promise<string> {
	const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent`;
	const response = await fetch(url, {
		method: "POST",
		headers: { "content-type": "application/json", "x-goog-api-key": request.apiKey },
		body: JSON.stringify({
			systemInstruction: { parts: [{ text: request.system }] },
			contents: [{ role: "user", parts: [{ text: request.user }] }],
			generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
		}),
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
	});
	const data = (await readJson(response)) as {
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
	};
	return (data.candidates?.[0]?.content?.parts ?? []).map((part) => part.text ?? "").join("");
}

const STATUS_MESSAGES: Record<number, string> = {
	400: "Poskytovatel odmítl požadavek. Zkontrolujte model.",
	401: "Neplatný API klíč.",
	402: "U poskytovatele došly kredity.",
	403: "Přístup k modelu je zamítnut.",
	404: "Model nebyl nalezen.",
	429: "Překročen limit poskytovatele. Zkuste to později.",
};

async function readJson(response: Response): Promise<unknown> {
	if (!response.ok) {
		const message = STATUS_MESSAGES[response.status] ?? `Poskytovatel vrátil HTTP ${response.status}.`;
		throw new ProviderError(message, response.status);
	}
	return response.json();
}
