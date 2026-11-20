# Beteseb Bingo Offline

Beteseb Bingo is a single-PC house game. It runs without Wi-Fi, a server, Telegram, or an account. All game activity and settings stay in the browser storage on that computer.

## Play

1. Open the desktop app.
2. Select each cartela that was paid for and enter the buyer's name beside it.
3. Set the payment per cartela and the house commission. The displayed prize is the remaining amount after commission.
4. Select **Start calling** when entries are closed.
5. Numbers are drawn automatically every five seconds and the matching number voice clip plays. The operator can pause/resume calling or call the next number early. Matching numbers mark automatically on every cartela.
6. The first completed Bingo pattern ends the game immediately and displays the winning number, cartela, and recorded buyer. The house operator pays that person the displayed prize.

The app records calls, selected cartelas, and settings locally. It does not process or transfer money. Payments to the house and prize payouts are handled in person by the operator.

## Run and Build

```powershell
npm install
npm start
npm test
npm run dist:win
```

The portable Windows executable is produced under `dist/`. Build dependencies require internet access to download Electron once. The resulting desktop game itself does not require internet access.