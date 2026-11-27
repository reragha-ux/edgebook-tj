# Sample broker exports (fake data)

Made-up trades in the column layouts of each broker's CSV export, for checking **Settings → Import**.
Built from the known export layouts, not from real account exports.

| File | Expected result |
| --- | --- |
| interactive-brokers.csv | 3 trades: AAPL +$228.00, TSLA short +$173.00, MSFT (scale-in) −$163.00 |
| thinkorswim.csv | 2 trades: NVDA +$370.00, AMD short −$70.00 (title line above the header is skipped) |
| tradovate.csv | 2 futures trades: MNQZ6 +$47.92, ESZ6 short −$179.20 |
| metatrader4.csv | 2 trades: EURUSD +$126.50, GBPUSD short −$128.20; the balance row is skipped |
| metatrader5.csv | same 2 trades as MetaTrader 4 |
| generic-executions.csv | 2 trades: SPY +$94.00, QQQ short −$45.60 |
| generic-trades.csv | 2 trades: META +$129.00, AMZN short −$33.00 |
