# Changelog

Краткая история релизов Trackdex. Формат версий — [SemVer](https://semver.org/).

## [0.5.0] — 2026-05-29

- Custom Track view при открытии `.gpx`, `.tcx`, `.fit`, `.fit.gz` из проводника.
- Desktop: карта и статистика в двух колонках; mobile: вкладки «Карта» / «Статистика».
- Leaflet-карта с polyline из индекса; offline fallback с уведомлением и attribution.
- Панель статистики и список сегментов только из indexed data (без re-parse).

## [0.4.0] — 2026-05-29

- Парсеры GPX, TCX, FIT и FIT.GZ через единый router (`fit-file-parser`, без spike-зависимостей).
- Нормализация timestamps/timezone, вычисляемые метрики, multi-segment aggregation.
- Polyline simplification, bbox, флаги отсутствующих данных; parse pipeline в индексации.
- Fixture-тесты valid/partial/invalid для всех v1-форматов.

## [0.0.4] — 2026-05-29

- Парсеры GPX, TCX, FIT и FIT.GZ через единый router.
- Нормализация timestamps, вычисляемые метрики, polyline/bbox, флаги отсутствующих данных.
- Parse pipeline в индексации; fixture-тесты для всех v1-форматов.

## [0.0.3] — 2026-05-29

- Движок сканирования vault: полный и инкрементальный scan, exclude-паттерны, очередь работ.
- Машина состояний файлов, IndexingService, прогресс для UI.
- UX первого скана (consent), recovery после прерванной индексации.

## [0.0.2] — 2026-05-29

- SQLite-схема v1, миграции, репозитории (tracks, places, links, index meta).
- Ротируемые логи, reset index, документация plugin data dir в README.

## [0.0.1] — 2026-05-29

- Слоистая архитектура (`domain` / `application` / `infrastructure` / `ui`), порты и DI-контейнер.
- i18n (EN/RU), команды и пустые view; решения по storage (sql.js) и FIT-парсеру.
- Удалён legacy-прототип settings/commands.
