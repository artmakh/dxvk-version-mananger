const fs = require('fs');
const path = require('path');
const https = require('https');

// Global cache directory paths
let cacheDir;
let metadataDir;
let coverDir;

// Initialize cache directories with proper paths
function initCacheDirs(appDataPath) {
  // Use the proper app name for userData directory
  cacheDir = path.join(appDataPath, 'games-meta');
  metadataDir = path.join(cacheDir, 'metadata');
  coverDir = path.join(cacheDir, 'covers');
  
  console.log('Using cache directories:', {
    appDataPath,
    cacheDir,
    metadataDir,
    coverDir
  });
  
  // Create directories if they don't exist
  ensureCacheDirs();
}

// Create cache directories if they don't exist
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

// Make the saveMetadataToCache function available globally for DXVK manager
global.saveGameMetadata = (appId, metadata) => {
  return saveMetadataToCache(appId, metadata);
};

// Update game metadata with DXVK application info
async function updateGameMetadataWithDxvk(appId, dxvkInfo) {
  try {
    // First, load the existing metadata
    const metadata = loadMetadataFromCache(appId);
    
    if (!metadata) {
      throw new Error(`Metadata not found for game with appId ${appId}`);
    }
    
    // Update with DXVK information
    metadata.patched = dxvkInfo.patched || false;
    metadata.backuped = dxvkInfo.backuped || false;
    metadata.dxvk_version = dxvkInfo.dxvk_version || null;
    metadata.dxvk_type = dxvkInfo.dxvk_type || null;
    metadata.dxvk_timestamp = dxvkInfo.dxvk_timestamp || new Date().toISOString();
    
    // Save the updated metadata
    saveMetadataToCache(appId, metadata);
    
    return metadata;
  } catch (error) {
    console.error(`Error updating metadata with DXVK info for ${appId}:`, error);
    return null;
  }
}

// Get DXVK information for a game
function getDxvkInfoForGame(appId) {
  try {
    const metadata = loadMetadataFromCache(appId);
    
    if (!metadata) {
      return null;
    }
    
    return {
      patched: metadata.patched || false,
      backuped: metadata.backuped || false,
      dxvk_version: metadata.dxvk_version || null,
      dxvk_type: metadata.dxvk_type || null,
      dxvk_timestamp: metadata.dxvk_timestamp || null
    };
  } catch (error) {
    console.error(`Error getting DXVK info for game ${appId}:`, error);
    return null;
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

// Fetch game metadata from PCGamingWiki
async function fetchGameMetadata(appId, gameName, gameInstallDir = null) {
  try {
    console.log(`Fetching metadata from API for: ${gameName} (AppID: ${appId})`);
    
    // Use the cargo query API endpoint
    const apiUrl = `https://www.pcgamingwiki.com/w/api.php?action=cargoquery&tables=Infobox_game,API&fields=Infobox_game._pageName=Page,Infobox_game.Cover_URL,API.Direct3D_versions,API.Windows_32bit_executable,API.Windows_64bit_executable,API.Vulkan_versions&join_on=Infobox_game._pageID=API._pageID&where=Infobox_game.Steam_AppID%20HOLDS%20%22${appId}%22&format=json`;
    
    let apiResponse;
    try {
      apiResponse = await httpGet(apiUrl);
    } catch (error) {
      console.error('Error in API request:', error);
      return createDefaultMetadata(gameInstallDir);
    }
    
    const responseJson = JSON.parse(apiResponse);
    
    // Check if we have valid results
    if (!responseJson.cargoquery || responseJson.cargoquery.length === 0) {
      console.log(`No API results found for game: ${gameName} (AppID: ${appId})`);
      
      // Save default metadata to prevent repeated API calls for games not in the wiki
      const defaultData = createDefaultMetadata(gameInstallDir);
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
      vulkanVersions: gameData['Vulkan versions'] || null,
      installDir: gameInstallDir || null
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
    return createDefaultMetadata(gameInstallDir);
  }
}

function createDefaultMetadata(gameInstallDir = null) {
  return {
    pageName: '',
    coverUrl: '',
    direct3dVersions: 'Unknown',
    executable32bit: 'Unknown',
    executable64bit: 'Unknown',
    vulkanVersions: null,
    installDir: gameInstallDir || null
  };
}

// Function to find all Steam installed games
function findSteamGames() {
  const steamAppsPath = 'C:\\Program Files (x86)\\Steam\\steamapps';
  
  try {
    // Check if the directory exists
    if (!fs.existsSync(steamAppsPath)) {
      console.log('Steam directory not found at:', steamAppsPath);
      return [];
    }
    
    const files = fs.readdirSync(steamAppsPath);
    const acfFiles = files.filter(file => file.endsWith('.acf'));
    
    return acfFiles.map(acfFile => {
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
  } catch (error) {
    console.error('Error scanning Steam games:', error);
    return [];
  }
}

// Get game metadata (from cache or API)
async function getGameMetadata(appId, gameName, gameInstallDir = null) {
  // Check if metadata and cover exist in cache
  if (checkMetadataCache(appId)) {
    // Both metadata and cover exist in cache, load from cache
    const metadata = loadMetadataFromCache(appId);
    
    // Update the installation directory if provided and it's different from cached
    if (gameInstallDir && metadata.installDir !== gameInstallDir) {
      console.log(`Updating installation directory for ${appId} from "${metadata.installDir}" to "${gameInstallDir}"`);
      metadata.installDir = gameInstallDir;
      saveMetadataToCache(appId, metadata);
    }
    
    return metadata;
  } else {
    // Either metadata or cover is missing, fetch from API
    return await fetchGameMetadata(appId, gameName, gameInstallDir);
  }
}

/**
 * Clean up metadata for games that no longer exist in Steam
 * @param {Array} installedGames Array of installed Steam game objects
 * @returns {Object} Result with count of deleted metadata files
 */
function cleanupUninstalledGamesMetadata(installedGames) {
  try {
    // Create a set of installed game IDs for faster lookups
    const installedGameIds = new Set(installedGames.map(game => game.appid));
    
    console.log(`Total installed game IDs: ${installedGameIds.size}`);
    
    // Read all metadata files in the metadata directory
    const metadataFiles = fs.readdirSync(metadataDir);
    
    // Filter to just the JSON files
    const jsonFiles = metadataFiles.filter(file => file.endsWith('.json'));
    
    console.log(`Found ${jsonFiles.length} metadata files`);
    
    // Track which games were removed
    const removedGames = [];
    
    // Check each metadata file to see if it belongs to an installed game
    for (const file of jsonFiles) {
      // Extract the app ID from the filename (removing the .json extension)
      const appId = file.replace('.json', '');
      
      // If the app ID is not in the set of installed games, delete the metadata and cover
      if (!installedGameIds.has(appId)) {
        console.log(`Game ${appId} not installed, removing metadata...`);
        
        // Delete metadata file
        const metadataPath = path.join(metadataDir, file);
        if (fs.existsSync(metadataPath)) {
          fs.unlinkSync(metadataPath);
          console.log(`Deleted metadata file: ${metadataPath}`);
        }
        
        // Delete cover file if it exists
        const coverPath = path.join(coverDir, `${appId}.jpg`);
        if (fs.existsSync(coverPath)) {
          fs.unlinkSync(coverPath);
          console.log(`Deleted cover file: ${coverPath}`);
        }
        
        removedGames.push(appId);
      }
    }
    
    console.log(`Cleaned up metadata for ${removedGames.length} uninstalled games`);
    
    return {
      success: true,
      deletedCount: removedGames.length,
      removedGames
    };
  } catch (error) {
    console.error('Error cleaning up uninstalled games metadata:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// Export functions
module.exports = {
  initCacheDirs,
  findSteamGames,
  getGameMetadata,
  updateGameMetadataWithDxvk,
  getDxvkInfoForGame,
  saveMetadataToCache,
  loadMetadataFromCache,
  cleanupUninstalledGamesMetadata
}; 