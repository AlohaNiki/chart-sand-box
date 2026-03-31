# CLAUDE.md — Chart Console

Этот файл содержит правила и контекст для AI-ассистента при работе с проектом.

---

## Обзор проекта

**Chart Console** — SPA для конфигурирования и визуализации уровней цен, активных позиций и истории сделок на крипто-графиках. Данные берутся с публичных Binance API (без API-ключа).

**Live demo:** [zerox-chart.gay](https://www.zerox-chart.gay)

---

## Стек

| Слой | Технология |
|---|---|
| Framework | React 18 + TypeScript |
| Сборка | Vite 6 |
| Стили | Tailwind CSS v4 + CSS custom properties |
| UI-примитивы | Radix UI / shadcn (в `src/app/components/ui/`) |
| Иконки | lucide-react |
| Анимации | motion (framer-motion) |
| DnD | react-dnd |
| Графики | Lightweight Charts v5, KLineChart v10, @shared/tradingview |
| Data | Binance REST + WebSocket (публичные endpoints) |

---

## Структура проекта

```
src/
├── app/
│   ├── App.tsx                      # Корневой компонент: весь глобальный стейт, сайдбар, роутинг режимов
│   └── components/
│       ├── chart-widget.tsx         # Lightweight Charts (режим "lightweight")
│       ├── klinechart-widget.tsx    # KLineChart (режим "klinechart")
│       ├── advanced-chart-widget.tsx# TradingView Charting Library (режим "advanced")
│       ├── supercharts-widget.tsx   # TradingView SuperCharts embed (режим "supercharts")
│       ├── price-line-editor.tsx    # Панель настроек ценовых линий в сайдбаре
│       ├── trade-chart-modal.tsx    # Полноэкранный модал исторической сделки
│       ├── trade-chart-widget.tsx   # График внутри trade-chart-modal
│       ├── order-detail-modal.tsx   # Попап деталей активного ордера
│       ├── changelog-panel.tsx      # История версий
│       └── ui/                      # shadcn/Radix компоненты (не редактировать без причины)
└── styles/
    ├── theme.css                    # Все CSS-токены дизайн-системы
    ├── index.css                    # Глобальные стили
    ├── tailwind.css                 # Tailwind entry point
    └── fonts.css                    # Импорт шрифтов
```

---

## Архитектурные паттерны

### Глобальный стейт — только в App.tsx
Весь разделяемый стейт живёт в `App.tsx`. Дочерние компоненты получают данные через пропсы. Не использовать Context/Zustand/Redux без явной необходимости.

### Три отдельных набора ценовых линий
Каждый режим графика имеет **независимые** список, стейт и localStorage-ключ:

```typescript
// App.tsx
const [lwPriceLines, setLwPriceLines]       = useState(...)  // Lightweight
const [klinePriceLines, setKlinePriceLines] = useState(...)  // KLineChart
const [advPriceLines, setAdvPriceLines]     = useState(...)  // Advanced (TV)

// Активный список по chartMode:
const activePriceLines =
  chartMode === "lightweight" ? lwPriceLines :
  chartMode === "klinechart"  ? klinePriceLines :
  advPriceLines;
```

Линии для разных графиков **не синхронизируются**. Это сделано намеренно — у каждого графика свой функционал.

### expandWithTpSl() — только для Lightweight и KLineChart
`expandWithTpSl()` виртуально разворачивает TP/SL дочерние линии из полей `takeProfit`/`stopLoss`. **Для Advanced Chart не используется** — там TP/SL управляются нативно через TV order lines.

### Стейл-замыкания в TV-коллбэках
В `advanced-chart-widget.tsx` коллбэки `onMove`/`onCancel` регистрируются при создании TV order line и не обновляются. Для доступа к свежему стейту используются рефы:
```typescript
const onPriceLineChangeRef = useRef(onPriceLineChange);
useEffect(() => { onPriceLineChangeRef.current = onPriceLineChange; }, [onPriceLineChange]);
```

### Клик по TV order line — через DOM + crosshair
У TradingView Charting Library нет нативного события клика на order line. Реализовано через:
1. Подписку на `crossHairMoved` → сохраняет последнюю цену под курсором в `lastCrosshairPriceRef`
2. DOM-клик на контейнере → находит ближайшую линию с порогом 0.8% от цены
3. Переключает `selectedLineId` → показывает/скрывает TP/SL этой линии

---

## PriceLineConfig — ключевой тип

```typescript
export interface PriceLineConfig {
  id: string;
  label: string;
  price: number;
  color: string;          // CSS-токен: "--positive-bg-default" (без var())
  labelColor: string;
  labelTextColor: string;
  lineWidth: number;
  lineStyle: number;      // 0 = solid, 1 = dotted, 2 = dashed
  visible: boolean;
  showPnl?: boolean;
  pnlText?: string;
  takeProfit?: number;
  stopLoss?: number;
}
```

Значения `color`, `labelColor`, `labelTextColor` — это **имена CSS-переменных без `var()`**, например `"--positive-bg-default"`. Фактическое значение получается через `getComputedStyle(document.documentElement).getPropertyValue(color)`.

---

## localStorage — актуальные ключи

Все ключи хранятся в объекте `STORAGE_KEYS` в `App.tsx`. Доступ через хелперы `lsGet(key)` / `lsSet(key, value)` (с try-catch).

| Ключ | Значение |
|---|---|
| `chartConfig_theme` | `"dark"` или `"light"` |
| `chartConfig_lw_priceLines` | JSON — ценовые линии Lightweight Charts |
| `chartConfig_kline_priceLines` | JSON — ценовые линии KLineChart |
| `chartConfig_adv_priceLines` | JSON — ценовые линии Advanced (TV) |
| `chartConfig_chartBg` | CSS-токен фона графика |
| `chartConfig_gridColor` | CSS-токен цвета сетки |
| `chartConfig_gridStyle` | Стиль сетки |
| `chartConfig_showGrid` | Boolean |
| `chartConfig_showOrders` | Boolean |
| `chartConfig_orders` | JSON — активные ордера |
| `chartConfig_currentPriceLine` | Boolean — показывать текущую цену |
| `chartConfig_crosshair` | Настройки crosshair |
| `chartConfig_sidebarTab` | `"lines"` или `"history"` |
| `chartConfig_chartMode` | `"lightweight"` / `"klinechart"` / `"advanced"` / `"supercharts"` |
| `chartConfig_historyOrders` | JSON — история сделок |

---

## Дизайн-система: CSS-токены

Все цвета — через CSS custom properties из `theme.css`. Никогда не хардкодить hex/rgb.

### Семантические цвета
```
--positive-bg-default       зелёный (прибыль, Buy, TP)
--negative-bg-default       красный (убыток, Sell, SL)
--warning-bg-default        жёлтый/золотой (ликвидация, предупреждения)
--accent-bg-default         синий (основные действия)
--contrast-primary          текст/иконки — максимальный контраст
--contrast-secondary        текст — средний контраст
--contrast-tertiary         текст — слабый контраст
```

### Суффиксы состояний
```
-bg-default   -bg-hover   -bg-active   -bg-inactive
-text-and-icons
-transparent
-over
```

### Поверхности
```
--surface-canvas            фон страницы
--surface-elevation-1/2/3   карточки, дропдауны, модалы
--card-bg-default           фон карточки
--input-bg-default          фон инпута
```

---

## Правила разработки

### Общие
- Предпочитать **flexbox и grid** вместо абсолютного позиционирования
- Держать компоненты **маленькими**; хелперы и утилиты выносить в отдельные файлы
- **Не хранить дублирующий стейт** — всё, что можно вычислить из существующего, вычислять на лету (`useMemo`, inline computation)
- При изменении коллбэков в TradingView — использовать **рефы**, не пересоздавать линии лишний раз

### Стили
- Использовать **Tailwind utility classes** для layout и spacing
- Цвета, тени, радиусы — только через **CSS-токены** (`var(--token-name)`)
- Никогда не писать inline `style={{ color: '#fff' }}` — использовать токены
- Классы компонентов ui/ не переопределять напрямую; адаптировать через пропсы или `className`

### TypeScript
- Строгая типизация — не использовать `any` без крайней нужды
- Экспортировать интерфейсы из файла, где они определены (например, `PriceLineConfig` из `chart-widget.tsx`)
- Для TV chart коллбэков типизировать параметры явно или приводить через `as any` с комментарием

### Работа с графиками
- **Lightweight Charts** — основной режим; API через `IChartApi` / `ISeriesApi`
- **KLineChart** — аналогичен по структуре; своя API-документация
- **Advanced (TradingView)** — использует `IOrderLineAdapter`; лейблы ставить через `setExtendLeft(true)` (слева); для draggable линий `setEditable(true)` + `onMove(cb)`, для кнопки отмены `setCancellable(true)` + `onCancel(cb)`
- **SuperCharts** — только iframe-embed, логика не трогается

### Сохранение в localStorage
- Всегда через `lsSet(STORAGE_KEYS.xxx, value)` — никогда не писать ключи строками напрямую
- Читать через `lsGet(STORAGE_KEYS.xxx)` с дефолтным значением
- Новые ключи добавлять в объект `STORAGE_KEYS` в `App.tsx`

---

## Внешние данные (Binance)

```
REST:      https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=500
WebSocket: wss://stream.binance.com:9443/ws/btcusdt@kline_1m
```

Символ по умолчанию: `BTCUSDT`. Интервалы: `1m`, `5m`, `15m`, `30m`, `1h`, `4h`, `1d`.

---

## Деплой

Проект задеплоен на Vercel. Конфиг — `vercel.json` в корне. Сборка: `npm run build` → `dist/`.

---

## Алиасы путей

```typescript
// vite.config.ts
"@"                  → "./src"
"@shared/tradingview" → "./packages/tradingview/build/charting_library.esm.js"
```
