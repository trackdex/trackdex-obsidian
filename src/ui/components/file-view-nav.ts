import type {TextFileView} from "obsidian";

/** Undocumented FileView helpers used for native header navigation buttons. */
export interface FileViewNav extends TextFileView {
	titleContainerEl?: HTMLElement;
	titleEl?: HTMLElement;
	updateNavButtons(): void;
}

export function asFileViewNav(view: TextFileView): FileViewNav {
	return view as FileViewNav;
}

export function syncViewHeaderTitle(view: TextFileView): void {
	const fileView = asFileViewNav(view);
	fileView.titleContainerEl?.show();
	if (fileView.titleEl) {
		fileView.titleEl.setText(view.getDisplayText());
	}
}

export function refreshViewNavButtons(view: TextFileView): void {
	if (!view.file) {
		return;
	}
	asFileViewNav(view).updateNavButtons?.();
}
