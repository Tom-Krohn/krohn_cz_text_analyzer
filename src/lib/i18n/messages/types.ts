import type cs from "./cs";

type Widen<T> = T extends string
	? string
	: T extends number
		? number
		: T extends boolean
			? boolean
			: T extends readonly (infer Item)[]
				? Widen<Item>[]
				: T extends object
					? { [Key in keyof T]: Widen<T[Key]> }
					: T;

export type UiMessages = Widen<typeof cs>;
