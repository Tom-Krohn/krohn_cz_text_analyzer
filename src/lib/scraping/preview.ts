import type { ExtractedField } from "./extract";

export type ExtractionPreviewField = ExtractedField & { textTruncated: boolean };

export type ExtractionPreviewState = {
	status: "idle" | "error" | "preview";
	message: string;
	samplePageId?: string;
	url?: string;
	htmlTruncated?: boolean;
	fields?: ExtractionPreviewField[];
};
