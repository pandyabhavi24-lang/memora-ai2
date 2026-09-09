const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let pyProc = null;

function getPythonExecutable(rootDir) {
  const candidates = [
    path.join(rootDir, '.venv', 'Scripts', 'python.exe'),
    path.join(rootDir, '..', '.venv', 'Scripts', 'python.exe'),
    path.join(rootDir, '.venv', 'bin', 'python'),
    path.join(rootDir, '..', '.venv', 'bin', 'python')
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return 'py';
}

function startPythonBackend() {
  const rootDir = path.join(__dirname, '..');
  const pythonCmd = getPythonExecutable(rootDir);

  console.log(`[Electron] Spawning FastAPI backend using: ${pythonCmd}`);
  
  pyProc = spawn(pythonCmd, ['-m', 'uvicorn', 'backend.app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: rootDir
  });

  if (pyProc) {
    pyProc.stdout.on('data', (data) => {
      console.log(`[PyBackend]: ${data}`);
    });

    pyProc.stderr.on('data', (data) => {
      console.error(`[PyBackend Err]: ${data}`);
    });

    pyProc.on('close', (code) => {
      console.log(`[PyBackend] Exited with code ${code}`);
    });
  }
}

function stopPythonBackend() {
  if (pyProc) {
    console.log('[Electron] Killing Python backend child process...');
    pyProc.kill();
    pyProc = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 830,
    minWidth: 1024,
    minHeight: 700,
    frame: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0B0F19',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    icon: path.join(__dirname, '../public/icon.png')
  });

  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Electron] Failed to load ${validatedURL}: ${errorDescription} (${errorCode})`);
    if (isDev && errorCode !== -3) {
      setTimeout(() => {
        if (mainWindow) mainWindow.loadURL('http://localhost:3000');
      }, 1000);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Start Python FastAPI backend process automatically
  startPythonBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopPythonBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  stopPythonBackend();
});

// IPC Handlers - Native Folder Dialog & File Actions
ipcMain.handle('dialog:openDirectory', async () => {
  if (!mainWindow) return { canceled: true, filePaths: [] };
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'multiSelections']
  });
  return result;
});

ipcMain.handle('shell:openPath', async (event, filePath) => {
  if (!filePath) return false;
  const result = await shell.openPath(filePath);
  return result;
});

ipcMain.handle('shell:showItemInFolder', (event, filePath) => {
  if (!filePath) return;
  shell.showItemInFolder(filePath);
});
