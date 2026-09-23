# PWANova: аудит и проверка закрытой беты

Проверка: 22–23 сентября 2026. Исходный commit: `c3092fd`. Ветка: `codex/closed-beta-verification`. Это доработка существующей платформы, не workshop/business starter. Стек, основные маршруты и дизайн сохранены. Production на момент аудита не изменялся; выпуск состоялся позже и описан в `docs/production-release.md`.

## Что уже работало

В репозитории уже были каталог/поиск, Supabase Auth, форма подачи приложения, ratings/reviews/favorites, ответы разработчика, claim-файл, технический анализ URL, dashboard, очередь модерации, reports, публичный API, SVG/iframe badge и `/partners` с генератором. Они использовали реальные таблицы Supabase при наличии настроек. Без настроек включался вымышленный demo dataset. До изменений прошли **87/87** существующих тестов — они не покрывали найденные ниже обходы.

## Функции, проблемы и проверка

| Функция | Состояние | Найденная проблема | Приоритет | Способ проверки |
|---|---|---|---|---|
| Регистрация и вход | Сохранено, проверено локально | Не настроенные OAuth-кнопки выглядели рабочими; callback терял next при ошибке | P1 | Браузерная регистрация через локальное письмо, callback, reload; OAuth скрыт до явного включения |
| Публикация | Исправлено | Прямой INSERT позволял published; скрытое модератором приложение владелец мог открыть снова | P0 | SQL/API с пользовательскими токенами; обязательный pending; moderation_hidden защищён |
| Роли и служебные поля | Проверено и расширено | Недостаточно защищать только владельца строки | P0 | Прямые INSERT/UPDATE role, verified, developer_id, status; тесты разных пользователей |
| Claim start/restart | Исправлено | UPDATE токена не имел RLS-разрешения и молча не менял строку; отдельный UPDATE статуса создавал гонку | P0 | begin_app_claim с блокировкой строки, ротацией токена и общим лимитом |
| Claim finalization | Исправлено | RPC не сверял токен, пользователя, заявку, срок и URL; файл мог перенаправлять на другой origin | P0 | Неверный/истёкший токен, смена URL, повтор; реальные параллельные RPC: ровно один победитель |
| SSRF | Исправлено | IPv4-mapped IPv6 обходил фильтр; превышение лимита обрезало ответ вместо отказа | P0 | IPv4/IPv6, настоящий socket DNS lookup с приватными/смешанными ответами, redirect, byte cap, общий timeout |
| Внешние изображения | Исправлено | Изображения загружались напрямую с непроверенных URL | P1 | Общий SSRF fetch, ограниченный raster proxy, запрет SVG/HTML, nosniff |
| Ratings/reviews | Исправлено | Прямая запись rating оставляла старые звёзды review | P1 | Транзакционная проекция canonical rating в review; тесты изменения и независимого удаления |
| Самооценки | Расширено | Оценка, оставленная до получения владения, могла стать самооценкой | P1 | Историческая строка сохранена, но исключена из среднего и distribution |
| Developer Response | Исправлено | UPDATE мог перенести свой ответ на отзыв чужого приложения | P0 | Неизменяемые review_id/developer_id; прямой UPDATE отклоняется |
| Черновик отзыва | Исправлено | Непроверенный localStorage, отсутствие срока и привязки к пользователю | P1 | Валидация/24 часа/account binding; opaque recovery ID через auth; E2E восстановления |
| Собственный старый отзыв | Исправлено | Отзыв за пределами первых 50 результатов нельзя было нормально редактировать | P1 | Отдельное получение своего отзыва; модерационное скрытие обозначено для автора |
| Модерация | Исправлено | Проверка admin была косвенной; изменение и журнал раздельными; review удалялся физически | P0 | Авторизация + изменение + запись журнала в одном RPC; скрытие с причиной, сохранение rating |
| Технические статусы | Исправлено | HTTPS означал security_ok, HTML-эвристики — browser capabilities, общий Verified badge | P1 | Отдельное ownership; HTTP/HTTPS/manifest с методом, временем и основанием; остальное Unknown |
| Старые статусы | Безопасно преобразовано | Старые зелёные флаги оставались бы после обновления кода | P1 | Непроверенные capabilities перенесены в legacy evidence, публичные значения очищены |
| Canonical identity | Исправлено | UNIQUE(domain) запрещал разные приложения на одном origin | P1 | Origin + path; нормализация стандартного порта/конечного slash; unique index; неоднозначный domain API → 409 |
| Demo isolation | Исправлено | Отсутствие production credentials включало фиктивный каталог; прямые demo links оставались доступны | P0 | Отдельный production-mode тест, фильтры listings/direct pages/API/embeds/dashboard |
| Demo-партнёры | Исправлено | Seed с названиями реальных площадок мог давать официальную attribution | P1 | demo-* помечены is_demo и исключены из реальных partner lookups/метрик |
| Установка | Доработано | #install не открывал инструкцию; отсутствовал ясный fallback | P1 | E2E hash-link → dialog → внешний origin; тест исключает вызов prompt PWANova |
| Partner Kit | Расширен существующий | Потеря ref в iframe; нет измерений для участника партнёра | P1 | Генератор + ref, partner_members, приватные aggregate metrics на /partners |
| Public API/badge/embed | Исправлено | CDN мог ещё показывать suspended app | P0 | no-store; E2E suspend → немедленный 404 во всех четырёх каналах |
| Analytics | Исправлено | Фиксированные 14 дней; owner видел только собственные favorites; клиентские opens влияли на trusted rank | P1 | 7/30 дней, owner-scoped aggregate RPC, отдельные guidance/intents, opens исключены из trusted score |
| Referral | Проверено | Источник запуска и текущий referral могли смешиваться | P1 | Активный код из БД; неизвестный код не официальный; launch history не меняется; повтор события подавляется |
| Rate limiting | Усилено | Production мог откатываться к памяти одного процесса | P0 | Общий Postgres counter; fail closed; сериализация пользовательских insert quotas |
| Публичные формы | Усилено | Неограниченное чтение JSON у anonymous event API | P1 | Серверная схема, длины, bounded stream parsing, origin check, лимиты |
| PWA/logout | Проверено | Требовалось доказать отсутствие private caching и обновление версии | P1 | VM-тест fetch/activate: private routes не записываются, v1 caches удаляются; logout E2E |
| Мобильный UI | Проверено частично | Реальные телефоны недоступны | P1 | Chromium 375 px и уменьшенная высота, review focus, modal, overflow; физические устройства остаются manual gate |
| Пилот | Подготовлено | Реальных 10 приложений и 2 интеграций ещё нет | P1 | beta-pilot.md содержит цели, журнал отказов и неотправленные приглашения |

## Миграция и сохранность

Новая миграция: `supabase/migrations/20260922222344_closed_beta_integrity.sql`. Предыдущие миграции не изменены и не удалены.

Она добавляет защищённые метаданные ownership/moderation, URL-bound claims, nullable review rating, скрытие review, partner membership/demo flag, атомарные RPC и обновлённые агрегаты. Reviews и canonical ratings сохраняются; рассогласованные звёзды приводятся к canonical rating. Непроверенные старые технические флаги сохраняются в legacy evidence. Вместо UNIQUE(domain) используется уникальный canonical URL. При конфликте существующих identities миграция останавливается — приложения не сливаются и не удаляются. Небезопасная старая сигнатура claim RPC удалена: код и миграцию нужно выпускать согласованно.

`apps_public` намеренно выполняет публичные агрегаты с правами владельца: raw favorites/events закрыты RLS. Проекция полей явная, фильтр published обязателен. `developer_dashboard` также использует definer, но каждую выборку ограничивает `apps.developer_id = auth.uid()`; owner ID от клиента не принимает. Это позволяет правильно считать чужие сохранения своих приложений без открытия чужой аналитики.

## Выполненные проверки

| Проверка | Результат | Доказательство/границы |
|---|---|---|
| Исходный baseline | 87/87 | До изменений |
| Typecheck | PASS | `npm run typecheck` |
| Lint | PASS | `npm run lint` |
| Unit/SQL/integration | 111/111 | `npm test`; Node test runner, реальные migrations в PGlite |
| Чистая локальная база | PASS | `supabase db reset --local`; Docker PostgreSQL 17, отдельный проект и порты |
| Upgrade старой схемы с данными | PASS | `tests/upgrade.test.ts`: старые migrations + seed → новая; counts сохранены, ratings согласованы |
| Реальные Auth/PostgREST/Storage | 39/39 PASS | `npm run verify:supabase`; 39 проверок, разные пользовательские токены, настоящая конкурентная гонка claims |
| Браузерные E2E | 7/7 PASS | 7 сценариев `tests/e2e/beta.spec.ts`; реальные локальные Supabase данные и Auth; исходящий app-site — явно замоканный тестовый сайт |
| Production build | PASS | `npm run build`, сборка локальная, не deploy |
| Secret/diff review | PASS | Проверка только исходников/изменений; .env, browser traces и служебные отчёты не входят в Git |

Браузерные сценарии покрывают: guest discovery/open/install guidance; draft → sign-in → review/save/reload; owner response → review edit → rating removal → text removal → logout; submit → pending claim → отрицательная verification → admin approval; API/badge/embed/page revocation; узкий экран; новую регистрацию через **локальный почтовый перехватчик**; валидный/невалидный referral, дедупликацию и сохранение launch source. Созданные тестовые пользователи и приложения удаляются после прогона.

## Что НЕ проверено и оставшиеся блокеры

**Открытых воспроизводимых P0 после исправлений не осталось в проверенном локальном контуре.** Это не утверждение о полной безопасности production.

P1 — условия допуска к реальному пилоту:

1. Успешный well-known файл на **реальном публичном origin владельца**. Проверены file matching, ограничения fetch, отказы UI, атомарное назначение и гонка в настоящем Postgres; публичный сайт с размещением файла не предоставлен, а production deploy запрещён. Положительный браузерный claim на настоящем домене не заявляется выполненным.
2. Реальные iPhone/Android: установка выбранного приложения, standalone, safe areas, настоящая клавиатура и обновление service worker на устройстве.
3. Staging/production SMTP/OAuth, CDN-инвалидация старых объектов, cron и environment — требуют отдельно разрешённого окружения. Проверена локальная magic-link регистрация, не внешняя доставка писем и не OAuth провайдеры.
4. Согласованные 10 владельцев приложений и 2 launch boards; их внешние страницы и embed-интеграции ещё не проверялись. Приглашения подготовлены, не отправлены.

P2: ручные браузерные capability-checks с конкретным UA, расширение review pagination, дополнительные методы ownership и нагрузочные/длительные тесты. Они не маскируются зелёными статусами.

## Как воспроизвести и что нужно владельцу

Подробные команды и модель данных — в README. Локально: `npm ci`, `supabase start`, заполнить `.env.local` **локальными** ключами, затем `npm run dev`. Проверки: typecheck, lint, test, verify:supabase, test:e2e, build. API verifier и Playwright отказываются работать с удалённым Supabase URL.

Для Partner Kit: `/partners` → выбрать приложение → скопировать snippet. Проверить `/api/public/apps/by-domain?id=<id>`, `/api/badge/<slug>` и `/embed/app/<slug>?ref=<код>`. Для отсутствующих оценок — `rating:null` и View on PWANova. Для статистики администратор связывает согласившегося партнёра с пользователем через partner_members; неизвестный ref не создаёт такого доступа.

Перед production: review PR → backup и проверка конфликтов canonical URL → отдельно разрешённая staging migration → реальные проверки выше → явное разрешение на production migration/deploy. В этой задаче **не было production migration, deploy, merge в main, платных подключений, регистрации доменов или отправки приглашений**.
