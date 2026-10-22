import { interpolate, messageFor } from "./format";
import type { UiMessages } from "./messages";

type AuditEvent = {
	stage: string;
	status: string;
	summary: string;
};

export function localizeAuditEvent(event: AuditEvent, messages: UiMessages): string {
	const text = messages.aiAudit.eventSummaries;
	let match: RegExpMatchArray | null;

	if (event.stage === "input_preparation" && event.status === "completed") {
		match = event.summary.match(/^Připraveno (\d+) polí\./);
		if (match) return interpolate(text.inputPrepared, { count: match[1] });
	}

	if (
		event.stage === "provider_setup" &&
		event.status === "started" &&
		event.summary === "Ověřuje se nastavení poskytovatele a modelu."
	) {
		return text.providerCheckStarted;
	}

	if (event.stage === "provider_setup" && event.status === "completed") {
		match = event.summary.match(/^Použit poskytovatel ([^,]+), model (.+)\.$/);
		if (match) return interpolate(text.providerUsed, { provider: match[1], model: match[2] });
	}

	if (
		event.stage === "model_evaluation" &&
		event.status === "started" &&
		event.summary === "Požadavek na hodnocení a návrhy byl odeslán modelu."
	) {
		return text.requestSent;
	}

	if (event.stage === "model_evaluation" && event.status === "completed") {
		match = event.summary.match(/^Model vrátil výstup pro (\d+) polí( po jednom formátovacím opakování)?\.$/);
		if (match) return interpolate(match[2] ? text.modelOutputRetried : text.modelOutput, { count: match[1] });
	}

	if (
		event.stage === "response_validation" &&
		event.status === "completed" &&
		event.summary === "Odpověď odpovídá očekávanému tvaru. Ukládají se skóre, problémy a stručné důvody návrhů."
	) {
		return text.responseValidated;
	}

	if (
		event.stage === "result_persistence" &&
		event.status === "started" &&
		event.summary === "Výsledky se ukládají k jednotlivým textovým polím."
	) {
		return text.resultsSaving;
	}

	if (event.stage === "result_persistence" && event.status === "completed") {
		match = event.summary.match(/^Uloženo (\d+) hodnocení a (\d+) návrhů\.$/);
		if (match) return interpolate(text.resultsSaved, { assessed: match[1], proposed: match[2] });
	}

	if (event.stage === "proposal_decision" && event.status === "completed") {
		match = event.summary.match(
			/^Návrh pro pole „([^“]+)“ byl (schválen|zamítnut|vrácen k rozhodnutí)\.( Text byl před rozhodnutím upraven\.)?$/,
		);
		if (match) {
			const field = messageFor(messages.pageDetail.fields, match[1]) ?? match[1];
			const edited = match[3] ? text.edited : "";
			const template =
				match[2] === "schválen"
					? text.proposalApproved
					: match[2] === "zamítnut"
						? text.proposalRejected
						: text.proposalPending;
			return interpolate(template, { field, edited });
		}
	}

	if (event.status === "failed" && event.summary.startsWith("Selhalo: ")) {
		return interpolate(text.failed, { message: event.summary.slice("Selhalo: ".length) });
	}

	return event.summary;
}
