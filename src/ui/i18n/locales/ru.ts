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
};
