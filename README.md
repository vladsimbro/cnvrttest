# CNVRT

Статический конвертер строк/UUID и генератор JSON «НГ».

## Публикация

GitHub Pages: https://vladsimbro.github.io/cnvrttest/

В Settings → Pages должен быть выбран источник **GitHub Actions**.
Workflow `.github/workflows/deploy.yml` публикует сайт при каждом push в `main`.
Сборка автоматически подставляет полный SHA коммита в ссылки на CSS и JavaScript
(`style.css?v=<SHA>`, `app.js?v=<SHA>`). Вручную обновлять эти параметры не нужно.
Исходники приложения, история и пользовательские настройки при сборке не изменяются.
Уже открытая страница получает новые файлы после обычной перезагрузки.

Локальная проверка сборки: `python3 tests/test_pages_build.py`.
