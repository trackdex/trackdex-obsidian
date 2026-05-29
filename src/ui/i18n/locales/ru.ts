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
		trackStatsTitle: "Статистика трека",
		trackStatsNotIndexed: "Этот файл ещё не в индексе.",
		trackStatsPending: "Ожидает индексации.",
		trackStatsIndexing: "Идёт индексация…",
		trackStatsStale:
			"Индекс устарел. Метрики могут не совпадать с файлом.",
		trackStatsIndexError: "Не удалось проиндексировать этот файл.",
		trackStatsLoadError: "Не удалось загрузить статистику из индекса.",
		trackStatsDate: "Дата",
		trackStatsDuration: "Длительность",
		trackStatsDistance: "Дистанция",
		trackStatsElevationGain: "Набор высоты",
		trackStatsElevationLoss: "Сброс высоты",
		trackStatsAvgSpeed: "Средняя скорость",
		trackStatsMaxSpeed: "Макс. скорость",
		trackStatsHrAvg: "Средний пульс",
		trackStatsHrMax: "Макс. пульс",
		trackStatsPowerAvg: "Средняя мощность",
		trackStatsCadenceAvg: "Средний каденс",
		trackStatsSport: "Вид спорта",
		trackStatsStatusPending: "Ожидает",
		trackStatsStatusIndexing: "Индексация",
		trackStatsStatusIndexed: "Проиндексирован",
		trackStatsStatusStale: "Устарел",
		trackStatsStatusError: "Ошибка",
		trackMobileTabMap: "Карта",
		trackMobileTabStats: "Статистика",
		trackPreviewComingSoon:
			"Предпросмотр карты для этого формата скоро появится.",
		trackMapTilesOffline:
			"Тайлы карты недоступны. Показана только геометрия маршрута.",
		trackMapNoGeometry: "Для этого трека нет геометрии маршрута.",
	},
};
