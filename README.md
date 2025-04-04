# DXVK Version Manager

![Build Status](https://img.shields.io/github/actions/workflow/status/artmakh/dxvk-version-mananger/release-please.yml)
![Release](https://img.shields.io/github/v/release/artmakh/dxvk-version-mananger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Windows utility to manage versions of DXVK in installed games.

![](https://github.com/artmakh/dxvk-version-mananger/blob/main/.github/demo.gif)

## Features

- **Steam Game Integration**: Automatically detects installed Steam games
- **DXVK Version Management**: Download and install different DXVK versions
- **DXVK-gplasync Support**: Install async versions of DXVK for improved performance
- **Backup and Restore**: Easily revert back to original DirectX DLLs
- **Game Compatibility Information**: Shows DirectX versions used by each game

## Installation

### Option 1: Download the Latest Release

1. Go to the [Releases page](https://github.com/artmakh/dxvk-version-mananger/releases)
2. Download the latest `DXVK-Version-Manager-[version].exe` file
4. Run `DXVK-Version-Manager-[version].exe` inside the extracted folder

### Option 2: Build from Source

```bash
# Clone the repository
git clone https://github.com/artmakh/dxvk-version-mananger.git

# Navigate to the project directory
cd dxvk-version-mananger

# Install dependencies
npm install

# Create a distribution package
npm run build
```

## Usage

1. Launch the application
2. Navigate to the "DXVK Versions" or "DXVK-gplasync Versions" tab
3. Download the desired version(s)
4. Go to the "Installed Games" tab
5. Find the game you want to modify
6. Click "Manage DXVK" button on a game card
7. Select the DXVK version you want to apply
8. The application will backup original DLLs and apply DXVK

To revert back to original files, click the "Restore Original Files" button on games that have backups.

## Development

### Project Structure

The project follows a standard Electron application structure:

```
dxvk-version-manager/
├── src/
│   ├── main/             # Main process files
│   ├── renderer/         # Renderer process files
│   │   ├── assets/       # Images and other assets
│   │   ├── styles/       # CSS files
│   ├── preload/          # Preload scripts
│   └── common/           # Shared code between processes
├── .eslintrc.json        # ESLint configuration
├── .prettierrc           # Prettier configuration
└── package.json          # Project metadata and dependencies
```

### Development Scripts

- `npm start` - Start the application in development mode
- `npm run lint` - Run ESLint to check code quality
- `npm run lint:fix` - Run ESLint and automatically fix issues
- `npm run format` - Run Prettier to format code
- `npm run build` - Create distribution packages for the application

### Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Message Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages:

- `feat:` - A new feature
- `fix:` - A bug fix
- `docs:` - Documentation changes
- `style:` - Changes that do not affect the meaning of the code
- `refactor:` - Code changes that neither fix a bug nor add a feature
- `perf:` - Performance improvements
- `test:` - Adding or correcting tests
- `chore:` - Changes to the build process or auxiliary tools

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
