const { app, BrowserWindow } = require('electron');
const path = require('node:path');

let mainWindow;

async function openGame() {
  mainWindow = new BrowserWindow({
    title: 'Kidus Bingo',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#101819',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow.setFullScreen(true);
    mainWindow.show();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  await mainWindow.loadFile(path.join(__dirname, 'public', 'index.html'));
}

app.whenReady().then(openGame).catch(error => {
  console.error(error);
  app.quit();
});

app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (!mainWindow) openGame().catch(error => {
    console.error(error);
    app.quit();
  });
});