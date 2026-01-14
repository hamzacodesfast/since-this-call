# Security Best Practices for AI-Assisted Development

## Core Principles

- **Keep API keys server-side** - Never expose in client code
- **.env files aren't enough** - They prevent Git commits but not client exposure
- **Server-side calculations** - Avoid client-side logic for prices or sensitive data
- **Sanitize all inputs** - Prevent injection attacks
- **Rate limiting** - Stop abuse from rapid requests
- **No sensitive logging** - Avoid logging passwords, tokens, emails
- **Cross-AI audits** - Review code with different AI models
- **Update dependencies** - Patch known exploits regularly
- **Vague error messages** - Hide details from users, log privately

## SinceThisCall Checklist

When building new features:

1. [ ] Use API routes, not direct DB access from frontend
2. [ ] Verify no API keys in client bundles
3. [ ] Sanitize tweet URLs and user inputs
4. [ ] Add rate limiting if needed
5. [ ] Keep calculations server-side
6. [ ] Audit with secondary AI before merging

Source: https://arxiv.org/html/2512.03262v1
