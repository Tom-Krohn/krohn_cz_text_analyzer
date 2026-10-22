import { describe, expect, it } from "vite-plus/test";
import { isPublicIpAddress } from "./network";

describe("isPublicIpAddress", () => {
	it.each([
		"127.0.0.1",
		"10.1.2.3",
		"172.16.0.1",
		"192.168.1.1",
		"169.254.169.254",
		"100.64.0.1",
		"0.0.0.0",
		"::1",
		"::",
		"fe80::1",
		"fc00::1",
		"::ffff:127.0.0.1",
		"::ffff:7f00:1",
		"::ffff:a9fe:a9fe",
	])("blokuje neveřejnou adresu %s", (address) => {
		expect(isPublicIpAddress(address)).toBe(false);
	});

	it.each(["93.184.216.34", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("povolí veřejnou adresu %s", (address) => {
		expect(isPublicIpAddress(address)).toBe(true);
	});

	it("odmítne text, který není IP adresa", () => {
		expect(isPublicIpAddress("example.com")).toBe(false);
	});
});
