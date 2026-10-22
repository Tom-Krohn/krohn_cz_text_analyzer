export type FieldExtraction = "found" | "missing" | "uncertain";

export type FieldAssessmentInput = {
	field: string;
	extraction: FieldExtraction;
	score: number | null;
};

export function isWeakScore(score: number, threshold: number): boolean {
	return score < threshold;
}

export function selectFieldsForProposal(fields: FieldAssessmentInput[], threshold: number): string[] {
	return fields
		.filter((field) => field.extraction === "found" && field.score !== null && isWeakScore(field.score, threshold))
		.map((field) => field.field);
}
