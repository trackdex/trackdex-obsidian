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
	interruptedRun: {
		message:
			"Индексация не была завершена в прошлый раз. Часть треков может отсутствовать или быть устаревшей.",
		resumeCta: "Проверить и продолжить",
		resuming: "Проверка…",
	},
	firstScan: {
		title: "Индексировать треки в этом хранилище",
		body:
			"Trackdex просканирует хранилище на файлы GPX, TCX и FIT. Файлы только читаются; заметки и треки не изменяются.",
		formats: "Поддерживаются: .gpx, .tcx, .fit и .fit.gz (без учёта регистра).",
		approveCta: "Начать индексацию",
		approving: "Запуск…",
	},
	views: {
		tracksSidebarTitle: "Каталог треков",
		tracksSidebarEmpty:
			"Пока нет проиндексированных треков. Здесь появится прогресс индексации.",
		trackStatsPlaceholder:
			"Панель статистики (этап 0.5). Проиндексировано треков: {count}.",
		trackMobileTabsHint:
			"На мобильных карта и статистика будут во вкладках.",
		trackPreviewComingSoon:
			"Предпросмотр карты для этого формата скоро появится.",
	},
};
