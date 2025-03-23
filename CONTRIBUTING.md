# Contributing to DXVK Version Manager

Thank you for your interest in contributing to DXVK Version Manager! This document provides guidelines and instructions for contributing to this project.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment
4. Make your changes in a new branch
5. Test your changes
6. Submit a pull request

## Commit Message Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) to make our commit history more readable and to automate versioning and release notes.

### Format

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing or correcting existing tests
- `build`: Changes that affect the build system or external dependencies
- `ci`: Changes to our CI configuration files and scripts
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverts a previous commit

### Examples

```
feat: add support for DXVK 2.0
fix: correct path handling on Windows
docs: update installation instructions
style: format code with prettier
refactor: reorganize DXVK application logic
perf: improve DXVK dll copying speed
test: add tests for DXVK version detection
build: update Electron to version 28
ci: add GitHub Actions workflow
chore: update dependencies
revert: remove broken feature
```

## Pull Request Process

1. Ensure your code adheres to the project's coding standards
2. Make sure your PR title follows the conventional commit format
3. Update documentation as needed
4. Add tests for new features
5. Your PR needs to pass all CI checks before it can be merged

## Development Setup

1. Install Node.js (version 18 or later)
2. Install npm dependencies:
   ```
   npm install
   ```
3. Run the application in development mode:
   ```
   npm start
   ```
4. Build the application:
   ```
   npm run make
   ```

## Code of Conduct

Please note that this project adheres to a Code of Conduct. By participating, you are expected to uphold this code.

## Questions?

If you have any questions or need help, please open an issue on GitHub. 