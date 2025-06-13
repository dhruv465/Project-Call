# Security Guide for Lumina Outreach

This document outlines security best practices for developers working on the Lumina Outreach project.

## Environment Variables and Secrets

### Rules for Environment Variables
1. **Never commit `.env` files to the repository**
   - The `.env` file contains sensitive information such as API keys, database credentials, and JWT secrets
   - Always use `.env.example` as a template with placeholder values

2. **Use the pre-commit hook**
   - A pre-commit hook is installed to prevent accidental commits of sensitive files
   - If you need to bypass it for legitimate reasons, use `git commit --no-verify`, but be extremely careful

3. **Rotate credentials if exposed**
   - If you accidentally expose credentials (like committing an `.env` file), immediately:
     - Rotate all affected credentials (change passwords, regenerate API keys)
     - Remove the sensitive data from Git history (see section below)

### Setting Up Environment Variables
1. Run the `setup-env.sh` script to create your initial `.env` file
2. Replace all placeholder values with actual credentials
3. Keep your `.env` file secure and do not share it

### Removing Sensitive Data from Git History
If sensitive data is accidentally committed to the repository, you can remove it from the Git history using BFG Repo-Cleaner or git-filter-repo:

```bash
# Using BFG (https://rtyley.github.io/bfg-repo-cleaner/)
brew install bfg
bfg --replace-text sensitive-data.txt my-repo.git

# Using git-filter-repo (https://github.com/newren/git-filter-repo)
pip install git-filter-repo
git-filter-repo --path path/to/file --invert-paths
```

Remember to notify all team members after cleaning the repository, as they will need to clone a fresh copy.

## API Keys and Authentication

1. **Use environment variables for API keys**
   - Never hardcode API keys in source code
   - Use environment variables to access API keys in code

2. **Implement proper authentication**
   - Use JWT tokens with proper expiration
   - Implement CSRF protection
   - Use HTTPS for all API endpoints

3. **Implement rate limiting**
   - Protect your API endpoints from brute force attacks

## Dependency Security

1. **Regularly update dependencies**
   - Run `npm audit` regularly to check for vulnerabilities
   - Update dependencies to fix known security issues

2. **Use lock files**
   - Commit `package-lock.json` to ensure consistent dependency versions

## Production Deployment

1. **Use environment-specific configurations**
   - Separate development and production configurations
   - Use stronger security settings in production

2. **Secure server configuration**
   - Configure proper CORS settings
   - Use a reverse proxy like Nginx
   - Implement proper firewall rules

3. **Monitor for security issues**
   - Set up logging and alerting
   - Regularly review logs for suspicious activity

## Reporting Security Issues

If you discover a security vulnerability, please do NOT open a public issue. Instead:

1. Email the security team directly at [security@example.com]
2. Include detailed information about the vulnerability
3. If possible, include steps to reproduce the issue

The security team will acknowledge receipt of your report within 24 hours and will send you regular updates about its progress.

---

This guide is a living document and will be updated as security practices evolve. All team members are encouraged to contribute to its improvement.
