import { hashPassword } from "../src/lib/auth/password";

const MIN_PASSWORD_LENGTH = 12;

const chunks: Buffer[] = [];
process.stdin.on("data", (chunk: Buffer) => chunks.push(chunk));
process.stdin.on("end", () => {
	const password = Buffer.concat(chunks)
		.toString("utf8")
		.replace(/\r?\n$/, "");
	if (password.length < MIN_PASSWORD_LENGTH) {
		console.error(`Heslo musí mít alespoň ${MIN_PASSWORD_LENGTH} znaků.`);
		process.exit(1);
	}
	console.log(hashPassword(password));
});
