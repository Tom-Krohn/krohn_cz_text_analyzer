"use server";

import { redirect } from "next/navigation";
import { analyzePage, saveProposalDecision } from "@/lib/ai/analysis";
import { requireAdmin } from "@/lib/auth/session";
import { formatActionError, UserFacingActionError } from "@/lib/i18n/action-errors";
import { getRequestI18n } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/format";

function formText(formData: FormData, name: string): string {
	const value = formData.get(name);
	return typeof value === "string" ? value : "";
}

function redirectToPage(projectId: string, pageId: string, key: "notice" | "error", message: string): never {
	redirect(`/admin/projects/${projectId}/pages/${pageId}?${key}=${encodeURIComponent(message)}`);
}

export async function analyzePageAction(projectId: string, pageId: string): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	let message = "";
	let key: "notice" | "error" = "notice";
	try {
		const result = await analyzePage(projectId, pageId);
		message = interpolate(messages.actions.analysisFinished, {
			assessed: result.assessed,
			proposed: result.proposed,
		});
	} catch (error) {
		key = "error";
		message = formatActionError(error, messages);
	}
	redirectToPage(projectId, pageId, key, message);
}

export async function decideProposalAction(projectId: string, pageId: string, formData: FormData): Promise<never> {
	const { messages } = await getRequestI18n();
	await requireAdmin();
	const proposalId = formText(formData, "proposalId");
	const decision = formText(formData, "decision");
	let key: "notice" | "error" = "notice";
	let message = messages.actions.proposalSaved;
	try {
		if (decision !== "approved" && decision !== "rejected" && decision !== "pending") {
			throw new UserFacingActionError(messages.actions.unknownDecision);
		}
		await saveProposalDecision(projectId, proposalId, {
			status: decision,
			editedText: formText(formData, "editedText"),
		});
	} catch (error) {
		key = "error";
		message = formatActionError(error, messages);
	}
	redirectToPage(projectId, pageId, key, message);
}
