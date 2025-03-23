const fs = require('fs');
const path = require('path');
const https = require('https');
const { createWriteStream } = require('fs');
const { spawn } = require('child_process');

// Global cache directory paths
let dxvkCacheDir;

// Initialize DXVK cache directory
function initDxvkCacheDir(appDataPath) {
  dxvkCacheDir = path.join(appDataPath, 'dxvk-cache');
  
  console.log('Using DXVK cache directory:', dxvkCacheDir);
  
  // Create directory if it doesn't exist
  ensureDxvkCacheDir();
  
  return dxvkCacheDir;
}

// Create DXVK cache directory if it doesn't exist
function ensureDxvkCacheDir() {
  try {
    if (!fs.existsSync(dxvkCacheDir)) {
      fs.mkdirSync(dxvkCacheDir, { recursive: true });
      console.log(`Created DXVK cache directory: ${dxvkCacheDir}`);
    }
  } catch (error) {
    console.error('Error creating DXVK cache directory:', error);
  }
}

// Fetch DXVK releases from GitHub API
async function fetchDxvkReleases() {
  try {
    const apiUrl = 'https://api.github.com/repos/doitsujin/dxvk/releases';
    
    const options = {
      headers: {
        'User-Agent': 'DXVK-Manager-App'
      }
    };
    
    return new Promise((resolve, reject) => {
      https.get(apiUrl, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const releases = JSON.parse(data);
            
            // Process releases to extract the information we need
            const processedReleases = releases.map(release => {
              // Find the main DXVK asset (not the native one)
              const mainAsset = release.assets.find(asset => 
                asset.browser_download_url.includes(`dxvk-${release.tag_name.substring(1)}`) && 
                !asset.browser_download_url.includes('native')
              );
              
              return {
                version: release.tag_name,
                name: release.name,
                date: new Date(release.published_at),
                downloadUrl: mainAsset ? mainAsset.browser_download_url : null,
                isDownloaded: isDxvkVersionDownloaded(release.tag_name)
              };
            });
            
            resolve(processedReleases);
          } catch (error) {
            console.error('Error parsing GitHub API response:', error);
            reject(error);
          }
        });
      }).on('error', (error) => {
        console.error('Error fetching DXVK releases:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error in fetchDxvkReleases:', error);
    return [];
  }
}

// Check if a specific DXVK version is already downloaded
function isDxvkVersionDownloaded(version) {
  const versionDir = path.join(dxvkCacheDir, version);
  return fs.existsSync(versionDir);
}

// Download and extract a specific DXVK version
async function downloadDxvkVersion(version, downloadUrl) {
  if (!downloadUrl) {
    console.error(`No download URL for DXVK version ${version}`);
    return false;
  }
  
  try {
    // Create version directory
    const versionDir = path.join(dxvkCacheDir, version);
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
    }
    
    // Download file path
    const fileName = path.basename(downloadUrl);
    const filePath = path.join(dxvkCacheDir, fileName);
    
    console.log(`Downloading DXVK ${version} from ${downloadUrl}`);
    
    // Download the file
    await downloadFile(downloadUrl, filePath);
    
    // Extract the tar.gz file
    console.log(`Extracting ${fileName} to ${versionDir}`);
    await extractTarGz(filePath, versionDir);
    
    // Remove the downloaded tar.gz file after extraction
    fs.unlinkSync(filePath);
    
    console.log(`Successfully downloaded and extracted DXVK ${version}`);
    return true;
  } catch (error) {
    console.error(`Error downloading DXVK version ${version}:`, error);
    return false;
  }
}

// Helper function to download a file
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destination);
    
    const request = https.get(url, (response) => {
      // Handle redirects (status codes 301, 302, 307, 308)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Close the file because we're going to create a new one for the redirect
        file.close();
        try {
          fs.unlinkSync(destination);
        } catch (error) {
          // Ignore error if file doesn't exist
        }
        
        // Log the redirect
        console.log(`Following redirect to: ${response.headers.location}`);
        
        // Recursively call the function with the new URL
        downloadFile(response.headers.location, destination)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      // Handle non-2xx status codes
      if (response.statusCode !== 200) {
        // Close and delete the file
        file.close();
        try {
          fs.unlinkSync(destination);
        } catch (error) {
          // Ignore error if file doesn't exist
        }
        
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlink(destination, () => {}); // Delete the file async
        reject(err);
      });
    });
    
    request.on('error', (err) => {
      fs.unlink(destination, () => {}); // Delete the file async
      reject(err);
    });
    
    // Set a timeout to prevent hanging downloads
    request.setTimeout(60000, () => {
      request.abort();
      fs.unlink(destination, () => {}); // Delete the file async
      reject(new Error('Download timed out'));
    });
  });
}

// Helper function to extract a tar.gz file
function extractTarGz(filePath, destination) {
  return new Promise((resolve, reject) => {
    // Use tar command to extract
    const tar = spawn('tar', ['-xzf', filePath, '-C', destination]);
    
    tar.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tar process exited with code ${code}`));
      }
    });
    
    tar.on('error', (err) => {
      reject(err);
    });
  });
}

// Get DXVK files for a specific version
function getDxvkFiles(version) {
  try {
    const versionDir = path.join(dxvkCacheDir, version);
    
    if (!fs.existsSync(versionDir)) {
      console.error(`DXVK version ${version} is not downloaded`);
      return null;
    }
    
    // DXVK extracted directory might be nested inside another directory
    // We need to find the directory containing the x32 and x64 directories
    let dxvkDir = versionDir;
    const items = fs.readdirSync(versionDir);
    
    // If there's only one item and it's a directory, it might be the nested DXVK directory
    if (items.length === 1) {
      const nestedDir = path.join(versionDir, items[0]);
      if (fs.statSync(nestedDir).isDirectory()) {
        dxvkDir = nestedDir;
      }
    }
    
    // Check if x32 and x64 directories exist
    const x32Dir = path.join(dxvkDir, 'x32');
    const x64Dir = path.join(dxvkDir, 'x64');
    
    if (!fs.existsSync(x32Dir) || !fs.existsSync(x64Dir)) {
      console.error(`DXVK version ${version} doesn't have expected directory structure`);
      return null;
    }
    
    // Get DLL files from each directory
    const x32Files = fs.readdirSync(x32Dir)
      .filter(file => file.endsWith('.dll'))
      .map(file => path.join(x32Dir, file));
      
    const x64Files = fs.readdirSync(x64Dir)
      .filter(file => file.endsWith('.dll'))
      .map(file => path.join(x64Dir, file));
    
    return {
      x32: x32Files,
      x64: x64Files
    };
  } catch (error) {
    console.error(`Error getting DXVK files for version ${version}:`, error);
    return null;
  }
}

module.exports = {
  initDxvkCacheDir,
  fetchDxvkReleases,
  downloadDxvkVersion,
  isDxvkVersionDownloaded,
  getDxvkFiles
}; 