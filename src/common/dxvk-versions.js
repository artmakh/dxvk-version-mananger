const fs = require('fs');
const path = require('path');
const https = require('https');
const { 
  downloadFile,
  extractTarGz,
  downloadAndExtractDxvkPackage,
  getDxvkFilesFromDir
} = require('./download-utils');

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
        'User-Agent': 'DXVK-Manager-App',
      },
    };

    return new Promise((resolve, reject) => {
      https
        .get(apiUrl, options, res => {
          let data = '';

          res.on('data', chunk => {
            data += chunk;
          });

          res.on('end', () => {
            try {
              const releases = JSON.parse(data);

              // Process releases to extract the information we need
              const processedReleases = releases.map(release => {
                // Find the main DXVK asset (not the native one)
                const mainAsset = release.assets.find(
                  asset =>
                    asset.browser_download_url.includes(`dxvk-${release.tag_name.substring(1)}`) &&
                    !asset.browser_download_url.includes('native')
                );

                return {
                  version: release.tag_name,
                  name: release.name,
                  date: new Date(release.published_at),
                  downloadUrl: mainAsset ? mainAsset.browser_download_url : null,
                  isDownloaded: isDxvkVersionDownloaded(release.tag_name),
                };
              });

              resolve(processedReleases);
            } catch (error) {
              console.error('Error parsing GitHub API response:', error);
              reject(error);
            }
          });
        })
        .on('error', error => {
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
  const versionDir = path.join(dxvkCacheDir, version);
  return downloadAndExtractDxvkPackage(version, downloadUrl, dxvkCacheDir, versionDir);
}

// Get DXVK files for a specific version
function getDxvkFiles(version) {
  const versionDir = path.join(dxvkCacheDir, version);
  return getDxvkFilesFromDir(versionDir);
}

module.exports = {
  initDxvkCacheDir,
  fetchDxvkReleases,
  downloadDxvkVersion,
  isDxvkVersionDownloaded,
  getDxvkFiles,
};
