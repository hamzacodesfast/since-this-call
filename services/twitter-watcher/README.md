# Twitter Watcher

Browser-based Twitter monitoring service for Since This Call.

## Setup

```bash
cd services/twitter-watcher
npm install
```

## Usage

### 1. First-time Login
```bash
npm run login
```
A browser window will open. Log into Twitter, then close the browser. Your session is saved.

### 2. Start Watching
```bash
npm run watch          # Headless mode
npm run watch:visible  # See the browser
npm run watch:dry      # Test without submitting
```

### 3. Stop
Press `Ctrl+C` to stop gracefully.

## Configuration

Edit `config.ts` to:
- Change `targetUrl` to a specific Twitter List
- Adjust `pollInterval` (default: 30s)
- Add trigger patterns
