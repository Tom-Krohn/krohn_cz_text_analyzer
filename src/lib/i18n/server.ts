import { getMessages } from "./messages";
import { getRequestPreferences } from "./preferences";

export async function getRequestI18n() {
	const preferences = await getRequestPreferences();
	return {
		...preferences,
		messages: getMessages(preferences.locale),
	};
}
