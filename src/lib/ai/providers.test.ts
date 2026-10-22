import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { completeJson, ProviderError, type Provider } from "./providers";

const request = { model: "test-model", apiKey: "secret-key", system: "sys", user: "usr" };

function mockFetch(body: unknown, status = 200) {
	const spy = vi.fn<typeof fetch>(
		async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
	);
	vi.stubGlobal("fetch", spy);
	return spy;
}

describe("completeJson", () => {
	afterEach(() => vi.unstubAllGlobals());

	it.each<[Provider, string, unknown]>([
		["openai", "https://api.openai.com/v1/chat/completions", { choices: [{ message: { content: '{"fields":[]}' } }] }],
		[
			"openrouter",
			"https://openrouter.ai/api/v1/chat/completions",
			{ choices: [{ message: { content: '{"fields":[]}' } }] },
		],
		["anthropic", "https://api.anthropic.com/v1/messages", { content: [{ type: "text", text: '{"fields":[]}' }] }],
		[
			"gemini",
			"https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent",
			{ candidates: [{ content: { parts: [{ text: '{"fields":[]}' }] } }] },
		],
	])("volá %s správnou adresou a vrátí text odpovědi", async (provider, url, body) => {
		const spy = mockFetch(body);
		const text = await completeJson({ ...request, provider });
		expect(text).toBe('{"fields":[]}');
		expect(spy.mock.calls[0][0]).toBe(url);
	});

	it("posílá response_format jen u OpenAI, OpenRouter ho neposílá", async () => {
		const openAi = mockFetch({ choices: [{ message: { content: "{}" } }] });
		await completeJson({ ...request, provider: "openai" });
		expect(JSON.parse((openAi.mock.calls[0][1] as RequestInit).body as string).response_format).toEqual({
			type: "json_object",
		});

		const openRouter = mockFetch({ choices: [{ message: { content: "{}" } }] });
		await completeJson({ ...request, provider: "openrouter" });
		expect(JSON.parse((openRouter.mock.calls[0][1] as RequestInit).body as string)).not.toHaveProperty(
			"response_format",
		);
	});

	it("neposílá klíč do těla požadavku u OpenAI-kompatibilních API", async () => {
		const spy = mockFetch({ choices: [{ message: { content: "{}" } }] });
		await completeJson({ ...request, provider: "openai" });
		const init = spy.mock.calls[0][1] as RequestInit;
		expect(JSON.stringify(init.body)).not.toContain("secret-key");
		expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret-key");
	});

	it("převede HTTP 429 na srozumitelnou chybu poskytovatele", async () => {
		mockFetch({ error: "rate" }, 429);
		await expect(completeJson({ ...request, provider: "gemini" })).rejects.toBeInstanceOf(ProviderError);
		mockFetch({ error: "rate" }, 429);
		await expect(completeJson({ ...request, provider: "gemini" })).rejects.toThrow("Překročen limit");
	});

	it("převede chybu v těle odpovědi OpenRouteru (HTTP 200) na ProviderError se stavem chyby", async () => {
		mockFetch({ error: { message: "A Timeout Occurred", code: 400 } });
		const error = await completeJson({ ...request, provider: "openrouter" }).catch((caught: unknown) => caught);
		expect(error).toBeInstanceOf(ProviderError);
		expect((error as ProviderError).status).toBe(400);
		expect((error as ProviderError).message).toContain("A Timeout Occurred");
	});

	it("zopakuje přechodnou chybu 504 a při úspěchu vrátí text", async () => {
		const spy = vi
			.fn<typeof fetch>()
			.mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: "timeout", code: 504 } })))
			.mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] })));
		vi.stubGlobal("fetch", spy);
		await expect(completeJson({ ...request, provider: "openrouter" })).resolves.toBe("{}");
		expect(spy).toHaveBeenCalledTimes(2);
	}, 15_000);
});
