# Замечания после ручной проверки 0.3

**Дата:** 2026-05-29  
**Контекст:** smoke-тест milestone 0.3 на ветке `milestone_0.3` (v0.0.2).  
**Статус:** backlog для последующих milestones — **не блокирует** gate 0.3.

---

## 1. Каталог треков — доступен сразу, без команды

**Наблюдение:** sidebar «Track catalog» открывается только через ribbon / команду `open-tracks-sidebar`.

**Ожидание:** каталог виден сразу после включения плагина (или после первого запуска Obsidian с плагином), без явного вызова команды.

**Куда планировать:**

| Milestone | Задача / область | Действие |
|-----------|------------------|----------|
| **0.6** | [0.6-01-sidebar-tracks-shell.md](../../0.6/0.6-01-sidebar-tracks-shell.md) | Авто-открытие leaf при `onload` (если ещё не открыт) или ribbon по умолчанию активен |
| **0.9** | [0.9-11-wire-commands-real-handlers.md](../../0.9/0.9-11-wire-commands-real-handlers.md) | Проверить, что bootstrap не полагается только на команду |

**Связанные требования:** REQ-004, F-21 (sidebar «Треки»).

---

## 2. Видимый процесс индексирования + pause / resume

**Наблюдение:** во время скана не заметна панель прогресса; возможно, исчезает слишком быстро (stub index jobs в 0.3 завершаются мгновенно).

**Ожидание:** постоянно видимый индикатор активного скана (счётчики, текущий файл), явные кнопки **Pause** и **Resume**; панель не пропадает, пока очередь не idle.

**Куда планировать:**

| Milestone | Задача / область | Действие |
|-----------|------------------|----------|
| **0.9** | [0.9-08-progress-panel-bottom-right.md](../../0.9/0.9-08-progress-panel-bottom-right.md) | UI поверх `ScanProgressStore` из 0.3-10; подписка `subscribe()` |
| **0.9** | [0.9-05-settings-pause-resume-indexing.md](../../0.9/0.9-05-settings-pause-resume-indexing.md) | Pause/resume в settings **и** в progress panel |
| **0.4** | parse pipeline | Реальные parse jobs удлинят скан — прогресс станет заметнее |

**Примечание:** модель прогресса (`createScanProgress`, `IndexingService.scanProgress`) уже есть; не хватает UI и привязки pause к панели.

---

## 3. Настройки: статистика индекса и переиндексация

**Наблюдение:** в settings нет сводки по индексу (сколько проиндексировано, размер БД) и явной кнопки переиндексации.

**Ожидание:** в **Settings → Trackdex** отображать:

- количество треков по статусам (indexed / pending / error / …);
- размер `index.sqlite` (или каталога plugin data);
- действие **Reindex** / **Reset & rebuild index** с подтверждением.

**Куда планировать:**

| Milestone | Задача / область | Действие |
|-----------|------------------|----------|
| **0.9** | [0.9-01-settings-tab-shell.md](../../0.9/0.9-01-settings-tab-shell.md) | Секция «Index status» |
| **0.9** | [0.9-06-settings-reset-rebuild-confirm.md](../../0.9/0.9-06-settings-reset-rebuild-confirm.md) | Переиндексация / reset с confirm |
| **0.2** | index meta / track repo | API для counts + file size adapter |

**Примечание:** 0.9-06 покрывает reset/rebuild, но **не** отображение stats — добавить в scope 0.9-01 или отдельную подзадачу при планировании 0.9.

---

## 4. Непроиндексированный трек — кнопка «Проиндексировать»

**Наблюдение:** при открытии `.gpx` / `.fit` без записи в индексе (или со статусом `pending` / `error`) нет CTA для ручной индексации.

**Ожидание:** в **Track view** empty / partial state — кнопка **Index track** (или «Проиндексировать»), вызывающая incremental/full index job для этого файла.

**Куда планировать:**

| Milestone | Задача / область | Действие |
|-----------|------------------|----------|
| **0.5** | [0.5-01-track-view-registration.md](../../0.5/0.5-01-track-view-registration.md), [0.5-06-stats-panel-indexed-data.md](../../0.5/0.5-06-stats-panel-indexed-data.md) | Empty state + CTA по статусу файла |
| **0.3+** | `IndexingService` | Порт `indexSingleTrack(path)` или reuse incremental `created`/`modified` |

**Связанные требования:** REQUIREMENTS §4 — badge на непроиндексированных; аналогичный UX в track view.

---

## 5. ⚠️ Реактивное обновление состояний из единого источника правды

**Наблюдение:** после индексации / vault events UI (sidebar, track view) может не обновляться без переоткрытия view.

**Ожидание (архитектурное, приоритет HIGH):**

- Один canonical owner для: статусов треков, прогресса скана, meta (`scan_paused`, `last_run_interrupted`, …).
- UI (sidebar, track view, progress panel, settings stats) **подписывается** на изменения, а не держит локальные копии.
- Поток: event / use case → store / repository → notify → все view re-render.

**Куда планировать:**

| Milestone | Задача / область | Действие |
|-----------|------------------|----------|
| **0.6** | catalog sidebar | Read model + `subscribe` на catalog/index changes |
| **0.5** | track view | Подписка на статус текущего файла |
| **0.9** | progress panel, settings stats | Подписка на `ScanProgressStore` + index meta |
| **cross** | application layer | Явный `CatalogReadModel` / `IndexStateStore` (или расширение `IndexingService`) как единая точка для UI |

**Связанные правила:** `.cursor/rules/agent-code-quality.mdc` — «one canonical owner», one-way data flow.

**Acceptance для реализации:**

- [ ] Добавление GPX → строка появляется в sidebar без reload leaf.
- [ ] Завершение index job → badge/status в sidebar и track view обновляются сразу.
- [ ] Pause/resume → progress panel и settings отражают одно состояние.
- [ ] Interrupted banner исчезает после resume без ручного refresh.

---

## Сводка по milestones

| # | Тема | Основной milestone |
|---|------|-------------------|
| 1 | Auto-open catalog | **0.6** |
| 2 | Progress UI + pause/resume | **0.9** (0.9-08, 0.9-05) |
| 3 | Settings stats + reindex | **0.9** (0.9-01, 0.9-06) |
| 4 | Index button в track view | **0.5** |
| 5 | Reactive single source of truth | **cross** (0.5, 0.6, 0.9 + application store) |
