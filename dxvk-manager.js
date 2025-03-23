const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');

/**
 * Determine which DLL files are needed based on the Direct3D version
 * @param {string} directXVersion The Direct3D version string from metadata
 * @returns {Object} Object containing arrays of required DLLs
 */
function getDllsForDirectXVersion(directXVersion) {
  if (!directXVersion || directXVersion === 'Unknown') {
    // Default case if no DirectX version is provided
    return {
      requiredDlls: ['d3d9.dll', 'dxgi.dll', 'd3d11.dll'],
      description: 'Unknown (using common DLLs)'
    };
  }
  
  // Create a normalized lowercase version for comparison
  const normalizedVersion = directXVersion.toLowerCase();
  
  // Extract the primary version number (e.g., 9.0c -> 9, 11.4 -> 11)
  // Match any number at the start of a "Direct3D X" or "DX" or "D3D X" pattern
  let primaryVersion = null;
  
  // Try to extract version from various formats
  const versionPatterns = [
    /direct3d\s*(\d+)(?:\.\d+)?/i,  // Direct3D 11.0
    /d3d\s*(\d+)(?:\.\d+)?/i,       // D3D 9.0c
    /dx\s*(\d+)(?:\.\d+)?/i,        // DX 11
    /(\d+)(?:\.\d+)?/               // Just the number 9.0
  ];
  
  for (const pattern of versionPatterns) {
    const match = normalizedVersion.match(pattern);
    if (match && match[1]) {
      primaryVersion = parseInt(match[1], 10);
      break;
    }
  }
  
  console.log(`Normalized DirectX version: "${normalizedVersion}" -> Primary version: ${primaryVersion}`);
  
  // Initialize the result object
  const result = {
    requiredDlls: []
  };
  
  // Check for each possible Direct3D version based on the primary version number
  if (primaryVersion === 8 || normalizedVersion.includes('direct3d 8') || normalizedVersion.includes('d3d8')) {
    result.requiredDlls.push('d3d8.dll', 'd3d9.dll');
    result.description = 'Direct3D 8';
  } else if (primaryVersion === 9 || normalizedVersion.includes('direct3d 9') || normalizedVersion.includes('d3d9')) {
    result.requiredDlls.push('d3d9.dll');
    result.description = 'Direct3D 9';
  } else if (primaryVersion === 10 || normalizedVersion.includes('direct3d 10') || normalizedVersion.includes('d3d10')) {
    result.requiredDlls.push('dxgi.dll', 'd3d11.dll', 'd3d10core.dll');
    result.description = 'Direct3D 10';
  } else if (primaryVersion === 11 || normalizedVersion.includes('direct3d 11') || normalizedVersion.includes('d3d11')) {
    result.requiredDlls.push('dxgi.dll', 'd3d11.dll');
    result.description = 'Direct3D 11';
  } else if (primaryVersion === 12 || normalizedVersion.includes('direct3d 12') || normalizedVersion.includes('d3d12')) {
    // D3D12 doesn't use DXVK but we'll include it for completeness
    result.requiredDlls.push('dxgi.dll', 'd3d12.dll');
    result.description = 'Direct3D 12 (may not work with DXVK)';
  } else {
    // Default case if we can't determine the DirectX version
    result.requiredDlls = ['d3d9.dll', 'dxgi.dll', 'd3d11.dll'];
    result.description = 'Unknown (using common DLLs)';
  }
  
  return result;
}

/**
 * Get the architecture subfolder based on executable bitness
 * @param {Object} metadata Game metadata
 * @returns {string} Subfolder path (x64 or x32)
 */
function getArchSubfolder(metadata) {
  if (metadata.executable64bit === 'true') {
    return 'x64';
  } else if (metadata.executable32bit === 'true') {
    return 'x32';
  } else {
    // Default to x64 if unknown
    return 'x64';
  }
}

/**
 * Check if game directory already has the DLLs
 * @param {string} gameDir Game installation directory
 * @param {Array} requiredDlls List of required DLL files
 * @returns {Object} Object with existingDlls array and hasAllDlls boolean
 */
function checkExistingDlls(gameDir, requiredDlls) {
  const existingDlls = [];
  
  for (const dll of requiredDlls) {
    const dllPath = path.join(gameDir, dll);
    if (fs.existsSync(dllPath)) {
      existingDlls.push(dll);
    }
  }
  
  return {
    existingDlls,
    hasAllDlls: existingDlls.length === requiredDlls.length
  };
}

/**
 * Backup existing DLLs in the game directory
 * @param {string} gameDir Game installation directory
 * @param {Array} existingDlls List of existing DLL files
 * @returns {boolean} Success status
 */
async function backupExistingDlls(gameDir, existingDlls) {
  try {
    for (const dll of existingDlls) {
      const sourcePath = path.join(gameDir, dll);
      const backupPath = `${sourcePath}.bkp`;
      
      // Check if backup already exists
      if (fs.existsSync(backupPath)) {
        console.log(`Backup already exists for ${dll}, skipping`);
        continue;
      }
      
      // Create a backup copy
      fs.copyFileSync(sourcePath, backupPath);
      console.log(`Backed up ${dll} to ${backupPath}`);
    }
    return true;
  } catch (error) {
    console.error('Error backing up DLLs:', error);
    return false;
  }
}

/**
 * Copy DXVK DLLs to the game directory
 * @param {string} sourceDxvkDir Source DXVK directory
 * @param {string} archSubfolder Architecture subfolder (x64 or x32)
 * @param {string} gameDir Game installation directory
 * @param {Array} requiredDlls List of required DLL files
 * @param {string} dxvkType Type of DXVK ('dxvk' or 'dxvk-gplasync')
 * @param {string} version Version string
 * @returns {boolean} Success status
 */
async function copyDxvkDlls(sourceDxvkDir, archSubfolder, gameDir, requiredDlls, dxvkType, version) {
  try {
    // First, try the direct path structure (sourceDxvkDir/archSubfolder)
    let dxvkBinDir = path.join(sourceDxvkDir, archSubfolder);
    
    // If that directory doesn't exist, try the nested structure based on DXVK type
    if (!fs.existsSync(dxvkBinDir)) {
      // For DXVK, the structure is typically dxvk-cache/v2.6/dxvk-2.6/x64
      // For DXVK-gplasync, the structure is typically dxvk-gplasync-cache/dxvk-gplasync-v2.6-1/dxvk-gplasync-v2.6-1/x64
      let nestedDirName;
      
      if (dxvkType === 'dxvk') {
        // For regular DXVK, the nested folder is often named "dxvk-X.Y.Z" (strip the 'v' prefix)
        nestedDirName = `dxvk-${version.replace(/^v/, '')}`;
      } else {
        // For DXVK-gplasync, the nested folder has the same name as the version
        nestedDirName = version;
      }
      
      dxvkBinDir = path.join(sourceDxvkDir, nestedDirName, archSubfolder);
      
      // If this doesn't exist either, try one more variation for DXVK-gplasync (can be inconsistent)
      if (!fs.existsSync(dxvkBinDir) && dxvkType === 'dxvk-gplasync') {
        dxvkBinDir = path.join(sourceDxvkDir, version, archSubfolder);
      }
    }
    
    // Check if DXVK directory exists after our attempts
    if (!fs.existsSync(dxvkBinDir)) {
      console.error(`DXVK bin directory not found. Tried multiple paths including: ${dxvkBinDir}`);
      return false;
    }
    
    console.log(`Using DXVK bin directory: ${dxvkBinDir}`);
    
    for (const dll of requiredDlls) {
      const sourcePath = path.join(dxvkBinDir, dll);
      const destPath = path.join(gameDir, dll);
      
      // Check if source DLL exists
      if (!fs.existsSync(sourcePath)) {
        console.error(`Source DLL not found: ${sourcePath}`);
        continue;
      }
      
      // Copy DLL to game directory
      fs.copyFileSync(sourcePath, destPath);
      console.log(`Copied ${dll} to ${destPath}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error copying DXVK DLLs:', error);
    return false;
  }
}

/**
 * Apply a DXVK version to a game
 * @param {Object} game Game object with metadata
 * @param {Object} metadata Game metadata
 * @param {string} dxvkType Type of DXVK ('dxvk' or 'dxvk-gplasync')
 * @param {string} version DXVK version
 * @param {string} cacheDir DXVK cache directory path
 * @returns {Object} Result with success status and message
 */
async function applyDxvkToGame(game, metadata, dxvkType, version, cacheDir) {
  try {
    console.log(`Applying ${dxvkType} version ${version} to ${game.name}...`);
    
    // Get the game installation directory
    const gameDir = metadata.installDir;
    if (!gameDir || !fs.existsSync(gameDir)) {
      return { 
        success: false, 
        message: `Game installation directory not found: ${gameDir}`
      };
    }
    
    // Get the architecture subfolder
    const archSubfolder = getArchSubfolder(metadata);
    console.log(`Using ${archSubfolder} architecture for ${game.name}`);
    
    // Determine required DLLs based on Direct3D version
    const { requiredDlls, description } = getDllsForDirectXVersion(metadata.direct3dVersions);
    console.log(`Game uses ${description}, requires DLLs:`, requiredDlls);
    
    // Check for existing DLLs
    const { existingDlls, hasAllDlls } = checkExistingDlls(gameDir, requiredDlls);
    
    // Determine the DXVK source directory
    const dxvkTypeDir = dxvkType === 'dxvk-gplasync' ? 'dxvk-gplasync-cache' : 'dxvk-cache';
    const sourceDxvkDir = path.join(cacheDir, dxvkTypeDir, version);
    
    if (!fs.existsSync(sourceDxvkDir)) {
      return { 
        success: false, 
        message: `DXVK directory not found: ${sourceDxvkDir}`
      };
    }
    
    // Track if backups were created
    let backupsCreated = metadata.backuped || false;
    
    // If no DLLs are found, show a warning but proceed
    if (existingDlls.length === 0) {
      console.warn(`No Direct3D DLLs found in game directory. DXVK may not work properly.`);
    } else if (!metadata.patched) {
      // Only backup existing DLLs if the game is NOT already patched with DXVK
      backupsCreated = await backupExistingDlls(gameDir, existingDlls);
      console.log(`Created backups: ${backupsCreated} (game was not previously patched)`);
    } else {
      console.log(`Skipping backup creation as the game is already patched with DXVK`);
    }
    
    // Copy DXVK DLLs to the game directory
    const copied = await copyDxvkDlls(sourceDxvkDir, archSubfolder, gameDir, requiredDlls, dxvkType, version);
    
    if (!copied) {
      return {
        success: false,
        message: `Failed to copy DXVK DLLs to game directory`
      };
    }
    
    // Update metadata to reflect DXVK application
    metadata.patched = true;
    metadata.backuped = backupsCreated;
    metadata.dxvk_version = version;
    metadata.dxvk_type = dxvkType;
    metadata.dxvk_timestamp = new Date().toISOString();
    
    // Try to save the updated metadata if a saveMetadataFunction is provided
    try {
      if (typeof global.saveGameMetadata === 'function') {
        await global.saveGameMetadata(game.appid, metadata);
        console.log(`Updated metadata for ${game.name} with DXVK information`);
      } else {
        console.warn('saveGameMetadata function not available, metadata changes will not be persisted');
      }
    } catch (error) {
      console.error('Error saving updated metadata:', error);
    }
    
    return {
      success: true,
      message: `Successfully applied ${dxvkType} version ${version} to ${game.name}`,
      warning: existingDlls.length === 0 ? 
        'No Direct3D DLLs were found in the game directory. DXVK may not work properly.' : 
        null,
      metadata: {
        patched: true,
        backuped: backupsCreated,
        dxvk_version: version,
        dxvk_type: dxvkType
      }
    };
    
  } catch (error) {
    console.error('Error applying DXVK:', error);
    return {
      success: false,
      message: `Error applying DXVK: ${error.message}`
    };
  }
}

/**
 * Get list of installed DXVK and DXVK-gplasync versions
 * @param {string} appDataPath Path to app data directory
 * @returns {Object} Object with dxvk and dxvkGplasync arrays
 */
function getInstalledDxvkVersions(appDataPath) {
  const result = {
    dxvk: [],
    dxvkGplasync: []
  };
  
  try {
    // Get DXVK versions
    const dxvkCacheDir = path.join(appDataPath, 'dxvk-cache');
    if (fs.existsSync(dxvkCacheDir)) {
      result.dxvk = fs.readdirSync(dxvkCacheDir)
        .filter(dir => {
          const fullPath = path.join(dxvkCacheDir, dir);
          return fs.statSync(fullPath).isDirectory();
        });
    }
    
    // Get DXVK-gplasync versions
    const gplasyncCacheDir = path.join(appDataPath, 'dxvk-gplasync-cache');
    if (fs.existsSync(gplasyncCacheDir)) {
      result.dxvkGplasync = fs.readdirSync(gplasyncCacheDir)
        .filter(dir => {
          const fullPath = path.join(gplasyncCacheDir, dir);
          return fs.statSync(fullPath).isDirectory();
        });
    }
    
    console.log('Installed DXVK versions:', result);
    return result;
  } catch (error) {
    console.error('Error getting installed DXVK versions:', error);
    return result;
  }
}

/**
 * Restore original DLL files from backups
 * @param {Object} game Game object with metadata
 * @param {Object} metadata Game metadata
 * @returns {Object} Result with success status and message
 */
async function restoreOriginalDlls(game, metadata) {
  try {
    console.log(`Restoring original DLL files for ${game.name}...`);
    
    // Get the game installation directory
    const gameDir = metadata.installDir;
    if (!gameDir || !fs.existsSync(gameDir)) {
      return { 
        success: false, 
        message: `Game installation directory not found: ${gameDir}`
      };
    }
    
    // Check if game has backups
    if (!metadata.backuped) {
      return {
        success: false,
        message: `No backups found for ${game.name}. Cannot restore original DLLs.`
      };
    }
    
    // Determine required DLLs based on Direct3D version
    const { requiredDlls } = getDllsForDirectXVersion(metadata.direct3dVersions);
    console.log(`Game uses DirectX, requires DLLs:`, requiredDlls);
    
    // Track success for each DLL
    const restoredDlls = [];
    const failedDlls = [];
    
    // For each required DLL, restore from backup if exists
    for (const dll of requiredDlls) {
      const dllPath = path.join(gameDir, dll);
      const backupPath = path.join(gameDir, `${dll}.bkp`);
      
      // Check if backup exists
      if (fs.existsSync(backupPath)) {
        try {
          // Remove the DXVK DLL
          if (fs.existsSync(dllPath)) {
            fs.unlinkSync(dllPath);
            console.log(`Removed DXVK DLL: ${dllPath}`);
          }
          
          // Rename backup to original name
          fs.renameSync(backupPath, dllPath);
          console.log(`Restored original DLL from backup: ${backupPath} -> ${dllPath}`);
          restoredDlls.push(dll);
        } catch (error) {
          console.error(`Error restoring ${dll}:`, error);
          failedDlls.push(dll);
        }
      } else {
        console.log(`No backup found for ${dll}`);
      }
    }
    
    // Update metadata
    if (restoredDlls.length > 0) {
      metadata.patched = false;
      metadata.backuped = false;
      metadata.dxvk_version = null;
      metadata.dxvk_type = null;
      metadata.dxvk_timestamp = null;
      
      // Try to save the updated metadata
      try {
        if (typeof global.saveGameMetadata === 'function') {
          await global.saveGameMetadata(game.appid, metadata);
          console.log(`Updated metadata for ${game.name} after restoring original DLLs`);
        } else {
          console.warn('saveGameMetadata function not available, metadata changes will not be persisted');
        }
      } catch (error) {
        console.error('Error saving updated metadata:', error);
      }
      
      return {
        success: true,
        message: `Successfully restored original DLLs for ${game.name}`,
        restoredDlls,
        failedDlls
      };
    } else {
      return {
        success: false,
        message: `Could not find any backups to restore for ${game.name}`
      };
    }
    
  } catch (error) {
    console.error('Error restoring original DLLs:', error);
    return {
      success: false,
      message: `Error restoring original DLLs: ${error.message}`
    };
  }
}

module.exports = {
  applyDxvkToGame,
  getInstalledDxvkVersions,
  getDllsForDirectXVersion,
  getArchSubfolder,
  checkExistingDlls,
  restoreOriginalDlls
}; 