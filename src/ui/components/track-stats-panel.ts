import type {TrackQueryService} from "../../application/services/track-query-service";
import type {TrackRecord} from "../../domain/track/track-record";
import type {TrackStatus} from "../../domain/track/track-status";
import {t} from "../i18n";
import type {TranslationKey} from "../i18n/locales/en";
import {
	formatCadenceRpm,
	formatDistanceM,
	formatDurationSec,
	formatElevationM,
	formatHeartRateBpm,
	formatPowerW,
	formatSpeedMps,
	formatSportDisplay,
	formatTrackDateUtc,
} from "../formatting/track-stats-format";

export interface TrackStatsPanelHandle {
	refresh(): Promise<void>;
	dispose(): void;
}

export interface RenderTrackStatsPanelOptions {
	readonly container: HTMLElement;
	readonly trackQuery: TrackQueryService;
	readonly filePath: string | null;
}

interface StatRowSpec {
	readonly key: string;
	readonly label: string;
	readonly value: string;
}

const METRICS_VISIBLE_STATUSES: ReadonlySet<TrackStatus> = new Set([
	"indexed",
	"stale",
]);

const STATUS_LABEL_KEYS: Record<TrackStatus, TranslationKey> = {
	pending: "views.trackStatsStatusPending",
	indexing: "views.trackStatsStatusIndexing",
	indexed: "views.trackStatsStatusIndexed",
	stale: "views.trackStatsStatusStale",
	error: "views.trackStatsStatusError",
};

function statusLabel(status: TrackStatus): string {
	return t(STATUS_LABEL_KEYS[status]);
}

function buildMetricRows(record: TrackRecord): StatRowSpec[] {
	return [
		{
			key: "date",
			label: t("views.trackStatsDate"),
			value: formatTrackDateUtc(record.startedAtUtc),
		},
		{
			key: "duration",
			label: t("views.trackStatsDuration"),
			value: formatDurationSec(record.durationSec),
		},
		{
			key: "distance",
			label: t("views.trackStatsDistance"),
			value: formatDistanceM(record.distanceM),
		},
		{
			key: "elevationGain",
			label: t("views.trackStatsElevationGain"),
			value: formatElevationM(record.elevationGainM),
		},
		{
			key: "elevationLoss",
			label: t("views.trackStatsElevationLoss"),
			value: formatElevationM(record.elevationLossM),
		},
		{
			key: "avgSpeed",
			label: t("views.trackStatsAvgSpeed"),
			value: formatSpeedMps(record.avgSpeedMps),
		},
		{
			key: "maxSpeed",
			label: t("views.trackStatsMaxSpeed"),
			value: formatSpeedMps(record.maxSpeedMps),
		},
		{
			key: "hrAvg",
			label: t("views.trackStatsHrAvg"),
			value: formatHeartRateBpm(record.hrAvg),
		},
		{
			key: "hrMax",
			label: t("views.trackStatsHrMax"),
			value: formatHeartRateBpm(record.hrMax),
		},
		{
			key: "powerAvg",
			label: t("views.trackStatsPowerAvg"),
			value: formatPowerW(record.powerAvg),
		},
		{
			key: "cadenceAvg",
			label: t("views.trackStatsCadenceAvg"),
			value: formatCadenceRpm(record.cadenceAvg),
		},
		{
			key: "sport",
			label: t("views.trackStatsSport"),
			value: formatSportDisplay(record.sportNormalized, record.sportRaw),
		},
	];
}

function buildStatusMessage(record: TrackRecord | null): string | null {
	if (record === null) {
		return t("views.trackStatsNotIndexed");
	}
	if (record.status === "error") {
		return record.errorMessage ?? t("views.trackStatsIndexError");
	}
	if (record.status === "pending") {
		return t("views.trackStatsPending");
	}
	if (record.status === "indexing") {
		return t("views.trackStatsIndexing");
	}
	if (record.status === "stale") {
		return t("views.trackStatsStale");
	}
	return null;
}

/** Stats panel backed by indexed {@link TrackRecord} rows (0.5-06). */
export function renderTrackStatsPanel(
	options: RenderTrackStatsPanelOptions,
): TrackStatsPanelHandle {
	const root = options.container;
	root.empty();
	root.addClass("trackdex-track-stats-panel");

	const titleEl = root.createEl("h3", {
		cls: "trackdex-track-stats-panel__title",
		text: t("views.trackStatsTitle"),
	});
	const statusEl = root.createDiv({cls: "trackdex-track-stats-panel__status"});
	const messageEl = root.createDiv({cls: "trackdex-track-stats-panel__message"});
	const rowsEl = root.createDiv({cls: "trackdex-track-stats-panel__rows"});

	let refreshGeneration = 0;

	const renderRows = (rows: StatRowSpec[]): void => {
		rowsEl.empty();
		for (const row of rows) {
			const rowEl = rowsEl.createDiv({
				cls: "trackdex-track-stats-panel__row",
				attr: {"data-stat": row.key},
			});
			rowEl.createSpan({
				cls: "trackdex-track-stats-panel__label",
				text: row.label,
			});
			rowEl.createSpan({
				cls: "trackdex-track-stats-panel__value",
				text: row.value,
			});
		}
	};

	const renderRecord = (record: TrackRecord | null): void => {
		const statusMessage = buildStatusMessage(record);
		messageEl.empty();
		statusEl.empty();
		rowsEl.empty();

		if (record === null) {
			titleEl.setText(t("views.trackStatsTitle"));
			messageEl.setText(statusMessage ?? "");
			return;
		}

		const title =
			record.titleFromFile?.trim() ||
			record.path.split("/").pop() ||
			t("views.trackStatsTitle");
		titleEl.setText(title);

		statusEl.createSpan({
			cls: `trackdex-track-stats-panel__status-badge trackdex-track-stats-panel__status-badge--${record.status}`,
			text: statusLabel(record.status),
		});

		if (statusMessage !== null) {
			messageEl.setText(statusMessage);
		}

		if (METRICS_VISIBLE_STATUSES.has(record.status)) {
			renderRows(buildMetricRows(record));
		}
	};

	const refresh = async (): Promise<void> => {
		const generation = ++refreshGeneration;
		const filePath = options.filePath;
		if (filePath === null) {
			renderRecord(null);
			return;
		}

		try {
			const record = await options.trackQuery.findTrackByPath(filePath);
			if (generation !== refreshGeneration) {
				return;
			}
			renderRecord(record);
		} catch {
			if (generation !== refreshGeneration) {
				return;
			}
			messageEl.setText(t("views.trackStatsLoadError"));
			rowsEl.empty();
		}
	};

	void refresh();

	return {
		refresh,
		dispose(): void {
			refreshGeneration++;
			root.empty();
		},
	};
}
