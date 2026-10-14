# Mail.ru 2010 — Android Клиент (Android 1.6 – Android 16)

Официальный Android-клиент для исторического портала **Mail.ru 2010** (`http://soap.nekxd.fun/`).

Проект создан по классическому стандарту **Eclipse ADT (Android Development Tools)** с архитектурной поддержкой ретро-устройств, начиная с **Android 1.6 Donut (API Level 4)**, и вплоть до актуальных версий **Android 14, 15 и 16 (API 34–36)**.

---

## 📱 Особенности и совместимость

- **Поддержка Android 1.6 (API 4)**:
  - `minSdkVersion="4"`, чистый синтаксис Java 5/6, разметка с `fill_parent` (для экранов QVGA, HVGA, WVGA).
  - Безопасная инициализация настроек `WebView` через `WebHelper` (отсутствие крашей `NoSuchMethodError` на старых версиях).
  - Обход ошибки устаревших корневых SSL-сертификатов на Android 1.6–2.3 (`onReceivedSslError -> handler.proceed()`), позволяющий загружать защищённые ресурсы на ретро-устройствах без белого экрана.
  - Обработка аппаратной кнопки «Назад» (`KeyEvent.KEYCODE_BACK`) и кнопки «Меню».

- **Поддержка современных систем (Android 9 – Android 16)**:
  - `targetSdkVersion="34"`, `android:exported="true"` для Android 12+.
  - Разрешён незашифрованный HTTP-трафик (`android:usesCleartextTraffic="true"` и `network_security_config.xml`), необходимый для ретро-ресурсов.
  - Автоматическая адаптация под современные экраны высокой плотности (xhdpi, xxhdpi), аппаратное ускорение рендеринга.

- **Интерфейс в аутентичном стиле Mail.ru 2010**:
  - Фирменная тёмно-синяя верхняя панель (`#00468c`) с логотипом Mail.ru `@`.
  - Кнопки навигации: «Назад» (`<`), «Вперёд» (`>`), «Обновить» (`⟳`), «Переключение ПК / Мобильная версия» (`ПК` / `Моб`).
  - Тонкий индикатор загрузки страницы в стиле Mail.ru.
  - Адаптивный экран при отсутствии сети с кнопкой «Повторить попытку».
  - Меню приложения (доступное по аппаратной кнопке MENU или трем точкам): «Главная», «Полная версия», «Почта», «Поиск», «О программе», «Выход».

---

## 🛠 Сборка и запуск через Eclipse ADT

Проект готов к импорту в любую версию Eclipse с плагином Android ADT (Eclipse Galileo, Helios, Indigo, Juno, Kepler):

1. Запустите **Eclipse** с установленным плагином ADT и Android SDK.
2. Выберите в верхнем меню: **File** &rarr; **Import...**
3. Выберите **General** &rarr; **Existing Projects into Workspace** (или **Android** &rarr; **Existing Android Code Into Workspace**) и нажмите **Next**.
4. В поле **Select root directory** укажите путь к папке `android/` из этого репозитория.
5. Убедитесь, что проект `MailRu2010` отмечен галочкой, и нажмите **Finish**.
6. Для сборки и запуска на эмуляторе или реальном устройстве:
   - Кликните правой кнопкой мыши по проекту &rarr; **Run As** &rarr; **Android Application**.

---

## ⚙ Сборка через консоль (Apache Ant)

Если у вас установлен Android SDK и Apache Ant:

```bash
cd android
android update project -p . -t android-14
ant debug
```

Собранный файл будет находиться в `bin/MailRu2010-debug.apk`.

---

## 🚀 Сборка через Gradle / Android Studio

В проект также добавлены конфигурационные файлы `build.gradle` и `settings.gradle`, сопоставленные со структурой папок Eclipse ADT:

- **Android Studio**: просто откройте папку `android/` через **File** &rarr; **Open...**.
- **Gradle CLI**:
  ```bash
  gradle assembleDebug
  ```
  APK появится в `build/outputs/apk/debug/`.

---

## 📂 Структура проекта

```text
android/
├── .project                   # Дескриптор проекта Eclipse
├── .classpath                 # Пути сборки Eclipse ADT
├── project.properties         # Конфигурация SDK для ADT
├── default.properties         # Совместимость с ранними версиями ADT
├── build.xml                  # Скрипт сборки Ant
├── AndroidManifest.xml        # Манифест приложения (minSdk=4, targetSdk=34)
├── build.gradle               # Gradle скрипт для Android Studio / CLI
├── settings.gradle
├── res/                       # Ресурсы приложения
│   ├── drawable/              # Иконки и фоны кнопок
│   ├── drawable-ldpi/         # Иконка 36x36 (Android 1.6 Donut)
│   ├── drawable-mdpi/         # Иконка 48x48
│   ├── drawable-hdpi/         # Иконка 72x72
│   ├── drawable-xhdpi/        # Иконка 96x96
│   ├── drawable-xxhdpi/       # Иконка 144x144
│   ├── layout/                # Разметка экрана и диалогов
│   ├── menu/                  # Меню параметров
│   ├── values/                # Строки, цвета, стили
│   └── xml/                   # network_security_config.xml
└── src/
    └── ru/mail/client2010/
        ├── Constants.java     # Ссылки и константы портала
        ├── WebHelper.java     # Кросс-версионная настройка WebSettings
        └── MainActivity.java  # Главная активность приложения
```
