# Product/Feature Spec v1

## 1. Цель и ценность
- Проблема: в vault хранятся GPS-треки в разных папках и форматах, но нет единого офлайн-каталога с поиском, статистикой, связями с заметками и местами.
- Для кого: пользователи Obsidian (MVP: велосипедисты), которые ведут личный архив GPX/TCX/FIT/FIT.GZ.
- Ожидаемый результат: пользователь индексирует треки один раз по явному согласию и далее получает стабильный каталог, просмотр трека на карте, статистику, группировки, фильтры и привязку к place-заметкам/обычным заметкам без изменения исходных трек-файлов.

## 1.1. Иерархия документов
- `docs/REQUIREMENTS.md` — нормативный источник продуктовых требований v1.
- `docs/PRODUCT_SPEC_V1.md` — task-ready срез требований с acceptance criteria для постановки задач.
- `docs/TECHNICAL_DESIGN.md` — техническая реализация требований и инженерные gates.
- `docs/IMPLEMENTATION_PLAN.md` — порядок выполнения и milestone-level scope.
- `docs/CONCEPT.md` — исторический контекст; может содержать устаревшие идеи.

## 2. Объем MVP
### In scope
- Индексация всего vault по расширениям `.gpx`, `.tcx`, `.fit`, `.fit.gz` (case-insensitive), с exclude по умолчанию и пользовательскими exclude patterns.
- First-scan consent, фоновый/инкрементальный скан, статусы файлов, прогресс, пауза/возобновление, reset index.
- Открытие трек-файла в custom view: карта + статистика.
- Sidebar «Tracks»: группировки по дате (год-месяц-день), place, sport; сортировки и фильтры.
- Метрики v1: дата, distance, elapsed, avg/max speed, elevation gain/loss, HR/cadence/power (если есть), агрегаты км/часы по периоду + фильтр sport.
- Multi-segment/multi-track файлы: один файл = одна запись каталога; метрики агрегируются по всем сегментам, а список сегментов доступен в просмотре трека.
- Places как заметки с frontmatter (`trackdex-type: place`) и геометрией `point/circle/rectangle/polygon`; привязка трека по правилу “>=1 точка внутри”.
- Связь трек ↔ заметки через валидные Obsidian-ссылки (many-to-many).
- EN+RU UI, offline-first, legal/privacy disclosure про tile provider.
- Settings tab: units, excludes, default POI radius, indexing controls, legal/privacy блок.

### Out of scope
- Редактирование/склейка треков.
- Strava/Garmin sync.
- Moving time (v1.1+), activity charts/дашборды, heatmap.
- Визуальный редактор геометрии на карте, geocoding/place suggestions.
- Дедупликация треков (SHA-256), кастомные sport alias mappings.
- Сложные геометрии places (holes/multipolygon).
- UI-настройка tile provider (архитектурная готовность — в scope, UI — нет).
- Поддержка `.gpx.gz` и `.tcx.gz`.

## 3. Требования (каждое требование в шаблоне ниже)

### [REQ-001] First-scan consent и индексация vault
**User story**  
Как пользователь Obsidian, я хочу запускать первую индексацию осознанно и видеть её состояние, чтобы понимать, что происходит с моим vault и контролировать процесс.

**Acceptance criteria**
- [ ] При первом включении плагина индекс не стартует автоматически; показывается экран с объяснением и кнопкой запуска.
- [ ] После подтверждения выполняется полный рекурсивный scan всего vault по `.gpx/.tcx/.fit/.fit.gz` (case-insensitive).
- [ ] FIT/FIT.GZ остаются целевыми форматами v1, но требуют раннего parser feasibility gate: выбранная parser-библиотека должна собираться в bundle, работать на desktop/mobile Obsidian и не раздувать плагин неприемлемо.
- [ ] По умолчанию исключаются `.obsidian/` и `.trash/`; поддерживаются пользовательские exclude patterns (vault-relative, glob/ignore-like).
- [ ] После первого согласия автоскан включается на следующих запусках, пока пользователь не поставил паузу.
- [ ] Поддерживается инкрементальная индексация по событиям `create/modify/delete/rename`.
- [ ] Видна ненавязчивая панель прогресса; для больших файлов допустим статус `processing large file` без процента внутри файла.
- [ ] Если индексация была прервана отключением плагина, при следующем запуске показывается явный статус “индексация прервана” и действие “проверить и продолжить”.
- [ ] Команда “Reset/rebuild index” требует подтверждение, явно указывающее, что трек-файлы и заметки не изменяются.

**Priority**  
Must

**Constraints / Notes**
- Ограничения: не блокировать UI; read-only к трек-файлам.
- Assumptions: обработка “умеренного” потребления CPU/памяти проверяется профилированием, без жесткого SLA в v1.
- Dependencies: Obsidian vault events, local index storage.

---

### [REQ-002] Статусы индексации и ошибки
**User story**  
Как пользователь, я хочу видеть состояние каждого трека и причины ошибок, чтобы понимать полноту каталога и быстро диагностировать проблемы.

**Acceptance criteria**
- [ ] Для каждого трек-файла отображается один статус: `pending/indexing/indexed/stale/error`.
- [ ] Битый/непарсируемый файл остаётся в каталоге с иконкой ошибки и краткой причиной.
- [ ] Для ошибок доступна кнопка “показать детали” с технической диагностикой.
- [ ] Файлы с отсутствующими полями считаются `indexed`, а не `error`; отсутствие данных показывается явно.
- [ ] Логи индексации пишутся локально в plugin data dir (`.obsidian/plugins/trackdex-obsidian/logs/`) с ротацией `5 files x 1 MB`; автоматическая отправка логов отсутствует.

**Priority**  
Must

**Constraints / Notes**
- Ограничения: не вводить `partial` статус.
- Assumptions: параметры ротации логов фиксированы для v1 и не выносятся в настройки.
- Dependencies: logging subsystem, track parser error model.
- Sync policy: индекс и логи находятся внутри plugin data dir и могут синхронизироваться вместе с vault в зависимости от настроек пользователя; v1 не пытается автоматически исключать их из sync, но ограничивает размер логов ротацией и документирует это в README.

---

### [REQ-003] Открытие трека и layout desktop/mobile
**User story**  
Как пользователь, я хочу открывать трек из файлового менеджера и сразу видеть карту и ключевые метрики, чтобы быстро оценивать поездку.

**Acceptance criteria**
- [ ] Клик по файлу `.gpx/.tcx/.fit/.fit.gz` в explorer открывает custom track view.
- [ ] Desktop layout: карта слева, статистика справа.
- [ ] Mobile layout: вкладки “Map” и “Stats”.
- [ ] Для треков без геометрии карта недоступна и UI показывает явное сообщение.
- [ ] До индексации отображается имя файла; после индексации отображается title из файла + имя файла, если отличаются.
- [ ] Для multi-segment/multi-track файла в view отображается список сегментов/частей, если формат позволяет их выделить.

**Priority**  
Must

**Constraints / Notes**
- Ограничения: поведение должно быть максимально единым между desktop/mobile.
- Assumptions: допустимы документированные mobile-отличия при технических ограничениях.
- Dependencies: file extension registration, view renderer.

---

### [REQ-004] Sidebar каталог и фильтрация
**User story**  
Как пользователь, я хочу просматривать треки по группам и фильтрам, чтобы быстро находить нужные активности.

**Acceptance criteria**
- [ ] Sidebar “Tracks” поддерживает группировки: date, place, sport.
- [ ] Группировка date реализована деревом: year → month → day → tracks.
- [ ] Доступны сортировки: date, distance, duration; доступны фильтры: status/error, sport, place, date range.
- [ ] В строке трека отображаются: дата, дистанция, длительность, elevation, places, sport, статус индекса.
- [ ] Для отсутствующих полей показываются явные маркеры отсутствия данных (без fallback-значений).

**Priority**  
Must

**Constraints / Notes**
- Ограничения: треки без даты группируются в отдельную группу (“No date”).
- Assumptions: дополнительные сортировки/фильтры могут появиться позже, но минимальный набор выше обязателен для v1.
- Dependencies: indexed track fields, sidebar state model.

---

### [REQ-005] Карта и tile-провайдер
**User story**  
Как пользователь, я хочу видеть маршрут на карте даже при проблемах с сетью, чтобы плагин оставался полезным офлайн.

**Acceptance criteria**
- [ ] В track view отображается polyline маршрута и автоматический zoom к bbox.
- [ ] По умолчанию используется online raster tiles (OSM или совместимый провайдер).
- [ ] При недоступности сети/тайлов карта остаётся рабочей без подложки и показывает ненавязчивое уведомление о причине.
- [ ] В UI всегда отображается корректный attribution tile provider.
- [ ] В settings и EN README явно указано, что загрузка tiles создаёт сетевые запросы к tile provider.

**Priority**  
Must

**Constraints / Notes**
- Ограничения: кэш тайлов и UI-переключатель/редактор tile provider не входят в v1.
- Assumptions: в v1 используется hardcoded default provider; архитектура map-layer позволяет заменить провайдера в будущих версиях.
- Dependencies: map rendering library, tile service availability.

---

### [REQ-006] Метрики трека и агрегаты
**User story**  
Как пользователь, я хочу видеть согласованные метрики по треку и периоду, чтобы анализировать тренировки.

**Acceptance criteria**
- [ ] Track date определяется как timestamp первой точки (GPX) / StartTime (TCX/FIT-эквивалент).
- [ ] Elapsed time = разница между timestamp последней и первой точки.
- [ ] Distance v1 = сумма расстояний между соседними точками без фильтра GPS-скачков.
- [ ] Avg speed v1 = distance / elapsed, если elapsed > 0; max speed отображается при наличии в файле или если его можно детерминированно рассчитать по точкам.
- [ ] Elevation gain/loss считается по детерминированному алгоритму с порогом 3m (только |Δh| >= 3m).
- [ ] HR/cadence/power отображаются только если данные присутствуют.
- [ ] Агрегаты км и часов доступны для month/year/custom range и фильтруются по sport.
- [ ] При отсутствии поля UI показывает “нет данных”, не подставляя guessed values.
- [ ] В UI v1 отображается один основной источник метрик: computed metrics, рассчитанные Trackdex; file-provided summary metrics не показываются в v1.
- [ ] Для multi-segment/multi-track файла метрики агрегируются в одну запись каталога по всем сегментам.

**Priority**  
Must

**Constraints / Notes**
- Ограничения: moving time не показывается в v1.
- Assumptions: file-provided summary metrics могут сохраняться для диагностики/будущих версий, но не участвуют в отображении v1.
- Dependencies: parser normalization layer, metric computation module.

---

### [REQ-007] Timezone-обработка
**User story**  
Как пользователь, я хочу корректное локальное время треков, чтобы даты/часы соответствовали моей текущей timezone.

**Acceptance criteria**
- [ ] Для timestamp с явным offset хранится исходное значение и нормализованный UTC.
- [ ] Для timestamp без offset время интерпретируется как локальное на момент индексации; сохраняются исходная строка и offset индексации.
- [ ] UI показывает время в текущей локальной timezone пользователя.
- [ ] UI показывает источник timezone/offset для прозрачности.
- [ ] Смена timezone пользователя меняет отображение времени без модификации исходных данных трека.

**Priority**  
Must

**Constraints / Notes**
- Ограничения: ручной override timezone для уже проиндексированных треков не входит в v1.
- Assumptions: timezone source хранится как enum (`explicit/indexing_local/unknown`).
- Dependencies: date-time normalization/storage schema.

---

### [REQ-008] Places и привязка треков к местам
**User story**  
Как пользователь, я хочу отмечать места обычными заметками и автоматически связывать с ними треки, чтобы вести контекст поездок в Obsidian-native стиле.

**Acceptance criteria**
- [ ] Place определяется заметкой с frontmatter `trackdex-type: place` и `trackdex-geometry`.
- [ ] Поддерживаются геометрии `point/circle/rectangle/polygon` (polygon: одно внешнее кольцо); формат geometry соответствует нормативному YAML в `docs/REQUIREMENTS.md`.
- [ ] Трек считается относящимся к place, если >=1 точка трека попадает в геометрию.
- [ ] Есть команды “Сделать текущую заметку place” и “Редактировать geometry текущего place”.
- [ ] Изменение place-note инициирует debounced переиндексацию привязок.
- [ ] При удалении `trackdex-type: place` заметка исключается из индекса places, привязки удаляются.
- [ ] Невалидная geometry/YAML помечается как ошибочный place и не участвует в привязке.
- [ ] Places можно сортировать по дате последнего визита.

**Priority**  
Must

**Constraints / Notes**
- Ограничения: пересечение сегмента с геометрией — не обязательный алгоритм v1.
- Assumptions: default `radius_m` для point/circle берётся из settings.
- Dependencies: markdown/frontmatter parser, geometry engine.

---

### [REQ-009] Связь трек ↔ заметки (wikilinks)
**User story**  
Как пользователь, я хочу связывать треки с заметками стандартными ссылками Obsidian, чтобы не менять свой текущий workflow.

**Acceptance criteria**
- [ ] Поддерживается many-to-many: несколько заметок на трек и наоборот.
- [ ] Индексируются ссылки на трек-файлы во всех валидных Obsidian-формах (wikilink/markdown-link/alias/embed/path variants).
- [ ] Переиндексация ссылок выполняется при изменении `.md` заметок.
- [ ] В UI трека отображается список связанных заметок.
- [ ] Разрешение неоднозначных ссылок соответствует native Obsidian resolution.
- [ ] Трек-файлы не изменяются плагином.

**Priority**  
Must

**Constraints / Notes**
- Ограничения: только локальные markdown-источники в vault.
- Assumptions: отображается путь/заголовок заметки как идентификатор связи.
- Dependencies: Obsidian metadata/link resolution APIs.

---

### [REQ-010] Вид спорта (sport normalization)
**User story**  
Как пользователь, я хочу видеть тип активности по треку и фильтровать агрегаты, чтобы анализировать тренировки по дисциплинам.

**Acceptance criteria**
- [ ] Sport читается из метаданных GPX/TCX/FIT при наличии.
- [ ] Известные значения нормализуются в стандартные display labels + icons.
- [ ] Неизвестные значения показываются as-is с fallback icon.
- [ ] Если sport отсутствует, трек попадает в группу “No sport data”.
- [ ] Для multi-segment/multi-activity файла отображается список sport значений.

**Priority**  
Should

**Constraints / Notes**
- Ограничения: пользовательские mapping rules raw→display не обязательны в v1.
- Assumptions: минимальный встроенный словарь sport alias покрывает основные велосипедные типы.
- Dependencies: format parsers, i18n labels/icons.

---

### [REQ-011] Settings и команды управления
**User story**  
Как пользователь, я хочу управлять индексом и базовыми параметрами через настройки и команды, чтобы контролировать поведение плагина без ручного редактирования файлов.

**Acceptance criteria**
- [ ] В v1 присутствует settings tab.
- [ ] Настройки включают: units (metric/imperial), exclude patterns, default POI radius, pause/resume indexing, reset/rebuild index, legal/privacy info.
- [ ] Команды Obsidian доступны: scan/resume, reindex places, make note a place, edit place geometry, pause indexing, reset/rebuild.
- [ ] Все опасные действия (reset index) требуют явного подтверждения.
- [ ] После изменения настроек новое поведение применяется без перезапуска (где технически возможно).

**Priority**  
Must

**Constraints / Notes**
- Ограничения: не добавлять настройки вне подтвержденного MVP.
- Assumptions: названия команд в UI могут быть локализованы EN/RU при стабильных command IDs.
- Dependencies: Obsidian settings/command APIs.

## 4. Нефункциональные требования
- Производительность:
  - Масштаб v1: тысячи треков и сотни МБ в vault.
  - Базовый benchmark-профиль v1: 2,000 треков (~500 MB), 10,000 markdown notes, 500 place notes.
  - Целевые инженерные пороги: initial desktop indexing <= 20 min; single-track incremental p95 <= 3 s; full place reindex <= 90 s; one-note link update p95 <= 500 ms; startup overhead without full scan <= 1.5 s.
  - Индексация выполняется батчами/throttling без заметного фриза UI.
  - Используется предрасчёт метрик и упрощённая геометрия в локальном индексе.
- Надежность/ошибки:
  - Индексация возобновляема после прерываний с явным UX-сигналом.
  - Битые файлы не ломают общий каталог, а маркируются ошибками.
  - Метрики детерминированы между пересчётами одного файла.
- Совместимость (desktop/mobile):
  - `isDesktopOnly: false`.
  - Mobile support крайне желательна для v1; целевое поведение desktop/mobile одинаковое.
  - Storage/mobile spike (**0.1-03**, evidence `docs/milestones/0.1/evidence/storage-spike.md`): **закрыт** — primary adapter **sql.js** + `index.sqlite`, `isDesktopOnly: false` подтверждён на desktop и Android; решение зафиксировано в `docs/TECHNICAL_DESIGN.md` §2.1 (**0.1-05**).
  - Mobile performance thresholds остаются инженерными ориентирами до FIT parser baseline; desktop thresholds — release gate для v1.
- Безопасность/приватность:
  - Offline-first; сеть в v1 только для tiles.
  - Без скрытой telemetry, без автосендов логов/данных vault.
  - Track files read-only; заметки меняются только по явному действию пользователя.
- UX/локализация:
  - EN + RU, язык UI следует языку Obsidian.
  - Прозрачные статусы индексации, отсутствующих данных и ограничений карты без сети.

## 5. Риски
- Риск: деградация производительности на mobile при больших vault.  
  Влияние: лаги UI, долгий scan, негативный UX.  
  Митигирование: батчинг, lazy loading, polyline simplification, профилирование на реальных коллекциях.
- Риск: неоднозначности multi-segment/multi-track файлов.  
  Влияние: неконсистентные агрегаты и непредсказуемый UI.  
  Митигирование: фиксированное правило “1 файл = 1 запись, агрегирование по сегментам”, добавить тестовый набор реальных файлов.
- Риск: внешняя зависимость от tile provider и сети.  
  Влияние: “пустая” карта у части пользователей.  
  Митигирование: graceful degradation без подложки, attribution/legal disclosure, подготовить fallback-провайдер на уровне архитектуры.
- Риск: конфликты с другими map-плагинами/рендерами.  
  Влияние: нестабильная отрисовка/перехват view.  
  Митигирование: namespace/изоляция view и CSS, smoke-тесты совместимости.
- Риск: рост размера индекс/логов в sync-сценариях.  
  Влияние: лишний sync-трафик и storage.  
  Митигирование: ротация логов, компактная схема индекса, документирование plugin data dir и sync-практик.
- Риск: FIT/FIT.GZ parser несовместим с mobile/bundle constraints.  
  Влияние: задержка parser milestone или пересмотр форматов v1.  
  Митигирование: ранний parser feasibility gate до полноценной реализации метрик.

## 6. Definition of Ready (чеклист)
- [x] Для каждого Must-требования есть измеримые acceptance criteria.
- [x] Указаны границы MVP (in/out of scope).
- [ ] Нет критичных неопределенностей.
- [x] Указаны зависимости и блокеры.
- [x] Понятно, что именно считать “готово”.

## Открытые пункты (если остались)
- ~~Критичный технический gate: storage adapter~~ — **закрыт (0.1-05):** sql.js + `index.sqlite`, `isDesktopOnly: false`; evidence `docs/milestones/0.1/evidence/storage-spike.md`.
- Критичный технический gate: подтвердить FIT/FIT.GZ parser на desktop/mobile Obsidian, включая bundle size и отсутствие недоступных runtime API; если gate не закрывается, явно пересмотреть форматный scope v1.
