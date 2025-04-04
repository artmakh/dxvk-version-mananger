// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  // Make the checkAspectRatio function available globally
  window.checkAspectRatio = checkAspectRatio;

  // Get all tab buttons and tab panes
  const tabButtons = document.querySelectorAll('.tab-button');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Add click event listeners to each tab button
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      // Get the tab id from the data-tab attribute
      const tabId = button.getAttribute('data-tab');

      // Remove active class from all buttons and panes
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabPanes.forEach(pane => pane.classList.remove('active'));

      // Add active class to the clicked button and corresponding pane
      button.classList.add('active');
      document.getElementById(tabId).classList.add('active');
    });
  });

  // Initialize tab content
  initInstalledGamesTab();
  initDxvkVersionsTab();
  initDxvkGplasyncTab();
});

// Function to check image aspect ratio and add appropriate class
function checkAspectRatio(img) {
  // Add event listener for when the image is fully loaded
  if (img.complete) {
    applyAspectRatioClass(img);
  } else {
    img.addEventListener('load', () => applyAspectRatioClass(img));
  }
}

// Apply the appropriate class based on aspect ratio
function applyAspectRatioClass(img) {
  // Clear any existing aspect ratio classes
  img.classList.remove('cover-portrait', 'cover-square', 'cover-landscape');

  // Calculate the aspect ratio (width/height)
  const aspectRatio = img.naturalWidth / img.naturalHeight;

  // Classify the image based on its aspect ratio
  if (aspectRatio <= 0.75) {
    // Portrait images (2:3 = 0.667 and similar)
    // This includes Steam's typical 600x900 covers (0.667)
    img.classList.add('cover-portrait');
  } else if (aspectRatio >= 0.9 && aspectRatio <= 1.1) {
    // Square or nearly square images
    img.classList.add('cover-square');
  } else if (aspectRatio > 1.1) {
    // Landscape images
    img.classList.add('cover-landscape');
  }

  // Log the aspect ratio for debugging
  console.log(
    `Image aspect ratio: ${aspectRatio.toFixed(2)} - Classified as: ${img.className.split(' ').pop()}`
  );
}

// Save custom game metadata
async function saveCustomGameMetadata(gameId, metadataUpdates) {
  try {
    // Call the main process to save the custom metadata
    const result = await window.electronAPI.saveCustomGameMetadata(gameId, metadataUpdates);
    if (result.success) {
      console.log(`Successfully saved custom metadata for game ${gameId}`);
      return true;
    } else {
      console.error(`Failed to save custom metadata: ${result.message}`);
      return false;
    }
  } catch (error) {
    console.error('Error saving custom metadata:', error);
    return false;
  }
}

// Format date to a readable string
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// Initialize the "Installed Games" tab
async function initInstalledGamesTab() {
  const gamesContainer = document.querySelector('#installed-games .content-area');
  gamesContainer.innerHTML = '<p>Loading Steam games...</p>';

  // Create a more sophisticated placeholder image with game controller icon
  const placeholderImage =
    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YzZjRmNiIvPjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDI2MCwgMTAwKSI+PHBhdGggZD0iTTY2LjA4IDIwLjM2QzU5LjU2IDguOTkgNTAuMDIgMC4wMSAzOS45OCAwLjAxQzI5LjkzIDAuMDEgMjAuMzkgOC45OSAxMy44NyAyMC4zNkM0LjkxIDE5LjE2IC0xLjg1IDI4LjA5IDAuNDkgMzYuODhDMi41OSA0NS4xMiAxMi4wOSA0OS41MiAyMC41NSA0NS43N0MyNi4yMiA0My40IDMyLjk2IDQxLjU2IDM5Ljk4IDQxLjU2QzQ2Ljk5IDQxLjU2IDUzLjc0IDQzLjQgNTkuNDEgNDUuNzdDNjcuODcgNDkuNTMgNzcuMzcgNDUuMTMgNzkuNDcgMzYuODhDODEuOCAyOC4wOSA3NS4wNSAxOS4xNiA2Ni4wOCAyMC4zNlpNMjYuMzIgMjcuMDJDMjMuMTQgMjcuMDIgMjAuNTUgMjQuNDQgMjAuNTUgMjEuMjZDMjAuNTUgMTguMDggMjMuMTQgMTUuNSAyNi4zMiAxNS41QzI5LjQ5IDE1LjUgMzIuMDggMTguMDggMzIuMDggMjEuMjZDMzIuMDggMjQuNDQgMjkuNDkgMjcuMDIgMjYuMzIgMjcuMDJaTTUzLjY0IDI3LjAyQzUwLjQ3IDI3LjAyIDQ3Ljg4IDI0LjQ0IDQ3Ljg4IDIxLjI2QzQ3Ljg4IDE4LjA4IDUwLjQ3IDE1LjUgNTMuNjQgMTUuNUM1Ni44MSAxNS41IDU5LjQgMTguMDggNTkuNCAyMS4yNkM1OS40IDI0LjQ0IDU2LjgxIDI3LjAyIDUzLjY0IDI3LjAyWiIgZmlsbD0iI2RkZGRlMCIvPjwvZz48dGV4dCB4PSI1MCUiIHk9IjIxNSIgZm9udC1mYW1pbHk9IkludGVyLCBBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZm9udC13ZWlnaHQ9IjUwMCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY0NzQ4YiI+R2FtZSBJbWFnZSBOb3QgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';

  try {
    // Verify the electronAPI exists before calling it
    if (!window.electronAPI) {
      throw new Error('Electron API not available. IPC bridge may not be properly configured.');
    }

    // Get Steam games from the main process
    const steamGames = await window.electronAPI.getSteamGames();

    if (steamGames.length === 0) {
      gamesContainer.innerHTML =
        '<p>No Steam games found. Steam may not be installed or no games are installed.</p>';
    } else {
      // Create a grid to display the games with cover art
      let gameCardsHTML = '<div class="game-cards">';

      // Create a card for each game
      for (const game of steamGames) {
        // Add a loading indicator
        const cardId = `game-card-${game.appid}`;
        gameCardsHTML += `
                    <div id="${cardId}" class="game-card" data-appid="${game.appid}">
                        <div class="loading-indicator">
                            <div class="spinner"></div>
                            <p>Loading metadata...</p>
                        </div>
                    </div>
                `;
      }

      gameCardsHTML += '</div>';
      gamesContainer.innerHTML = gameCardsHTML;

      // Fetch metadata for each game after rendering the initial cards
      for (const game of steamGames) {
        const cardId = `game-card-${game.appid}`;
        try {
          const metadata = await window.electronAPI.getGameMetadata(game.appid);

          // Get DXVK status for the game
          const dxvkStatus = await window.electronAPI.getGameDxvkStatus(game.appid);

          // Check if game supports Vulkan
          const hasVulkan =
            metadata.vulkanVersions !== null && metadata.vulkanVersions !== 'Unknown';

          // Determine Windows executable info
          let executableInfo = 'No info about Windows executable';
          if (metadata.executable64bit === 'true') {
            executableInfo = '64-bit';
          } else if (metadata.executable32bit === 'true') {
            executableInfo = '32-bit';
          }

          // Check if the game has complete metadata for DXVK management
          const hasCompleteInfo =
            metadata.direct3dVersions !== 'Unknown' &&
            (metadata.executable32bit === 'true' || metadata.executable64bit === 'true');

          // Create a card with game info and cover
          const coverUrl =
            metadata.localCoverPath ||
            metadata.coverUrl ||
            `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`;

          const gameCard = document.getElementById(cardId);
          if (gameCard) {
            const gameDetails = `
                            <div class="game-cover">
                                <img src="${coverUrl}" alt="${game.name}" onerror="this.src='${placeholderImage}'" onload="checkAspectRatio(this)">
                            </div>
                            <div class="game-info">
                                <h3>${game.name}</h3>
                                <div class="game-details">`;

            let additionalDetails = '';
            if (hasVulkan) {
              // For Vulkan games, show a green message
              additionalDetails = `
                                <div class="detail-row vulkan-supported">
                                    <span class="detail-value">Already on Vulkan!</span>
                                </div>`;
            } else {
              // For DX games, show Direct3D and executable info
              const direct3dInfo =
                metadata.direct3dVersions !== 'Unknown'
                  ? metadata.direct3dVersions
                  : 'No info about Direct3D versions';

              additionalDetails = `
                                <div class="detail-row">
                                    <span class="detail-label">Direct3D:</span>`;

              // If Direct3D info is unknown or custom_d3d is true, show a dropdown selector
              if (
                direct3dInfo === 'No info about Direct3D versions' ||
                metadata.custom_d3d === true
              ) {
                additionalDetails += `
                                    <span class="detail-value custom-selector">
                                        <select class="direct3d-selector" data-game-id="${game.appid}">
                                            <option value="">Choose Direct3D version</option>
                                            <option value="Direct3D 8" ${metadata.direct3dVersions === 'Direct3D 8' ? 'selected' : ''}>Direct3D 8</option>
                                            <option value="Direct3D 9" ${metadata.direct3dVersions === 'Direct3D 9' ? 'selected' : ''}>Direct3D 9</option>
                                            <option value="Direct3D 10" ${metadata.direct3dVersions === 'Direct3D 10' ? 'selected' : ''}>Direct3D 10</option>
                                            <option value="Direct3D 11" ${metadata.direct3dVersions === 'Direct3D 11' ? 'selected' : ''}>Direct3D 11</option>
                                        </select>
                                    </span>`;
              } else {
                additionalDetails += `
                                    <span class="detail-value">${direct3dInfo}</span>`;
              }

              additionalDetails += `
                                </div>
                                <div class="detail-row">
                                    <span class="detail-label">Windows exec:</span>`;

              // If executable info is unknown or custom_exec is true, show a dropdown selector
              if (
                executableInfo === 'No info about Windows executable' ||
                metadata.custom_exec === true
              ) {
                const is32bit = metadata.executable32bit === 'true';
                const is64bit = metadata.executable64bit === 'true';
                let selectedValue = '';

                if (is32bit) selectedValue = 'x32';
                else if (is64bit) selectedValue = 'x64';

                additionalDetails += `
                                    <span class="detail-value custom-selector">
                                        <select class="executable-selector" data-game-id="${game.appid}">
                                            <option value="">Choose architecture</option>
                                            <option value="x32" ${selectedValue === 'x32' ? 'selected' : ''}>32-bit</option>
                                            <option value="x64" ${selectedValue === 'x64' ? 'selected' : ''}>64-bit</option>
                                        </select>
                                    </span>`;
              } else {
                additionalDetails += `
                                    <span class="detail-value">${executableInfo}</span>`;
              }

              additionalDetails += `
                                </div>`;
            }

            // Add DXVK status if patched
            if (dxvkStatus && dxvkStatus.patched) {
              additionalDetails += `
                                <div class="detail-row dxvk-status">
                                    <span class="detail-label">DXVK Status:</span>
                                    <span class="detail-value dxvk-applied" title="${dxvkStatus.dxvk_type} ${dxvkStatus.dxvk_version}">
                                        Patched with ${dxvkStatus.dxvk_type} ${dxvkStatus.dxvk_version}
                                    </span>
                                </div>`;

              if (dxvkStatus.backuped) {
                additionalDetails += `
                                    <div class="detail-row">
                                        <span class="detail-label">DLL Backup:</span>
                                        <span class="detail-value backup-exists">Yes</span>
                                    </div>`;
              }
            }

            // Only show the button for non-Vulkan games
            let buttonHtml = '';
            if (!hasVulkan) {
              // Set the button as enabled if:
              // 1. We have complete info from PCGamingWiki OR
              // 2. We have both custom_d3d and custom_exec (user has selected both values)
              const hasCompletedCustomInfo =
                metadata.custom_d3d === true && metadata.custom_exec === true;
              const isPatched = dxvkStatus && dxvkStatus.patched;
              const buttonText = isPatched ? 'Update DXVK' : 'Manage DXVK';

              let buttonClass =
                hasCompleteInfo || hasCompletedCustomInfo ? 'action-btn' : 'action-btn disabled';
              // Add update-btn class if the game is already patched with DXVK
              if (isPatched) {
                buttonClass += ' update-btn';
              }

              buttonHtml = '<div class="buttons-container">';
              // Add a small refresh icon if the button is for updating
              const updateIcon = isPatched
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><path d="M21 3v5h-5"></path><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"></path><path d="M8 16H3v5"></path></svg>'
                : '';
              buttonHtml += `<button class="${buttonClass}" data-game-id="${game.appid}" ${!hasCompleteInfo && !hasCompletedCustomInfo ? 'disabled' : ''}>${updateIcon}${buttonText}</button>`;

              // Add restore button if game has DXVK installed (patched), regardless of backup status
              if (isPatched) {
                const restoreIcon =
                  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><path d="M3 2v6h6"></path><path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path></svg>';
                buttonHtml += `<button class="restore-btn" data-game-id="${game.appid}">${restoreIcon}Restore Original Files</button>`;
              }

              buttonHtml += '</div>';
            }

            gameCard.innerHTML =
              gameDetails +
              additionalDetails +
              `
                                </div>
                                ${buttonHtml}
                            </div>
                        `;

            // Add event listener to the newly created button (if it exists)
            const actionBtn = gameCard.querySelector('.action-btn');
            if (actionBtn && !actionBtn.classList.contains('disabled')) {
              actionBtn.addEventListener('click', async e => {
                const gameId = e.target.getAttribute('data-game-id');
                console.log(`Managing DXVK for game with ID: ${gameId}`);

                // Show the DXVK selection modal
                await showDxvkSelectionModal(gameId, game.name, metadata);
              });
            }

            // Add event listeners to the dropdowns if they exist
            const direct3dSelector = gameCard.querySelector('.direct3d-selector');
            if (direct3dSelector) {
              direct3dSelector.addEventListener('change', async e => {
                const gameId = e.target.getAttribute('data-game-id');
                const selectedDirect3D = e.target.value;

                if (selectedDirect3D) {
                  console.log(`Selected Direct3D version ${selectedDirect3D} for game ${gameId}`);

                  // Update the game metadata
                  const metadataUpdates = {
                    direct3dVersions: selectedDirect3D,
                    custom_d3d: true,
                  };

                  if (await saveCustomGameMetadata(gameId, metadataUpdates)) {
                    // Reload the installed games tab to reflect changes
                    await initInstalledGamesTab();
                  } else {
                    alert('Failed to save Direct3D information. Please try again.');
                  }
                }
              });
            }

            const executableSelector = gameCard.querySelector('.executable-selector');
            if (executableSelector) {
              executableSelector.addEventListener('change', async e => {
                const gameId = e.target.getAttribute('data-game-id');
                const selectedExec = e.target.value;

                if (selectedExec) {
                  console.log(
                    `Selected Windows executable architecture ${selectedExec} for game ${gameId}`
                  );

                  // Update the game metadata
                  const metadataUpdates = {
                    executable32bit: selectedExec === 'x32' ? 'true' : 'false',
                    executable64bit: selectedExec === 'x64' ? 'true' : 'false',
                    custom_exec: true,
                  };

                  if (await saveCustomGameMetadata(gameId, metadataUpdates)) {
                    // Reload the installed games tab to reflect changes
                    await initInstalledGamesTab();
                  } else {
                    alert('Failed to save executable architecture information. Please try again.');
                  }
                }
              });
            }

            // Add event listener to restore button if it exists
            const restoreBtn = gameCard.querySelector('.restore-btn');
            if (restoreBtn) {
              restoreBtn.addEventListener('click', async e => {
                e.preventDefault();
                const gameId = e.target.getAttribute('data-game-id');
                const game = steamGames.find(g => g.appid === gameId);

                if (
                  confirm(
                    `Are you sure you want to restore the original DLL files for ${game.name}? This will remove DXVK.`
                  )
                ) {
                  try {
                    restoreBtn.disabled = true;
                    restoreBtn.textContent = 'Restoring...';
                    restoreBtn.classList.add('loading');

                    // Check if backup exists
                    const hasBackup = await window.electronAPI.checkBackupExists(
                      metadata.installDir
                    );
                    let result;

                    if (hasBackup) {
                      // If backup exists, restore from it
                      console.log(`Backup exists for ${game.name}, restoring from backup...`);
                      result = await window.electronAPI.restoreOriginalDlls(game);
                    } else {
                      // If no backup exists, just remove the DXVK DLLs
                      console.log(
                        `No backup found for ${game.name}, removing DXVK DLLs directly...`
                      );
                      result = await window.electronAPI.removeDxvkFromGame(game);
                    }

                    if (result.success) {
                      alert(
                        `Successfully ${hasBackup ? 'restored original DLL files' : 'removed DXVK DLLs'} for ${game.name}.`
                      );
                      // Refresh the games list to show updated status
                      await initInstalledGamesTab();
                    } else {
                      alert(`Error: ${result.message}`);
                    }
                  } catch (error) {
                    console.error('Error restoring/removing DLLs:', error);
                    alert(`Error: ${error.message}`);
                  } finally {
                    restoreBtn.disabled = false;
                    restoreBtn.textContent = 'Restore Original Files';
                    restoreBtn.classList.remove('loading');
                  }
                }
              });
            }
          }
        } catch (error) {
          console.error(`Error fetching metadata for ${game.name}:`, error);

          // Update the card with error information
          const gameCard = document.getElementById(cardId);
          if (gameCard) {
            gameCard.innerHTML = `
                            <div class="game-cover">
                                <img src="https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg" alt="${game.name}" onerror="this.src='${placeholderImage}'">
                            </div>
                            <div class="game-info">
                                <h3>${game.name}</h3>
                                <div class="game-details">
                                    <div class="detail-row">
                                        <span class="detail-label">Direct3D:</span>
                                        <span class="detail-value metadata-unknown">No info about Direct3D versions</span>
                                    </div>
                                    <div class="detail-row">
                                        <span class="detail-label">Windows exec:</span>
                                        <span class="detail-value metadata-unknown">No info about Windows executable</span>
                                    </div>
                                </div>
                                <button class="action-btn disabled" data-game-id="${game.appid}" disabled>Manage DXVK</button>
                            </div>
                        `;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error getting Steam games:', error);
    gamesContainer.innerHTML = `<p>Error loading Steam games: ${error.message}</p>`;
  }
}

// Function to create and show a modal for DXVK version selection
async function showDxvkSelectionModal(gameId, gameName, metadata) {
  try {
    // Create modal overlay if it doesn't already exist
    let modalOverlay = document.getElementById('modal-overlay');
    if (!modalOverlay) {
      modalOverlay = document.createElement('div');
      modalOverlay.id = 'modal-overlay';
      document.body.appendChild(modalOverlay);
    }

    // Get the modal elements
    modalOverlay.innerHTML = '';
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';

    // Fetch installed DXVK versions
    const installedVersions = await window.electronAPI.getInstalledDxvkVersions();

    // Get current DXVK status
    const dxvkStatus = await window.electronAPI.getGameDxvkStatus(gameId);

    // Check if we have any installed versions
    const noDxvkVersionsInstalled =
      installedVersions.dxvk.length === 0 && installedVersions.dxvkGplasync.length === 0;

    // Create modal header
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    modalHeader.innerHTML = `
            <h3>${noDxvkVersionsInstalled ? 'No DXVK Versions Available' : dxvkStatus && dxvkStatus.patched ? 'Update' : 'Apply'} ${noDxvkVersionsInstalled ? '' : 'DXVK to'} ${gameName}</h3>
            <button class="modal-close-btn">&times;</button>
        `;

    // Create modal body
    const modalBody = document.createElement('div');
    modalBody.className = 'modal-body';

    // Check if we have installed versions
    if (noDxvkVersionsInstalled) {
      modalBody.innerHTML = `
                <div class="result-message warning">
                    <h4>No DXVK Versions Installed</h4>
                    <p>You need to download at least one DXVK version before you can apply it to games.</p>
                </div>
                <div class="download-instructions">
                    <p>To download a DXVK version:</p>
                    <ol>
                        <li>Click on the <strong>"DXVK Versions"</strong> tab at the top of the window</li>
                        <li>Find a version you'd like to use (latest is recommended)</li>
                        <li>Click the <strong>"Download"</strong> button next to that version</li>
                        <li>Wait for the download to complete</li>
                        <li>Return to this game and try again</li>
                    </ol>
                </div>
                <div class="download-navigation-buttons">
                    <button class="go-to-dxvk-tab">Go to DXVK Versions Tab</button>
                </div>
            `;
    } else {
      // Create version selection UI
      let versionSelectionHTML = '<div class="dxvk-selection-container">';

      // Display DXVK versions if available
      if (installedVersions.dxvk.length > 0) {
        versionSelectionHTML += `
                    <div class="version-section">
                        <h4>DXVK Versions</h4>
                        <div class="version-list">
                `;

        installedVersions.dxvk.forEach(version => {
          // Add a class if this is the currently installed version
          const isCurrentVersion =
            dxvkStatus &&
            dxvkStatus.patched &&
            dxvkStatus.dxvk_type === 'dxvk' &&
            dxvkStatus.dxvk_version === version;

          versionSelectionHTML += `
                        <div class="version-item${isCurrentVersion ? ' current-version' : ''}" data-version="${version}" data-type="dxvk">
                            <span class="version-name">${version}</span>
                            ${isCurrentVersion ? '<span class="current-indicator">Current</span>' : ''}
                        </div>
                    `;
        });

        versionSelectionHTML += `
                        </div>
                    </div>
                `;
      }

      // Display DXVK-gplasync versions if available
      if (installedVersions.dxvkGplasync.length > 0) {
        versionSelectionHTML += `
                    <div class="version-section">
                        <h4>DXVK-gplasync Versions</h4>
                        <div class="version-list">
                `;

        installedVersions.dxvkGplasync.forEach(version => {
          // Add a class if this is the currently installed version
          const isCurrentVersion =
            dxvkStatus &&
            dxvkStatus.patched &&
            dxvkStatus.dxvk_type === 'dxvk-gplasync' &&
            dxvkStatus.dxvk_version === version;

          versionSelectionHTML += `
                        <div class="version-item${isCurrentVersion ? ' current-version' : ''}" data-version="${version}" data-type="dxvk-gplasync">
                            <span class="version-name">${version}</span>
                            ${isCurrentVersion ? '<span class="current-indicator">Current</span>' : ''}
                        </div>
                    `;
        });

        versionSelectionHTML += `
                        </div>
                    </div>
                `;
      }

      versionSelectionHTML += '</div>';

      // Game info section - now including current DXVK status if patched
      versionSelectionHTML += `
                <div class="game-info-section">
                    <h4>Game Information</h4>
                    <div class="game-info-details">
                        <div>Direct3D:</div>
                        <div>${metadata.direct3dVersions || 'Unknown'}</div>
                        
                        <div>Architecture:</div>
                        <div>${metadata.executable64bit === 'true' ? '64-bit' : metadata.executable32bit === 'true' ? '32-bit' : 'Unknown'}</div>`;

      // Include current DXVK status if the game is patched
      if (dxvkStatus && dxvkStatus.patched) {
        versionSelectionHTML += `
                        <div>Current DXVK:</div>
                        <div>${dxvkStatus.dxvk_type} ${dxvkStatus.dxvk_version}</div>
                        
                        <div>Applied on:</div>
                        <div>${new Date(dxvkStatus.dxvk_timestamp).toLocaleString()}</div>
                        
                        <div>Backup:</div>
                        <div>${dxvkStatus.backuped ? 'Yes' : 'No'}</div>`;
      }

      versionSelectionHTML += `
                    </div>
                </div>
            `;

      modalBody.innerHTML = versionSelectionHTML;
    }

    // Create modal footer
    const modalFooter = document.createElement('div');
    modalFooter.className = 'modal-footer';

    if (noDxvkVersionsInstalled) {
      // Just a close button for the no versions case
      const closeBtn = document.createElement('button');
      closeBtn.className = 'cancel-btn';
      closeBtn.textContent = 'Close';
      modalFooter.appendChild(closeBtn);

      // Close button event
      closeBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
        setTimeout(() => {
          modalOverlay.remove();
        }, 300);
      });
    } else {
      // Apply button is disabled initially
      const applyBtn = document.createElement('button');
      applyBtn.className = 'apply-dxvk-btn disabled';
      applyBtn.textContent =
        dxvkStatus && dxvkStatus.patched ? 'Update Selected Version' : 'Apply Selected Version';
      applyBtn.disabled = true;

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'cancel-btn';
      cancelBtn.textContent = 'Cancel';

      modalFooter.appendChild(applyBtn);
      modalFooter.appendChild(cancelBtn);

      // Cancel button event
      cancelBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('active');
        setTimeout(() => {
          modalOverlay.remove();
        }, 300);
      });

      // Version selection
      const versionItems = modalBody.querySelectorAll('.version-item');
      let selectedVersion = null;
      let selectedType = null;

      versionItems.forEach(item => {
        item.addEventListener('click', () => {
          // Remove selected class from all items
          versionItems.forEach(i => i.classList.remove('selected'));

          // Add selected class to clicked item
          item.classList.add('selected');

          // Update selected version and type
          selectedVersion = item.getAttribute('data-version');
          selectedType = item.getAttribute('data-type');

          // Enable apply button
          applyBtn.classList.remove('disabled');
          applyBtn.disabled = false;
        });
      });

      // Apply button
      applyBtn.addEventListener('click', async () => {
        if (!selectedVersion || !selectedType) {
          return;
        }

        // Disable the apply button and show loading state
        applyBtn.disabled = true;
        applyBtn.textContent = 'Applying...';
        applyBtn.classList.add('loading');

        try {
          // Apply DXVK to the game
          const result = await window.electronAPI.applyDxvkToGame(
            gameId,
            selectedType,
            selectedVersion
          );

          // Update modal to show result
          modalBody.innerHTML = '';

          if (result.success) {
            // Success message
            modalBody.innerHTML = `
                            <div class="result-message success">
                                <h4>Success!</h4>
                                <p>${result.message}</p>
                                ${result.warning ? `<p class="warning">${result.warning}</p>` : ''}
                            </div>
                        `;
          } else {
            // Error message
            modalBody.innerHTML = `
                            <div class="result-message error">
                                <h4>Error</h4>
                                <p>${result.message}</p>
                            </div>
                        `;
          }

          // Update footer buttons
          modalFooter.innerHTML = '';
          const closeBtn = document.createElement('button');
          closeBtn.className = 'close-btn';
          closeBtn.textContent = 'Close';
          modalFooter.appendChild(closeBtn);

          closeBtn.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
            setTimeout(() => {
              modalOverlay.remove();

              // Refresh the game card to show updated DXVK status
              if (result.success) {
                // Force a reload of the games tab to refresh the DXVK status
                initInstalledGamesTab();
              }
            }, 300);
          });
        } catch (error) {
          console.error('Error applying DXVK:', error);
          modalBody.innerHTML = `
                        <div class="result-message error">
                            <h4>Error</h4>
                            <p>An error occurred while applying DXVK: ${error.message}</p>
                        </div>
                    `;

          // Update footer buttons
          modalFooter.innerHTML = '';
          const closeBtn = document.createElement('button');
          closeBtn.className = 'close-btn';
          closeBtn.textContent = 'Close';
          modalFooter.appendChild(closeBtn);

          closeBtn.addEventListener('click', () => {
            modalOverlay.classList.remove('active');
            setTimeout(() => modalOverlay.remove(), 300);
          });
        }
      });
    }

    // Combine all modal elements
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(modalBody);
    modalContent.appendChild(modalFooter);
    modalOverlay.appendChild(modalContent);

    // Show modal
    modalOverlay.classList.add('active');

    // Event listeners for modal

    // Close button
    const closeBtn = modalHeader.querySelector('.modal-close-btn');
    closeBtn.addEventListener('click', () => {
      modalOverlay.classList.remove('active');
      setTimeout(() => {
        modalOverlay.remove();
      }, 300);
    });

    // Navigate to DXVK tab button (only present when no versions installed)
    const goToDxvkTabBtn = modalBody.querySelector('.go-to-dxvk-tab');
    if (goToDxvkTabBtn) {
      goToDxvkTabBtn.addEventListener('click', () => {
        // Close the modal
        modalOverlay.classList.remove('active');
        setTimeout(() => {
          modalOverlay.remove();
        }, 300);

        // Activate the DXVK versions tab
        const dxvkTab = document.querySelector('.tab-button[data-tab="dxvk-versions"]');
        if (dxvkTab) {
          dxvkTab.click();
        }
      });
    }
  } catch (error) {
    console.error('Error showing DXVK selection modal:', error);
    alert(`Error: ${error.message}`);
  }
}

// Initialize the "DXVK Versions" tab
async function initDxvkVersionsTab() {
  const dxvkContainer = document.querySelector('#dxvk-versions .content-area');
  dxvkContainer.innerHTML = `
        <div class="loading-indicator">
            <div class="spinner"></div>
            <p>Loading DXVK versions from GitHub...</p>
        </div>
    `;

  try {
    // Verify the electronAPI exists before calling it
    if (!window.electronAPI) {
      throw new Error('Electron API not available. IPC bridge may not be properly configured.');
    }

    // Get DXVK releases from the main process
    const dxvkReleases = await window.electronAPI.getDxvkReleases();

    if (dxvkReleases.length === 0) {
      dxvkContainer.innerHTML =
        '<p>No DXVK releases found. There might be a problem connecting to GitHub or fetching the releases.</p>';
    } else {
      // Create a table to display the DXVK versions
      let dxvkTableHTML = `
                <div class="dxvk-releases-container">
                    <table class="dxvk-table">
                        <thead>
                            <tr>
                                <th>Version</th>
                                <th>Release Date</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

      // Add rows for each DXVK version
      for (const release of dxvkReleases) {
        const releaseDate = formatDate(release.date);
        const status = release.isDownloaded
          ? '<span class="status-downloaded">Downloaded</span>'
          : '<span class="status-not-downloaded">Not Downloaded</span>';

        const actionBtn = release.isDownloaded
          ? `<button class="action-btn disabled" disabled>Downloaded</button>`
          : `<button class="action-btn download-btn" data-version="${release.version}" data-url="${release.downloadUrl}">Download</button>`;

        dxvkTableHTML += `
                    <tr>
                        <td>${release.version}</td>
                        <td>${releaseDate}</td>
                        <td>${status}</td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
      }

      dxvkTableHTML += `
                        </tbody>
                    </table>
                </div>
            `;

      dxvkContainer.innerHTML = dxvkTableHTML;

      // Add event listeners to download buttons
      const downloadButtons = dxvkContainer.querySelectorAll('.download-btn');
      downloadButtons.forEach(button => {
        button.addEventListener('click', async e => {
          const version = e.target.getAttribute('data-version');
          const downloadUrl = e.target.getAttribute('data-url');

          // Update button state to show downloading
          e.target.textContent = 'Downloading...';
          e.target.disabled = true;
          e.target.classList.add('downloading');

          try {
            // Call the main process to download the DXVK version
            const success = await window.electronAPI.downloadDxvkVersion(version, downloadUrl);

            if (success) {
              // Update button to show success
              e.target.textContent = 'Downloaded';
              e.target.classList.remove('downloading');
              e.target.classList.add('disabled');

              // Update status cell
              const statusCell = e.target.parentElement.previousElementSibling;
              statusCell.innerHTML = '<span class="status-downloaded">Downloaded</span>';
            } else {
              // Update button to show failure
              e.target.textContent = 'Failed - Retry';
              e.target.disabled = false;
              e.target.classList.remove('downloading');
              e.target.classList.add('failed');
            }
          } catch (error) {
            console.error(`Error downloading DXVK version ${version}:`, error);

            // Update button to show failure
            e.target.textContent = 'Failed - Retry';
            e.target.disabled = false;
            e.target.classList.remove('downloading');
            e.target.classList.add('failed');
          }
        });
      });
    }
  } catch (error) {
    console.error('Error getting DXVK releases:', error);
    dxvkContainer.innerHTML = `<p>Error loading DXVK releases: ${error.message}</p>`;
  }
}

// Initialize the "DXVK-gplasync Versions" tab
async function initDxvkGplasyncTab() {
  const gplasyncContainer = document.querySelector('#dxvk-gplasync .content-area');
  gplasyncContainer.innerHTML = `
        <div class="loading-indicator">
            <div class="spinner"></div>
            <p>Loading DXVK-gplasync versions from GitLab...</p>
        </div>
    `;

  try {
    // Verify the electronAPI exists before calling it
    if (!window.electronAPI) {
      throw new Error('Electron API not available. IPC bridge may not be properly configured.');
    }

    // Get DXVK-gplasync releases from the main process
    const gplasyncReleases = await window.electronAPI.getGplasyncReleases();

    if (gplasyncReleases.length === 0) {
      gplasyncContainer.innerHTML =
        '<p>No DXVK-gplasync releases found. There might be a problem connecting to GitLab or fetching the releases.</p>';
    } else {
      // Create a table to display the DXVK-gplasync versions
      let gplasyncTableHTML = `
                <div class="dxvk-releases-container">
                    <table class="dxvk-table">
                        <thead>
                            <tr>
                                <th>Version</th>
                                <th>Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
            `;

      // Add rows for each DXVK-gplasync version
      for (const release of gplasyncReleases) {
        const status = release.isDownloaded
          ? '<span class="status-downloaded">Downloaded</span>'
          : '<span class="status-not-downloaded">Not Downloaded</span>';

        const actionBtn = release.isDownloaded
          ? `<button class="action-btn disabled" disabled>Downloaded</button>`
          : `<button class="action-btn download-btn" data-version="${release.version}" data-url="${release.downloadUrl}">Download</button>`;

        gplasyncTableHTML += `
                    <tr>
                        <td>${release.version}</td>
                        <td>${status}</td>
                        <td>${actionBtn}</td>
                    </tr>
                `;
      }

      gplasyncTableHTML += `
                        </tbody>
                    </table>
                </div>
            `;

      gplasyncContainer.innerHTML = gplasyncTableHTML;

      // Add event listeners to download buttons
      const downloadButtons = gplasyncContainer.querySelectorAll('.download-btn');
      downloadButtons.forEach(button => {
        button.addEventListener('click', async e => {
          const version = e.target.getAttribute('data-version');
          const downloadUrl = e.target.getAttribute('data-url');

          console.log(`Starting download of DXVK-gplasync version: ${version}`);
          console.log(`Download URL: ${downloadUrl}`);

          // Update button state to show downloading
          e.target.textContent = 'Downloading...';
          e.target.disabled = true;
          e.target.classList.add('downloading');

          try {
            // Call the main process to download the DXVK-gplasync version
            const success = await window.electronAPI.downloadGplasyncVersion(version, downloadUrl);

            if (success) {
              // Update button to show success
              e.target.textContent = 'Downloaded';
              e.target.classList.remove('downloading');
              e.target.classList.add('disabled');

              // Update status cell
              const statusCell = e.target.parentElement.previousElementSibling;
              statusCell.innerHTML = '<span class="status-downloaded">Downloaded</span>';
            } else {
              // Update button to show failure
              e.target.textContent = 'Failed - Retry';
              e.target.disabled = false;
              e.target.classList.remove('downloading');
              e.target.classList.add('failed');
            }
          } catch (error) {
            console.error(`Error downloading DXVK-gplasync version ${version}:`, error);

            // Update button to show failure
            e.target.textContent = 'Failed - Retry';
            e.target.disabled = false;
            e.target.classList.remove('downloading');
            e.target.classList.add('failed');
          }
        });
      });
    }
  } catch (error) {
    console.error('Error getting DXVK-gplasync releases:', error);
    gplasyncContainer.innerHTML = `<p>Error loading DXVK-gplasync releases: ${error.message}</p>`;
  }
}
