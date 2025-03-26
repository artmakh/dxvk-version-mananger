const fs = require('fs');
const path = require('path');
const https = require('https');
const { createWriteStream } = require('fs');
const { spawn } = require('child_process');

/**
 * Downloads a file from a URL to a local destination
 * @param {string} url - URL to download from
 * @param {string} destination - Local file path to save to
 * @returns {Promise<void>} - Resolves when download completes
 */
function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    // Create directory for the file if it doesn't exist
    const destDir = path.dirname(destination);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    console.log(`Starting download from ${url} to ${destination}`);

    // Clean up any existing file first to prevent conflicts
    if (fs.existsSync(destination)) {
      try {
        fs.unlinkSync(destination);
        console.log(`Removed existing file at ${destination}`);
      } catch (err) {
        console.error(`Failed to remove existing file: ${err.message}`);
      }
    }

    // Create the file stream after we're sure the path is clear
    const file = createWriteStream(destination);

    let isComplete = false;

    // Function to clean up if anything goes wrong
    const cleanupOnError = error => {
      if (isComplete) return;

      isComplete = true;

      // Close the file and delete it on error
      file.close();

      try {
        if (fs.existsSync(destination)) {
          fs.unlinkSync(destination);
          console.log(`Deleted incomplete download: ${destination}`);
        }
      } catch (err) {
        console.error(`Failed to delete incomplete file: ${err.message}`);
      }

      reject(error);
    };

    // Set up error handlers for the file
    file.on('error', err => {
      console.error(`File write error: ${err.message}`);
      cleanupOnError(err);
    });

    const request = https.get(url, response => {
      // Handle redirects (status codes 301, 302, 307, 308)
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        // Close the current file
        file.close();

        // Log the redirect
        console.log(`Following redirect from ${url} to ${response.headers.location}`);

        // Recursively call with the new URL
        downloadFile(response.headers.location, destination).then(resolve).catch(reject);
        return;
      }

      // Handle non-2xx status codes
      if (response.statusCode !== 200) {
        cleanupOnError(new Error(`Server returned status code ${response.statusCode}`));
        return;
      }

      // Set up the pipe from response to file
      response.pipe(file);

      response.on('error', err => {
        console.error(`Response error: ${err.message}`);
        cleanupOnError(err);
      });

      // On successful download completion
      file.on('finish', () => {
        if (isComplete) return;

        isComplete = true;
        file.close();
        console.log(`Download complete: ${destination}`);
        resolve();
      });
    });

    // Handle connection errors
    request.on('error', err => {
      console.error(`Request error: ${err.message}`);
      cleanupOnError(err);
    });

    // Set a longer timeout (3 minutes) to prevent hanging downloads
    request.setTimeout(180000, () => {
      console.error(`Download timed out after 3 minutes: ${url}`);
      cleanupOnError(new Error('Download timed out after 3 minutes'));
    });
  });
}

/**
 * Extracts a tar.gz file to a destination directory
 * @param {string} filePath - Path to the tar.gz file
 * @param {string} destination - Directory to extract to
 * @returns {Promise<void>} - Resolves when extraction completes
 */
function extractTarGz(filePath, destination) {
  return new Promise((resolve, reject) => {
    console.log(`Extracting ${filePath} to ${destination}`);

    // Make sure destination directory exists
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    // First try built-in Node.js approach with our tar dependency
    try {
      const tar = require('tar');

      console.log('Using tar package for extraction');
      
      tar.extract({
        file: filePath,
        cwd: destination,
        sync: false,
        onentry: entry => {
          console.log(`Extracting: ${entry.path}`);
        }
      }).then(() => {
        console.log('Extraction complete using tar package');
        // Delete the downloaded tar.gz file after successful extraction
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
            console.log(`Removed tar.gz file: ${filePath}`);
          } catch (err) {
            console.error(`Warning: Failed to delete tar.gz file: ${err.message}`);
          }
        }
        resolve();
      }).catch(err => {
        console.error('Tar package extraction error:', err);
        // If tar package fails, try external commands as fallbacks
        tryExternalCommands().then(resolve).catch(reject);
      });
    } catch (error) {
      console.error('Error setting up tar package extraction:', error);
      // If Node.js modules approach fails, try external commands
      tryExternalCommands().then(resolve).catch(reject);
    }

    // Function to try external extraction commands (7z or tar)
    function tryExternalCommands() {
      return new Promise((resolveExternal, rejectExternal) => {
        // Use 7z if available (better on Windows), otherwise fall back to tar
        const use7z = process.platform === 'win32';

        let extractProcess;
        let errorOutput = '';

        if (use7z) {
          // For Windows, try to use 7z (which is more reliable for tar.gz on Windows)
          console.log('Attempting extraction with 7z');

          try {
            // First, extract the .gz to get the .tar
            extractProcess = spawn('7z', ['x', filePath, `-o${destination}`, '-y']);
          } catch (err) {
            console.log('7z execution failed, falling back to tar:', err);

            try {
              extractProcess = spawn('tar', ['-xzf', filePath, '-C', destination]);
            } catch (tarErr) {
              console.error('Both 7z and tar execution failed:', tarErr);
              rejectExternal(new Error('External extraction commands unavailable'));
              return;
            }
          }
        } else {
          // On Unix systems, use tar directly
          try {
            extractProcess = spawn('tar', ['-xzf', filePath, '-C', destination]);
          } catch (err) {
            console.error('tar execution failed:', err);
            rejectExternal(new Error('External extraction commands unavailable'));
            return;
          }
        }

        extractProcess.stderr.on('data', data => {
          errorOutput += data.toString();
        });

        extractProcess.on('close', code => {
          if (code === 0) {
            console.log(`Successfully extracted ${filePath} using external command`);
            // Delete the downloaded tar.gz file after successful extraction if it exists
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
                console.log(`Removed tar.gz file: ${filePath}`);
              } catch (err) {
                console.error(`Warning: Failed to delete tar.gz file: ${err.message}`);
              }
            }
            resolveExternal();
          } else {
            console.error(`External extraction failed with code ${code}: ${errorOutput}`);

            // If using 7z failed, try with tar as a fallback
            if (use7z) {
              console.log('Trying tar as a fallback...');

              try {
                const tarFallback = spawn('tar', ['-xzf', filePath, '-C', destination]);

                tarFallback.on('close', fallbackCode => {
                  if (fallbackCode === 0) {
                    console.log(`Successfully extracted ${filePath} using tar fallback`);
                    // Delete the downloaded tar.gz file after successful extraction if it exists
                    if (fs.existsSync(filePath)) {
                      try {
                        fs.unlinkSync(filePath);
                        console.log(`Removed tar.gz file: ${filePath}`);
                      } catch (err) {
                        console.error(`Warning: Failed to delete tar.gz file: ${err.message}`);
                      }
                    }
                    resolveExternal();
                  } else {
                    console.error(`tar fallback failed with code ${fallbackCode}`);
                    // Perform a manual verification if the extraction might have been successful despite errors
                    verifyExtraction();
                  }
                });

                tarFallback.on('error', err => {
                  console.error(`tar fallback error: ${err.message}`);
                  // Perform a manual verification if the extraction might have been successful despite errors
                  verifyExtraction();
                });
              } catch (err) {
                console.error('tar fallback execution failed:', err);
                // Perform a manual verification if the extraction might have been successful despite errors
                verifyExtraction();
              }
            } else {
              // Perform a manual verification if the extraction might have been successful despite errors
              verifyExtraction();
            }
          }
        });

        extractProcess.on('error', err => {
          console.error(`Extraction process error: ${err.message}`);

          // For Windows, if 7z fails with ENOENT (not found), try tar
          if (use7z && err.message.includes('ENOENT')) {
            console.log('7z not found, trying tar...');

            try {
              const tarFallback = spawn('tar', ['-xzf', filePath, '-C', destination]);

              tarFallback.on('close', fallbackCode => {
                if (fallbackCode === 0) {
                  console.log(`Successfully extracted ${filePath} using tar fallback`);
                  // Delete the downloaded tar.gz file after successful extraction
                  if (fs.existsSync(filePath)) {
                    try {
                      fs.unlinkSync(filePath);
                      console.log(`Removed tar.gz file: ${filePath}`);
                    } catch (err) {
                      console.error(`Warning: Failed to delete tar.gz file: ${err.message}`);
                    }
                  }
                  resolveExternal();
                } else {
                  console.error(`tar fallback failed with code ${fallbackCode}`);
                  // Perform a manual verification if the extraction might have been successful despite errors
                  verifyExtraction();
                }
              });

              tarFallback.on('error', fallbackErr => {
                console.error(`tar fallback error: ${fallbackErr.message}`);
                // Perform a manual verification if the extraction might have been successful despite errors
                verifyExtraction();
              });
            } catch (err) {
              console.error('tar fallback execution failed:', err);
              // Perform a manual verification if the extraction might have been successful despite errors
              verifyExtraction();
            }
          } else {
            // Perform a manual verification if the extraction might have been successful despite errors
            verifyExtraction();
          }
        });
      });
    }

    // Function to verify if extraction seems to have succeeded despite command errors
    function verifyExtraction() {
      console.log('Verifying if extraction was successful despite reported errors...');

      try {
        // Check if the destination directory has any content
        const items = fs.readdirSync(destination);

        if (items.length > 0) {
          console.log(
            `Extraction appears successful despite errors. Found ${items.length} items in the directory.`
          );

          // Look for known DXVK directory structure
          let hasDxvkStructure = false;

          // Check for x32/x64 directories or a subdirectory containing them
          if (items.includes('x32') && items.includes('x64')) {
            hasDxvkStructure = true;
          } else {
            // Check if there's a single subdirectory that might contain the x32/x64 dirs
            for (const item of items) {
              const itemPath = path.join(destination, item);
              if (fs.statSync(itemPath).isDirectory()) {
                const subItems = fs.readdirSync(itemPath);
                if (subItems.includes('x32') && subItems.includes('x64')) {
                  hasDxvkStructure = true;
                  break;
                }
              }
            }
          }

          if (hasDxvkStructure) {
            console.log('DXVK directory structure verified, considering extraction successful.');
            // Delete the downloaded tar.gz file if it exists
            if (fs.existsSync(filePath)) {
              try {
                fs.unlinkSync(filePath);
                console.log(`Removed tar.gz file: ${filePath}`);
              } catch (err) {
                console.error(`Warning: Failed to delete tar.gz file: ${err.message}`);
              }
            }
            resolve();
            return;
          }
        }

        // If we get here, extraction verification failed
        console.error('Extraction verification failed: No valid DXVK structure found');
        reject(new Error('Extraction failed or resulted in invalid structure'));
      } catch (err) {
        console.error('Error during extraction verification:', err);
        reject(err);
      }
    }
  });
}

/**
 * Downloads and extracts a DXVK version package
 * @param {string} version - Version identifier
 * @param {string} downloadUrl - URL to download from
 * @param {string} cacheDir - Base cache directory
 * @param {string} versionDir - Target directory for this version
 * @returns {Promise<boolean>} - Resolves to true if successful
 */
async function downloadAndExtractDxvkPackage(version, downloadUrl, cacheDir, versionDir) {
  if (!downloadUrl) {
    console.error(`No download URL for version ${version}`);
    return false;
  }

  try {
    console.log(`Starting download of version ${version}`);

    // Create version directory if it doesn't exist
    if (!fs.existsSync(versionDir)) {
      fs.mkdirSync(versionDir, { recursive: true });
      console.log(`Created version directory: ${versionDir}`);
    }

    // Extract filename from download URL
    const fileName = path.basename(downloadUrl);
    const downloadPath = path.join(cacheDir, fileName);

    console.log(`Downloading from ${downloadUrl}`);
    console.log(`Download destination: ${downloadPath}`);

    // Download the file
    await downloadFile(downloadUrl, downloadPath);

    // Extract the tar.gz file
    console.log(`Extracting ${fileName} to ${versionDir}`);
    await extractTarGz(downloadPath, versionDir);

    // The extractTarGz function handles deleting the file, so we only check if
    // it somehow still exists as a fallback
    if (fs.existsSync(downloadPath)) {
      console.log(`Cleanup: tar.gz file still exists, this shouldn't happen as extractTarGz should have deleted it`);
    }

    console.log(`Successfully downloaded and extracted version ${version}`);
    return true;
  } catch (error) {
    console.error(`Error downloading version ${version}:`, error);
    return false;
  }
}

/**
 * Finds DXVK files in a version directory
 * @param {string} versionDir - Path to the version directory
 * @returns {Object|null} - Object with x32 and x64 arrays of DLL paths, or null if not found
 */
function getDxvkFilesFromDir(versionDir) {
  try {
    if (!fs.existsSync(versionDir)) {
      console.error(`Version directory not found: ${versionDir}`);
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
      console.error(`Version doesn't have expected directory structure`);
      return null;
    }

    // Get DLL files from each directory
    const x32Files = fs
      .readdirSync(x32Dir)
      .filter(file => file.endsWith('.dll'))
      .map(file => path.join(x32Dir, file));

    const x64Files = fs
      .readdirSync(x64Dir)
      .filter(file => file.endsWith('.dll'))
      .map(file => path.join(x64Dir, file));

    return {
      x32: x32Files,
      x64: x64Files,
    };
  } catch (error) {
    console.error(`Error getting DXVK files:`, error);
    return null;
  }
}

module.exports = {
  downloadFile,
  extractTarGz,
  downloadAndExtractDxvkPackage,
  getDxvkFilesFromDir
}; 