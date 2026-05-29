import {t} from "../i18n";

export interface InterruptedRunBannerHandle {
	dispose(): void;
	setBusy(busy: boolean): void;
}

export interface RenderInterruptedRunBannerOptions {
	readonly container: HTMLElement;
	readonly onResume: () => void | Promise<void>;
}

/** Banner when `last_run_interrupted` is set (§7.1). */
export function renderInterruptedRunBanner(
	options: RenderInterruptedRunBannerOptions,
): InterruptedRunBannerHandle {
	const root = options.container.createDiv({cls: "trackdex-interrupted-run"});

	root.createEl("p", {
		cls: "trackdex-interrupted-run__message",
		text: t("interruptedRun.message"),
	});

	const button = root.createEl("button", {
		cls: "mod-cta trackdex-interrupted-run__cta",
		text: t("interruptedRun.resumeCta"),
	});

	let resuming = false;

	const runResume = (): void => {
		if (resuming) {
			return;
		}
		resuming = true;
		button.disabled = true;
		button.setText(t("interruptedRun.resuming"));

		void (async () => {
			try {
				await options.onResume();
			} finally {
				resuming = false;
				button.disabled = false;
				button.setText(t("interruptedRun.resumeCta"));
			}
		})();
	};

	button.addEventListener("click", runResume);

	return {
		dispose(): void {
			root.remove();
		},
		setBusy(busy: boolean): void {
			button.disabled = busy;
			if (!busy && !resuming) {
				button.setText(t("interruptedRun.resumeCta"));
			}
		},
	};
}
