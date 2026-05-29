# Замечания после ручной проверки 0.5

**Дата:** 2026-05-29  
**Контекст:** smoke-тест milestone 0.5 (v0.0.4) на vault `trackdex-dev-vault`.  
**Статус:** backlog для последующих milestones — **не блокирует** gate 0.5.

---

## 1. Sidebar «Треки» — пустое состояние при наличии индекса

**Наблюдение:** sidebar показывает «Пока нет проиндексированных треков», хотя в Track view открытый `.gpx` имеет статус «Проиндексирован» и метрики из индекса. Счётчик в скобках `(6)` появляется, но списка треков нет.

**Причина (текущая реализация):** `TracksSidebarView` — shell из **0.1-12** / **0.3**: empty-state + `listTracks().length` для подписи, без каталога строк. Полноценный список — scope **0.6**.

**Ожидание:** sidebar отображает проиндексированные треки (хотя бы flat list), обновляется после индексации без переоткрытия leaf.

**Куда планировать:**

| Milestone | Задача / область | Действие |
|-----------|------------------|----------|
| **0.6** | [0.6-01-sidebar-tracks-shell.md](../../0.6/0.6-01-sidebar-tracks-shell.md) | Заменить empty placeholder на list container с `trackQuery.listTracks()` |
| **0.6** | [0.6-07-catalog-row-badges.md](../../0.6/0.6-07-catalog-row-badges.md) | Поля строки: дата, дистанция, статус |
| **0.6** | [0.6-08-sidebar-to-track-navigation.md](../../0.6/0.6-08-sidebar-to-track-navigation.md) | Клик по строке → Track view |
| **cross** | [0.3 manual-smoke #5](../../0.3/evidence/manual-smoke-follow-ups.md) | Реактивная подписка sidebar на изменения индекса |

**Acceptance для реализации:**

- [ ] После индексации треки видны в sidebar без reload Obsidian.
- [ ] Empty-state только когда `listTracks()` действительно пуст.
- [ ] Статус/badge строки совпадает с Track view stats panel.

**Связанные требования:** REQ-004, F-21 (sidebar «Треки»), IMPLEMENTATION_PLAN milestone 0.6.

---

## 2. `.gpx.gz` — нет карты и индекса в Track view

**Наблюдение:** файл `4074711732.gpx.gz` (в explorer: `4074711732.gpx` + tag `GZ`) открывает Track view, но:
- карта: «Предпросмотр карты для этого формата скоро появится»;
- статистика: «Этот файл ещё не в индексе».

**Причина (текущая реализация):**

- `matchTrackFileExtensionFromName()` явно возвращает `null` для `.gpx.gz` (v1 scope: только `.fit.gz` как compound suffix).
- `TrackView` инициализирует карту только для `trackExt === "gpx"`.
- Vault scanner / parser router не обрабатывают `.gpx.gz` / `.tcx.gz` (см. REQUIREMENTS § backlog).

**Ожидание (PRODUCT_SPEC REQ-001, REQ-003, REQ-005):** `.gpx.gz` и `.tcx.gz` — decompress → parse → index → map + stats, аналогично plain `.gpx` / `.tcx`.

**Куда планировать:**

| Milestone / область | Действие |
|---------------------|----------|
| **Parser extension** (post-0.4 / pre-0.10) | `gpx.gz` / `tcx.gz` decompress adapter; расширить `matchTrackFileExtensionFromName`, vault scanner, parser router |
| **Track view** | Убрать hardcode `trackExt === "gpx"`; маршрут из индекса для всех v1+compressed форматов |
| **IMPLEMENTATION_PLAN** | Optional backlog: compressed GPX/TCX (см. обновление) |

**Acceptance для реализации:**

- [ ] `.gpx.gz` индексируется и появляется в sidebar (после 0.6).
- [ ] Track view показывает polyline из `polylineSimplified` (или fallback parse).
- [ ] `.tcx.gz` — тот же pipeline.
- [ ] Malformed gzip → visible error, без crash.

**Связанные требования:** PRODUCT_SPEC §3.1 (`.gpx.gz`, `.tcx.gz`); REQUIREMENTS §11 backlog (перенести из backlog в planned scope при реализации).

---

## Сводка по milestones

| # | Тема | Основной milestone |
|---|------|-------------------|
| 1 | Sidebar показывает indexed tracks | **0.6** (0.6-01 … 0.6-08) |
| 2 | `.gpx.gz` / `.tcx.gz` map + index | **Parser extension** + track view wiring (см. IMPLEMENTATION_PLAN backlog) |
