import {t} from "../i18n";

export interface FirstScanEmptyStateHandle {
	dispose(): void;
	setBusy(busy: boolean): void;
}

export interface RenderFirstScanEmptyStateOptions {
	readonly container: HTMLElement;
	readonly onApprove: () => void | Promise<void>;
}

/** First-run consent empty state with CTA (REQ-001 / §7.1). */
export function renderFirstScanEmptyState(
	options: RenderFirstScanEmptyStateOptions,
): FirstScanEmptyStateHandle {
	const root = options.container.createDiv({cls: "trackdex-first-scan"});

	root.createEl("h3", {
		cls: "trackdex-first-scan__title",
		text: t("firstScan.title"),
	});
	root.createEl("p", {
		cls: "trackdex-first-scan__body",
		text: t("firstScan.body"),
	});
	root.createEl("p", {
		cls: "trackdex-first-scan__formats",
		text: t("firstScan.formats"),
	});

	const button = root.createEl("button", {
		cls: "mod-cta trackdex-first-scan__cta",
		text: t("firstScan.approveCta"),
	});

	let approving = false;

	const runApprove = (): void => {
		if (approving) {
			return;
		}
		approving = true;
		button.disabled = true;
		button.setText(t("firstScan.approving"));

		void (async () => {
			try {
				await options.onApprove();
			} finally {
				approving = false;
				button.disabled = false;
				button.setText(t("firstScan.approveCta"));
			}
		})();
	};

	button.addEventListener("click", runApprove);

	return {
		dispose(): void {
			root.remove();
		},
		setBusy(busy: boolean): void {
			button.disabled = busy;
			if (!busy && !approving) {
				button.setText(t("firstScan.approveCta"));
			}
		},
	};
}
