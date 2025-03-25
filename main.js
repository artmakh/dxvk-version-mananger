const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const querystring = require('querystring');
const gameMetadata = require('./games-metadata');
const dxvkVersions = require('./dxvk-versions');
const dxvkGplasync = require('./dxvk-gplasync');
const dxvkManager = require('./dxvk-manager');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Keep a global reference of the window object to prevent it from being garbage collected
let mainWindow;
let steamGames = [];

// Global cache directory paths
let cacheDir;
let metadataDir;
let coverDir;

// Function to initialize cache directories with proper paths - call only once at startup
function initCacheDirs() {
  // Use the proper app name for userData directory
  cacheDir = path.join(app.getPath('userData'), 'games-cache');
  metadataDir = path.join(cacheDir, 'metadata');
  coverDir = path.join(cacheDir, 'covers');
  
  console.log('Using cache directories:', {
    appDataPath: app.getPath('userData'),
    cacheDir,
    metadataDir,
    coverDir
  });
  
  // Create directories if they don't exist
  ensureCacheDirs();
}

// Create cache directories if they don't exist - call only once after initCacheDirs
function ensureCacheDirs() {
  try {
    // Create each directory if it doesn't exist
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
      console.log(`Created directory: ${cacheDir}`);
    }
    
    if (!fs.existsSync(metadataDir)) {
      fs.mkdirSync(metadataDir, { recursive: true });
      console.log(`Created directory: ${metadataDir}`);
    }
    
    if (!fs.existsSync(coverDir)) {
      fs.mkdirSync(coverDir, { recursive: true });
      console.log(`Created directory: ${coverDir}`);
    }
    
    console.log('Cache directories ensured');
  } catch (error) {
    console.error('Error creating cache directories:', error);
  }
}

// Check if both metadata and cover exist in cache
function checkMetadataCache(appId) {
  const metadataPath = path.join(metadataDir, `${appId}.json`);
  const coverPath = path.join(coverDir, `${appId}.jpg`);
  
  const metadataExists = fs.existsSync(metadataPath);
  const coverExists = fs.existsSync(coverPath);
  
  console.log(`Checking cache for ${appId}: metadata=${metadataExists}, cover=${coverExists}`);
  
  // Return true only if both metadata and cover exist
  return metadataExists && coverExists;
}

// Load metadata from cache
function loadMetadataFromCache(appId) {
  const metadataPath = path.join(metadataDir, `${appId}.json`);
  
  try {
    const data = fs.readFileSync(metadataPath, 'utf8');
    const metadata = JSON.parse(data);
    
    // Add the local cover path
    const coverPath = path.join(coverDir, `${appId}.jpg`);
    if (fs.existsSync(coverPath)) {
      metadata.localCoverPath = `file://${coverPath.replace(/\\/g, '/')}`;
    }
    
    console.log(`Loaded metadata from cache for ${appId}`);
    return metadata;
  } catch (error) {
    console.error(`Error loading cached metadata for ${appId}:`, error);
    return null;
  }
}

// Save metadata to cache
function saveMetadataToCache(appId, metadata) {
  try {
    const metadataPath = path.join(metadataDir, `${appId}.json`);
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`Saved metadata for ${appId}`);
  } catch (error) {
    console.error(`Error saving metadata for ${appId}:`, error);
  }
}

// Download and save cover image
async function downloadCover(appId, coverUrl) {
  if (!coverUrl) return false;
  
  try {
    const coverPath = path.join(coverDir, `${appId}.jpg`);
    
    // Check if cover already exists in cache
    if (fs.existsSync(coverPath)) {
      console.log(`Cover image for ${appId} already exists`);
      return true;
    }
    
    return new Promise((resolve, reject) => {
      https.get(coverUrl, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download cover: ${response.statusCode}`));
          return;
        }
        
        const file = fs.createWriteStream(coverPath);
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          console.log(`Downloaded cover for ${appId}`);
          resolve(true);
        });
        
        file.on('error', (err) => {
          fs.unlink(coverPath, () => {}); // Delete the file async
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  } catch (error) {
    console.error(`Error downloading cover for ${appId}:`, error);
    return false;
  }
}

// Function to find all Steam installed games
function findSteamGames() {
  return new Promise((resolve, reject) => {
    const steamAppsPath = 'C:\\Program Files (x86)\\Steam\\steamapps';
    
    try {
      // Check if the directory exists
      if (!fs.existsSync(steamAppsPath)) {
        console.log('Steam directory not found at:', steamAppsPath);
        resolve([]);
        return;
      }
      
      const files = fs.readdirSync(steamAppsPath);
      const acfFiles = files.filter(file => file.endsWith('.acf'));
      
      const games = acfFiles.map(acfFile => {
        const filePath = path.join(steamAppsPath, acfFile);
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Extract appid, name, and installdir using regex
        const appidMatch = content.match(/"appid"\s*"(\d+)"/);
        const nameMatch = content.match(/"name"\s*"([^"]*)"/);
        const installdirMatch = content.match(/"installdir"\s*"([^"]*)"/);
        
        if (appidMatch && nameMatch && installdirMatch) {
          return {
            appid: appidMatch[1],
            name: nameMatch[1],
            installdir: installdirMatch[1],
            path: path.join(steamAppsPath, 'common', installdirMatch[1])
          };
        }
        return null;
      }).filter(game => game !== null);
      
      resolve(games);
    } catch (error) {
      console.error('Error scanning Steam games:', error);
      reject(error);
    }
  });
}

// Make an HTTP request and return a promise with the response data
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { resolve(data); });
    }).on('error', (err) => { reject(err); });
  });
}

// Function to fetch game metadata from PCGamingWiki
async function fetchGameMetadata(appId, gameName) {
  try {
    console.log(`Fetching metadata from API for: ${gameName} (AppID: ${appId})`);
    
    // Use the cargo query API endpoint
    const apiUrl = `https://www.pcgamingwiki.com/w/api.php?action=cargoquery&tables=Infobox_game,API&fields=Infobox_game._pageName=Page,Infobox_game.Cover_URL,API.Direct3D_versions,API.Windows_32bit_executable,API.Windows_64bit_executable,API.Vulkan_versions&join_on=Infobox_game._pageID=API._pageID&where=Infobox_game.Steam_AppID%20HOLDS%20%22${appId}%22&format=json`;
    
    let apiResponse;
    try {
      apiResponse = await httpGet(apiUrl);
    } catch (error) {
      console.error('Error in API request:', error);
      return createDefaultMetadata();
    }
    
    const responseJson = JSON.parse(apiResponse);
    
    // Check if we have valid results
    if (!responseJson.cargoquery || responseJson.cargoquery.length === 0) {
      console.log(`No API results found for game: ${gameName} (AppID: ${appId})`);
      
      // Save default metadata to prevent repeated API calls for games not in the wiki
      const defaultData = createDefaultMetadata();
      saveMetadataToCache(appId, defaultData);
      return defaultData;
    }
    
    const gameData = responseJson.cargoquery[0].title;
    
    const metadata = {
      pageName: gameData.Page || '',
      coverUrl: gameData['Cover URL'] || '',
      direct3dVersions: gameData['Direct3D versions'] || 'Unknown',
      executable32bit: gameData['Windows 32bit executable'] || 'Unknown',
      executable64bit: gameData['Windows 64bit executable'] || 'Unknown',
      vulkanVersions: gameData['Vulkan versions'] || null
    };
    
    console.log(`Received metadata for ${metadata.pageName}`);
    
    // Cache the metadata
    saveMetadataToCache(appId, metadata);
    
    // Download the cover image
    if (metadata.coverUrl) {
      const success = await downloadCover(appId, metadata.coverUrl);
      if (success) {
        const coverPath = path.join(coverDir, `${appId}.jpg`);
        metadata.localCoverPath = `file://${coverPath.replace(/\\/g, '/')}`;
      }
    }
    
    return metadata;
  } catch (error) {
    console.error('Error fetching game metadata:', error);
    return createDefaultMetadata();
  }
  
  function createDefaultMetadata() {
    return {
      pageName: '',
      coverUrl: '',
      direct3dVersions: 'Unknown',
      executable32bit: 'Unknown',
      executable64bit: 'Unknown',
      vulkanVersions: null
    };
  }
}

function createWindow() {
  // Initialize game metadata with app's user data path
  gameMetadata.initCacheDirs(app.getPath('userData'));
  
  // Initialize DXVK cache - use the correct function name
  dxvkVersions.initDxvkCacheDir(app.getPath('userData'));
  
  // Initialize DXVK-gplasync cache - use the correct function name
  dxvkGplasync.initGplasyncCacheDir(app.getPath('userData'));

  // Scan for Steam games
  findSteamGames().then((games) => {
    steamGames = games;
    console.log(`Found ${games.length} Steam games`);
    
    // After loading the Steam games, clean up metadata for uninstalled games
    const cleanupResult = gameMetadata.cleanupUninstalledGamesMetadata(games);
    if (cleanupResult.success) {
      console.log(`Metadata cleanup: removed ${cleanupResult.deletedCount} entries for uninstalled games`);
    } else {
      console.error('Failed to clean up metadata:', cleanupResult.error);
    }
  }).catch((error) => {
    console.error('Error finding Steam games:', error);
  });

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Load the index.html of the app
  mainWindow.loadFile('index.html');

  // Open the DevTools for debugging (comment out in production)
  // mainWindow.webContents.openDevTools();

  // Emitted when the window is closed
  mainWindow.on('closed', function () {
    // Dereference the window object
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  console.log('Application is ready. Setting up...');
  
  // Initialize and ensure cache directories exist - only once at startup
  gameMetadata.initCacheDirs(app.getPath('userData'));
  
  // Initialize DXVK cache directory - only once at startup
  dxvkVersions.initDxvkCacheDir(app.getPath('userData'));
  
  // Initialize DXVK-gplasync cache directory - only once at startup
  dxvkGplasync.initGplasyncCacheDir(app.getPath('userData'));
  
  // Then create the window
  createWindow();
}).catch(error => {
  console.error('Error during app startup:', error);
});

// Quit when all windows are closed
app.on('window-all-closed', function () {
  app.quit();
});

// Handle app activation
app.on('activate', function () {
  // On macOS, re-create a window when the dock icon is clicked and no other windows are open
  if (mainWindow === null) {
    createWindow();
  }
});

// IPC handlers for communication with renderer process
ipcMain.handle('get-steam-games', () => {
  console.log('get-steam-games IPC handler called');
  return steamGames;
});

// IPC handler to fetch game metadata
ipcMain.handle('get-game-metadata', async (event, appId) => {
  console.log(`Fetching metadata for game with appId: ${appId}`);
  try {
    // Find the game to get its name
    const game = steamGames.find(g => g.appid === appId);
    if (!game) {
      throw new Error(`Game with appId ${appId} not found`);
    }
    
    // Get the full installation path
    const installDir = path.join('C:\\Program Files (x86)\\Steam\\steamapps\\common', game.installdir);
    console.log(`Installation directory for ${game.name}: ${installDir}`);
    
    // Get metadata (either from cache or API)
    const metadata = await gameMetadata.getGameMetadata(appId, game.name, installDir);
    
    return metadata;
  } catch (error) {
    console.error('Error in get-game-metadata handler:', error);
    return {
      pageName: '',
      coverUrl: '',
      direct3dVersions: 'Unknown',
      executable32bit: 'Unknown',
      executable64bit: 'Unknown',
      vulkanVersions: null,
      installDir: null
    };
  }
});

// IPC handler to fetch DXVK releases
ipcMain.handle('get-dxvk-releases', async () => {
  console.log('get-dxvk-releases IPC handler called');
  try {
    const releases = await dxvkVersions.fetchDxvkReleases();
    console.log(`Fetched ${releases.length} DXVK releases`);
    return releases;
  } catch (error) {
    console.error('Error in get-dxvk-releases handler:', error);
    return [];
  }
});

// IPC handler to download a DXVK version
ipcMain.handle('download-dxvk-version', async (event, version, downloadUrl) => {
  console.log(`download-dxvk-version IPC handler called for version ${version}`);
  try {
    const success = await dxvkVersions.downloadDxvkVersion(version, downloadUrl);
    return success;
  } catch (error) {
    console.error(`Error in download-dxvk-version handler for ${version}:`, error);
    return false;
  }
});

// IPC handler to fetch DXVK-gplasync releases
ipcMain.handle('get-gplasync-releases', async () => {
  console.log('get-gplasync-releases IPC handler called');
  try {
    const releases = await dxvkGplasync.fetchGplasyncReleases();
    console.log(`Fetched ${releases.length} DXVK-gplasync releases`);
    return releases;
  } catch (error) {
    console.error('Error in get-gplasync-releases handler:', error);
    return [];
  }
});

// IPC handler to download a DXVK-gplasync version
ipcMain.handle('download-gplasync-version', async (event, version, downloadUrl) => {
  console.log(`download-gplasync-version IPC handler called for version ${version}`);
  try {
    const success = await dxvkGplasync.downloadGplasyncVersion(version, downloadUrl);
    return success;
  } catch (error) {
    console.error(`Error in download-gplasync-version handler for ${version}:`, error);
    return false;
  }
});

// IPC handler to get installed DXVK versions
ipcMain.handle('get-installed-dxvk-versions', async () => {
  console.log('get-installed-dxvk-versions IPC handler called');
  try {
    const versions = dxvkManager.getInstalledDxvkVersions(app.getPath('userData'));
    console.log(`Found ${versions.dxvk.length} DXVK versions and ${versions.dxvkGplasync.length} DXVK-gplasync versions`);
    return versions;
  } catch (error) {
    console.error('Error in get-installed-dxvk-versions handler:', error);
    return { dxvk: [], dxvkGplasync: [] };
  }
});

// IPC handler for applying DXVK to a game
ipcMain.handle('apply-dxvk-to-game', async (event, gameId, dxvkType, version) => {
  try {
    console.log(`apply-dxvk-to-game IPC handler called for game ${gameId}, dxvk version ${version}`);
    const game = steamGames.find(g => g.appid === gameId);
    if (!game) {
      return { success: false, message: `Game with ID ${gameId} not found` };
    }
    
    // Get the metadata for the game
    const metadata = await gameMetadata.getGameMetadata(gameId, game.name, game.path);
    
    // Get the appropriate cache directory
    let cacheDir = app.getPath('userData');
    
    // Apply DXVK to the game
    const result = await dxvkManager.applyDxvkToGame(game, metadata, dxvkType, version, cacheDir);
    
    return result;
  } catch (error) {
    console.error('Error applying DXVK to game:', error);
    return { success: false, message: `Error applying DXVK: ${error.message}` };
  }
});

// IPC handler for restoring original DLLs
ipcMain.handle('restore-original-dlls', async (event, gameId) => {
  try {
    console.log(`restore-original-dlls IPC handler called for game ${gameId}`);
    const game = steamGames.find(g => g.appid === gameId);
    if (!game) {
      return { success: false, message: `Game with ID ${gameId} not found` };
    }
    
    // Get the metadata for the game
    const metadata = await gameMetadata.getGameMetadata(gameId, game.name, game.path);
    
    // Restore original DLLs
    const result = await dxvkManager.restoreOriginalDlls(game, metadata);
    
    return result;
  } catch (error) {
    console.error('Error restoring original DLLs:', error);
    return { success: false, message: `Error restoring original DLLs: ${error.message}` };
  }
});

// IPC handler for checking backup existence
ipcMain.handle('check-backup-exists', async (event, gameDir) => {
  try {
    console.log(`check-backup-exists IPC handler called for directory ${gameDir}`);
    
    // Check if backup exists
    const exists = await dxvkManager.checkBackupExists(gameDir);
    console.log(`Backup exists for ${gameDir}: ${exists}`);
    
    return exists;
  } catch (error) {
    console.error('Error checking backup existence:', error);
    return false;
  }
});

// IPC handler for removing DXVK without backup
ipcMain.handle('remove-dxvk-from-game', async (event, gameId) => {
  try {
    console.log(`remove-dxvk-from-game IPC handler called for game ${gameId}`);
    const game = steamGames.find(g => g.appid === gameId);
    if (!game) {
      return { success: false, message: `Game with ID ${gameId} not found` };
    }
    
    // Get the metadata for the game
    const metadata = await gameMetadata.getGameMetadata(gameId, game.name, game.path);
    
    // Remove DXVK DLLs without backup
    const result = await dxvkManager.removeDxvkFromGame(game, metadata);
    
    return result;
  } catch (error) {
    console.error('Error removing DXVK from game:', error);
    return { success: false, message: `Error removing DXVK DLLs: ${error.message}` };
  }
});

// IPC handler for getting DXVK status for a game
ipcMain.handle('get-game-dxvk-status', async (event, gameId) => {
  console.log(`get-game-dxvk-status IPC handler called for game ${gameId}`);
  try {
    const dxvkInfo = gameMetadata.getDxvkInfoForGame(gameId);
    
    if (dxvkInfo) {
      console.log(`DXVK status for game ${gameId}:`, dxvkInfo);
      return dxvkInfo;
    } else {
      return {
        patched: false,
        backuped: false,
        dxvk_version: null,
        dxvk_type: null,
        dxvk_timestamp: null
      };
    }
  } catch (error) {
    console.error(`Error in get-game-dxvk-status handler for ${gameId}:`, error);
    return {
      patched: false,
      backuped: false,
      dxvk_version: null,
      dxvk_type: null,
      dxvk_timestamp: null,
      error: error.message
    };
  }
});
