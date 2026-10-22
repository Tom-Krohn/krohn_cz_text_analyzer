import { saveUiPreferenceAction } from "@/app/admin/(protected)/preference-actions";
import type { UiMessages } from "@/lib/i18n/messages";
import { localeLabels, locales, type Locale, type Theme } from "@/lib/i18n/types";

const groupClass = "flex min-w-0 flex-col gap-1.5";
const legendClass = "text-[11px] font-semibold text-muted";
const optionsClass = "inline-flex w-fit rounded-lg border border-line bg-background/50 p-0.5";
const optionClass =
	"min-h-8 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const selectedClass = "bg-accent text-white";
const unselectedClass = "text-muted hover:bg-surface-raised hover:text-foreground";

export function AccountPreferenceControls({
	locale,
	theme,
	messages,
}: {
	locale: Locale;
	theme: Theme;
	messages: UiMessages["common"];
}) {
	return (
		<form action={saveUiPreferenceAction} className="grid grid-cols-2 gap-3">
			<fieldset className={groupClass}>
				<legend className={legendClass}>{messages.language}</legend>
				<div className={optionsClass}>
					{locales.map((supportedLocale) => (
						<button
							aria-pressed={locale === supportedLocale}
							className={`${optionClass} ${locale === supportedLocale ? selectedClass : unselectedClass}`}
							key={supportedLocale}
							name="locale"
							type="submit"
							value={supportedLocale}
						>
							{localeLabels[supportedLocale]}
						</button>
					))}
				</div>
			</fieldset>
			<fieldset className={groupClass}>
				<legend className={legendClass}>{messages.appearance}</legend>
				<div className={optionsClass}>
					<button
						aria-pressed={theme === "light"}
						className={`${optionClass} ${theme === "light" ? selectedClass : unselectedClass}`}
						name="theme"
						type="submit"
						value="light"
					>
						{messages.light}
					</button>
					<button
						aria-pressed={theme === "dark"}
						className={`${optionClass} ${theme === "dark" ? selectedClass : unselectedClass}`}
						name="theme"
						type="submit"
						value="dark"
					>
						{messages.dark}
					</button>
				</div>
			</fieldset>
		</form>
	);
}
