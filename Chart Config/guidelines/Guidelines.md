# Правила для AI — Chart Console

> Полный контекст проекта: смотри `CLAUDE.md` в корне репозитория.

---

## Общие правила

- Использовать **flexbox / grid** для лейаутов; абсолютное позиционирование — только при необходимости
- Держать компоненты маленькими; хелперы выносить в отдельные файлы
- Не дублировать стейт — вычислять производные данные через `useMemo` или inline
- Не использовать `any` в TypeScript без явного комментария

---

## Дизайн-система

- Все цвета — через **CSS-переменные** из `src/styles/theme.css`; никогда не хардкодить hex/rgb
- Семантические токены: `--positive-bg-default` (зелёный), `--negative-bg-default` (красный), `--warning-bg-default` (жёлтый), `--accent-bg-default` (синий)
- Поверхности: `--surface-canvas`, `--surface-elevation-1/2/3`, `--card-bg-default`
- Суффиксы состояний: `-default`, `-hover`, `-active`, `-inactive`
- Tailwind — для spacing, typography, layout; токены — для цветов и теней

---

## Стейт и localStorage

- Весь глобальный стейт — в `App.tsx`; пропсы вниз
- localStorage — через `lsGet` / `lsSet` с ключами из объекта `STORAGE_KEYS`
- Новые ключи добавлять в `STORAGE_KEYS`, никогда не писать строки напрямую

---

## Графики

- Lightweight Charts и KLineChart используют `expandWithTpSl()` для TP/SL линий
- Advanced (TradingView) — нативные `IOrderLineAdapter`, `setExtendLeft(true)` для лейблов слева
- У каждого графика **свой независимый** список ценовых линий и ключ в localStorage
- В TV-коллбэках (`onMove`, `onCancel`) — доступ к свежему стейту через **рефы**

---

## Компоненты UI

- Компоненты из `src/app/components/ui/` — shadcn/Radix, не редактировать без причины
- Иконки — только `lucide-react`
- Анимации — `motion` (framer-motion)
