# Security Policy

AgenticRepo handles GitHub tokens, webhook secrets, provider keys, and repository automation. Treat all deployments as security-sensitive.

## Supported Versions

The current `main` branch is the supported development line.

## Reporting a Vulnerability

Please report security issues privately to the project maintainer before public disclosure.

Include:

- A clear description of the vulnerability.
- Reproduction steps.
- Impacted routes, commands, or workflows.
- Whether credentials, repository write access, or webhook verification are involved.

## Security Expectations

- Do not commit `.env`, `.env.local`, private keys, tokens, or webhook secrets.
- Keep GitHub App private keys in secure environment variables.
- Configure GitHub webhook signature verification.
- Use least-privilege GitHub permissions.
- Review every generated pull request before merging.
- Do not modify the controlled terminal to execute arbitrary shell commands.

## Automation Safety

AgenticRepo automation should remain:

- Deterministic where repository files are modified.
- Pull-request based.
- Auditable through activity events, incidents, and logs.
- Limited to explicitly supported commands.
