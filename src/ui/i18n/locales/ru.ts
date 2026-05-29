import type {MessagesSchema} from "./en";

export const ru: MessagesSchema = {
	commands: {
		scanOrResumeIndexing: "Сканировать или продолжить индексацию",
		reindexPlaces: "Переиндексировать места",
		makeCurrentNotePlace: "Сделать текущую заметку местом",
		editCurrentPlaceGeometry: "Редактировать геометрию места",
		pauseIndexing: "Приостановить индексацию",
		resetRebuildIndex: "Сбросить и пересоздать индекс",
		openTracksSidebar: "Открыть каталог треков",
	},
	settings: {
		comingSoon: "Настройки Trackdex появятся в следующих этапах.",
	},
	common: {
		notImplementedYet: "Пока не реализовано",
	},
	views: {
		tracksSidebarTitle: "Каталог треков",
		tracksSidebarEmpty:
			"Каталог треков скоро появится. Индексация — в следующих этапах.",
		trackStatsPlaceholder:
			"Панель статистики (этап 0.5). Проиндексировано треков: {count}.",
		trackMobileTabsHint:
			"На мобильных карта и статистика будут во вкладках.",
		trackPreviewComingSoon:
			"Предпросмотр карты для этого формата скоро появится.",
	},
};
