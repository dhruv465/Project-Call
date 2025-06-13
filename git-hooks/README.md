# Git Hooks

This directory contains Git hooks that help maintain code quality and prevent accidental commits of sensitive information.

## Installation

To install these hooks, run the following command from the project root:

```bash
# Unix/macOS
cp -f git-hooks/* .git/hooks/
chmod +x .git/hooks/*

# Windows (using Git Bash)
cp -f git-hooks/* .git/hooks/
```

## Available Hooks

- **pre-commit**: Prevents committing sensitive files like .env or files containing API keys, passwords, etc.

## Bypassing Hooks

If you need to bypass a hook for a legitimate reason, you can use the `--no-verify` flag:

```bash
git commit --no-verify -m "Your commit message"
```

However, please use this with caution and ensure you're not committing sensitive information.
