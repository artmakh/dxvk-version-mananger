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
let gplasyncCacheDir;

// Initialize DXVK-gplasync cache directory
function initGplasyncCacheDir(appDataPath) {
  gplasyncCacheDir = path.join(appDataPath, 'dxvk-gplasync-cache');

  console.log('Using DXVK-gplasync cache directory:', gplasyncCacheDir);

  // Create directory if it doesn't exist
  ensureGplasyncCacheDir();

  return gplasyncCacheDir;
}

// Create DXVK-gplasync cache directory if it doesn't exist
function ensureGplasyncCacheDir() {
  try {
    if (!fs.existsSync(gplasyncCacheDir)) {
      fs.mkdirSync(gplasyncCacheDir, { recursive: true });
      console.log(`Created DXVK-gplasync cache directory: ${gplasyncCacheDir}`);
    }
  } catch (error) {
    console.error('Error creating DXVK-gplasync cache directory:', error);
  }
}

// Fetch DXVK-gplasync releases from GitLab
async function fetchGplasyncReleases() {
  try {
    // We'll use the GitLab API to get the repository files in the releases directory
    const apiUrl =
      'https://gitlab.com/api/v4/projects/Ph42oN%2Fdxvk-gplasync/repository/tree?path=releases&ref=main';

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
              const response = JSON.parse(data);

              if (Array.isArray(response)) {
                // Filter for tar.gz files and extract version numbers
                const releases = response
                  .filter(item => item.name.endsWith('.tar.gz') && !item.name.includes('native'))
                  .map(item => {
                    // Extract version from filename (e.g., dxvk-gplasync-2.4.tar.gz -> v2.4)
                    const versionMatch = item.name.match(
                      /dxvk-gplasync-([0-9.]+(?:-[0-9]+)?)\.tar\.gz/
                    );

                    // Clean the version string to use as a safe directory name
                    const version = versionMatch
                      ? `v${versionMatch[1]}`
                      : item.name.replace(/\.tar\.gz$/, '');

                    // Get just the filename without path separators
                    const fileName = item.name;

                    // Construct the download URL
                    const downloadUrl = `https://gitlab.com/Ph42oN/dxvk-gplasync/-/raw/main/releases/${fileName}`;

                    return {
                      version: version,
                      fileName: fileName,
                      name: `DXVK-gplasync ${version}`,
                      // We don't have a published date from the API, so use last commit date or current date
                      date: new Date(),
                      downloadUrl: downloadUrl,
                      isDownloaded: isGplasyncVersionDownloaded(version),
                    };
                  });

                // Sort releases by version number in descending order
                releases.sort((a, b) => {
                  const versionA = a.version.replace('v', '').split(/[.-]/).map(Number);
                  const versionB = b.version.replace('v', '').split(/[.-]/).map(Number);

                  for (let i = 0; i < Math.max(versionA.length, versionB.length); i++) {
                    const numA = i < versionA.length ? versionA[i] : 0;
                    const numB = i < versionB.length ? versionB[i] : 0;
                    if (numA !== numB) {
                      return numB - numA; // Higher version first
                    }
                  }
                  return 0;
                });

                resolve(releases);
              } else {
                reject(new Error('Invalid response format from GitLab API'));
              }
            } catch (error) {
              console.error('Error parsing GitLab API response:', error);
              reject(error);
            }
          });
        })
        .on('error', error => {
          console.error('Error fetching DXVK-gplasync releases:', error);
          reject(error);
        });
    });
  } catch (error) {
    console.error('Error in fetchGplasyncReleases:', error);
    return [];
  }
}

// Check if a specific DXVK-gplasync version is already downloaded
function isGplasyncVersionDownloaded(version) {
  // Create a safe directory name from the version (remove "v" prefix from the version as well)
  const safeVersion = version.replace(/^v/, '').replace(/[/\\]/g, '-');
  const versionDir = path.join(gplasyncCacheDir, safeVersion);
  return fs.existsSync(versionDir);
}

// Download and extract a specific DXVK-gplasync version
async function downloadGplasyncVersion(version, downloadUrl) {
  // Create a safe directory name from the version (remove "v" prefix from the version as well)
  const safeVersion = version.replace(/^v/, '').replace(/[/\\]/g, '-');
  const versionDir = path.join(gplasyncCacheDir, safeVersion);
  
  // Use the common function to handle the download and extraction
  return downloadAndExtractDxvkPackage(version, downloadUrl, gplasyncCacheDir, versionDir);
}

// Get DXVK-gplasync files for a specific version
function getGplasyncFiles(version) {
  // Create a safe directory name from the version (remove "v" prefix from the version as well)
  const safeVersion = version.replace(/^v/, '').replace(/[/\\]/g, '-');
  const versionDir = path.join(gplasyncCacheDir, safeVersion);
  
  // Use the common function to get the files
  return getDxvkFilesFromDir(versionDir);
}

module.exports = {
  initGplasyncCacheDir,
  fetchGplasyncReleases,
  downloadGplasyncVersion,
  isGplasyncVersionDownloaded,
  getGplasyncFiles,
};
