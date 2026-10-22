import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	fmt: {
		useTabs: true,
		tabWidth: 2,
		printWidth: 120,
		semi: true,
		singleQuote: false,
		trailingComma: "all",
		ignorePatterns: [".next/**", "node_modules/**", "pnpm-lock.yaml", "next-env.d.ts"],
	},
	test: {
		include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
		environment: "node",
	},
	lint: {
		options: { typeAware: true, typeCheck: true },
	},
});
