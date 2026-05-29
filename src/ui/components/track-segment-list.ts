import type {TrackSegment} from "../../domain/track/track-segment";
import {t} from "../i18n";
import {
	formatSegmentDistance,
	formatSegmentDuration,
	formatSegmentName,
	formatSegmentPointCount,
	shouldShowSegmentList,
} from "../formatting/track-segment-format";

export interface SegmentRowSpec {
	readonly id: string;
	readonly name: string;
	readonly duration: string;
	readonly distance: string;
	readonly pointCount: string;
}

export function buildSegmentRows(segments: readonly TrackSegment[]): SegmentRowSpec[] {
	return segments.map((segment, index) => ({
		id: segment.id,
		name: formatSegmentName(
			segment.name,
			t("views.trackSegmentDefaultName", {index: String(index + 1)}),
		),
		duration: formatSegmentDuration(segment),
		distance: formatSegmentDistance(segment),
		pointCount: formatSegmentPointCount(segment.pointCount),
	}));
}

/** Renders multi-segment list from indexed {@link TrackSegment} rows (0.5-07). */
export function renderTrackSegmentList(
	container: HTMLElement,
	segments: readonly TrackSegment[] | null | undefined,
): void {
	container.empty();
	container.removeClass("trackdex-track-segment-list");

	if (!shouldShowSegmentList(segments)) {
		container.hide();
		return;
	}

	container.show();
	container.addClass("trackdex-track-segment-list");

	const titleEl = container.createEl("h4", {
		cls: "trackdex-track-segment-list__title",
		text: t("views.trackSegmentListTitle"),
	});
	titleEl.setAttr("id", "trackdex-track-segment-list-title");

	const listEl = container.createDiv({
		cls: "trackdex-track-segment-list__items",
		attr: {"aria-labelledby": "trackdex-track-segment-list-title"},
	});

	const rows = buildSegmentRows(segments!);
	for (const row of rows) {
		const itemEl = listEl.createDiv({
			cls: "trackdex-track-segment-list__item",
			attr: {"data-segment-id": row.id},
		});

		itemEl.createDiv({
			cls: "trackdex-track-segment-list__name",
			text: row.name,
		});

		const metricsEl = itemEl.createDiv({cls: "trackdex-track-segment-list__metrics"});

		appendMetric(metricsEl, t("views.trackSegmentDuration"), row.duration);
		appendMetric(metricsEl, t("views.trackSegmentDistance"), row.distance);
		appendMetric(metricsEl, t("views.trackSegmentPointCount"), row.pointCount);
	}
}

function appendMetric(parent: HTMLElement, label: string, value: string): void {
	const rowEl = parent.createDiv({cls: "trackdex-track-segment-list__metric"});
	rowEl.createSpan({
		cls: "trackdex-track-segment-list__metric-label",
		text: label,
	});
	rowEl.createSpan({
		cls: "trackdex-track-segment-list__metric-value",
		text: value,
	});
}
