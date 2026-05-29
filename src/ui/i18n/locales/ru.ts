import type {MessagesSchema} from "./en";

export const ru: MessagesSchema = {
	commands: {
		scanOrResumeIndexing: "Сканировать или продолжить индексацию",
		reindexPlaces: "Переиндексировать места",
		makeCurrentNotePlace: "Сделать текущую заметку местом",
		editCurrentPlaceGeometry: "Редактировать геометрию места",
		pauseIndexing: "Приостановить индексацию",
		resetRebuildIndex: "Сбросить и пересоздать индекс",
		openOverview: "Открыть обзор",
		insertMarker: "Вставить маркер",
		scanTracksFolder: "Сканировать папку треков",
		openTracksSidebar: "Открыть каталог треков",
	},
	settings: {
		tracksFolderName: "Папка треков",
		tracksFolderDesc: "Папка с GPX-файлами внутри хранилища",
		basemapTileUrlName: "URL тайлов подложки",
		basemapTileUrlDesc:
			"Шаблон растровых тайлов с {z}, {x}, {y} (по умолчанию: OpenStreetMap). " +
			"URL стилей MapLibre/OpenFreeMap в Obsidian не поддерживаются.",
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
