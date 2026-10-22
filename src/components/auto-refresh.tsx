"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_INTERVAL_MS = 3000;

export function AutoRefresh({ active }: { active: boolean }) {
	const router = useRouter();

	useEffect(() => {
		if (!active) return;
		const timer = setInterval(() => router.refresh(), REFRESH_INTERVAL_MS);
		return () => clearInterval(timer);
	}, [active, router]);

	return null;
}
