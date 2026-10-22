import { interpolate } from "./format";
import type { UiMessages } from "./messages";

export class UserFacingActionError extends Error {}

export function formatActionError(error: unknown, messages: UiMessages): string {
	if (error instanceof UserFacingActionError) return error.message;
	if (!(error instanceof Error)) return messages.actions.unknownError;

	const domainMatch = error.message.match(/^Neplatná doména: (.+)$/);
	if (domainMatch) return interpolate(messages.actions.invalidDomain, { domain: domainMatch[1] });

	const feedHttpMatch = error.message.match(/^Feed (.+) vrátil HTTP (\d+)\.$/);
	if (feedHttpMatch) {
		return interpolate(messages.actions.feedHttpError, { url: feedHttpMatch[1], status: feedHttpMatch[2] });
	}

	const feedSizeMatch = error.message.match(/^Feed (.+) překračuje povolenou velikost\.$/);
	if (feedSizeMatch) return interpolate(messages.actions.feedSizeExceeded, { url: feedSizeMatch[1] });

	const blockedMatch = error.message.match(/^Server odmítl přístup \(HTTP (\d+)\)\.$/);
	if (blockedMatch) return interpolate(messages.actions.scrapeBlocked, { status: blockedMatch[1] });

	const httpMatch = error.message.match(/^Server vrátil HTTP (\d+)\.$/);
	if (httpMatch) return interpolate(messages.actions.scrapeHttpFailed, { status: httpMatch[1] });

	const missingKeyMatch = error.message.match(/^Chybí API klíč pro poskytovatele ([^.]+)\. Doplňte jej v nastavení\.$/);
	if (missingKeyMatch) return interpolate(messages.actions.providerKeyMissing, { provider: missingKeyMatch[1] });

	const privateAddressMatch = error.message.match(/^Adresa (.+) nevede na veřejnou IP adresu\.$/);
	if (privateAddressMatch) return interpolate(messages.actions.privateAddress, { hostname: privateAddressMatch[1] });

	const selectorMatch = error.message.match(/^Neplatný CSS selektor pro (.+): (.+)$/);
	if (selectorMatch) {
		const selectorFieldMatch = selectorMatch[1].match(/^vylučovacího (\d+)$/);
		const field =
			selectorMatch[1] === "hlavního obsahu"
				? messages.actions.selectorFields.main
				: selectorMatch[1] === "krátkého popisu"
					? messages.actions.selectorFields.short
					: selectorMatch[1] === "dlouhého popisu"
						? messages.actions.selectorFields.long
						: selectorFieldMatch
							? interpolate(messages.actions.selectorFields.excluded, { index: selectorFieldMatch[1] })
							: selectorMatch[1];
		return interpolate(messages.actions.invalidSelector, { field, selector: selectorMatch[2] });
	}

	const providerHttpMatch = error.message.match(/^Poskytovatel vrátil HTTP (\d+)\.$/);
	if (providerHttpMatch) return interpolate(messages.actions.providerHttpError, { status: providerHttpMatch[1] });

	const providerErrorMatch = error.message.match(/^Poskytovatel vrátil chybu: (.+)$/);
	if (providerErrorMatch) return interpolate(messages.actions.providerError, { message: providerErrorMatch[1] });

	const knownMessages: Record<string, string> = {
		"Neznámá chyba.": messages.actions.unknownError,
		"Neznámý formát feedu.": messages.actions.unknownFeedFormat,
		"Zadejte platnou URL feedu.": messages.actions.invalidFeedUrl,
		"Vyberte soubor feedu.": messages.actions.selectFeedFile,
		"Soubor je větší než 4 MB. Použijte URL feedu.": messages.actions.feedTooLarge,
		"Texty byly načteny.": messages.actions.scrapeComplete,
		"Odpověď není HTML stránka.": messages.actions.scrapeNotHtml,
		"Neznámé rozhodnutí.": messages.actions.unknownDecision,
		"Návrh v projektu neexistuje.": messages.actions.proposalMissing,
		"Stránka v projektu neexistuje.": messages.actions.pageMissing,
		"Projekt neexistuje.": messages.actions.projectMissing,
		"Vzorová stránka v projektu neexistuje.": messages.actions.samplePageMissing,
		"Stránku nejprve úspěšně znovu načtěte.": messages.actions.analysisPageNotLoaded,
		"Stránka nemá pole vhodná k analýze.": messages.actions.analysisNoFields,
		"Odpověď modelu neprošla validací. Zkuste analýzu znovu.": messages.actions.analysisOutputInvalid,
		"Nepodařilo se založit auditní záznam analýzy.": messages.actions.analysisAuditFailed,
		"Nejprve v nastavení vyberte poskytovatele a model.": messages.actions.providerModelRequired,
		"Stejná úloha pro tento projekt už běží nebo čeká ve frontě.": messages.actions.batchAlreadyActive,
		"Nejsou žádné URL, které by šlo zpracovat.": messages.actions.noBatchCandidates,
		"Úlohu nelze zařadit do fronty. Spusťte Inngest dev server příkazem pnpm jobs:dev.":
			messages.actions.batchQueueFailed,
		"Úloha neexistuje nebo ještě není ukončená.": messages.actions.batchDeleteUnavailable,
		"Selektory nelze změnit, dokud v projektu běží nebo čeká hromadná úloha.": messages.actions.selectorsBusy,
		"Selektory nelze změnit, dokud se v projektu načítá stránka.": messages.actions.selectorsScraping,
		"XML s DTD nebo entitami není povolené.": messages.actions.xmlEntitiesForbidden,
		"Soubor není podporovaná sitemapa (chybí urlset nebo sitemapindex).": messages.actions.unsupportedSitemap,
		"Sitemap index obsahuje příliš mnoho souborů.": messages.actions.sitemapIndexTooLarge,
		"Nepodporované schéma URL.": messages.actions.unsupportedUrlScheme,
		"Doména není povolena pro tento projekt.": messages.actions.domainNotAllowed,
		"Příliš mnoho přesměrování.": messages.actions.tooManyRedirects,
		"Poskytovatel neodpověděl včas.": messages.actions.providerTimeout,
		"Poskytovatel odmítl požadavek. Zkontrolujte model.": messages.actions.providerBadRequest,
		"Neplatný API klíč.": messages.actions.providerInvalidKey,
		"U poskytovatele došly kredity.": messages.actions.providerCredits,
		"Přístup k modelu je zamítnut.": messages.actions.providerAccessDenied,
		"Model nebyl nalezen.": messages.actions.providerModelMissing,
		"Překročen limit poskytovatele. Zkuste to později.": messages.actions.providerRateLimit,
		"Šifrovací klíč musí mít 32 bajtů zakódovaných v base64.": messages.actions.invalidEncryptionKey,
		"Neplatný šifrovaný obsah.": messages.actions.invalidEncryptedContent,
	};
	const knownMessage = knownMessages[error.message];
	return knownMessage ?? interpolate(messages.actions.detailError, { detail: error.message });
}

export function formatProjectInputIssue(
	issue: { path: PropertyKey[]; code: string; message: string } | undefined,
	messages: UiMessages,
): string {
	if (!issue) return messages.actions.unknownError;
	if (issue.path[0] === "name" && issue.code === "too_small") return messages.actions.requiredProjectName;
	if (issue.path[0] === "allowedHostsText" && issue.code === "too_small") return messages.actions.requiredDomain;
	if (issue.code === "too_big") {
		const tooLongMessages: Record<string, string> = {
			name: messages.actions.projectInputErrors.nameTooLong,
			audience: messages.actions.projectInputErrors.audienceTooLong,
			tone: messages.actions.projectInputErrors.toneTooLong,
			rules: messages.actions.projectInputErrors.rulesTooLong,
			mainContentSelector: messages.actions.projectInputErrors.mainSelectorTooLong,
			shortDescriptionSelector: messages.actions.projectInputErrors.shortSelectorTooLong,
			longDescriptionSelector: messages.actions.projectInputErrors.longSelectorTooLong,
			excludedSelectorsText: messages.actions.projectInputErrors.excludedSelectorsTooLong,
		};
		const field = issue.path[0];
		if (typeof field === "string" && tooLongMessages[field]) return tooLongMessages[field];
	}
	if (issue.path[0] === "qualityThreshold" && ["invalid_type", "too_big", "too_small"].includes(issue.code)) {
		return messages.actions.projectInputErrors.qualityThresholdRange;
	}
	return formatActionError(new Error(issue.message), messages);
}
