# Matsu Companion

A Raycast extension for monitoring your Matsu data and alerts.

## Features

- **Menu Bar Monitor**: Display key metrics in your macOS menu bar with auto-rotation
- **Monitors View**: Browse all your monitoring items with sorting and filtering
- **Alerts View**: Track active alerts and threshold breaches
- **Local Customization**: Add custom aliases and tags to organize your monitors

## Installation

### Prerequisites

- [Raycast](https://www.raycast.com/) installed on macOS
- Node.js 16 or higher
- A running Matsu backend instance

### Setup

1. Clone this repository:
```bash
git clone https://github.com/YOUR_USERNAME/matsu-companion.git
cd matsu-companion
```

2. Install dependencies:
```bash
npm install
```

3. Start development mode:
```bash
npm run dev
```

4. Configure the extension in Raycast:
   - Open Raycast preferences (⌘ + ,)
   - Go to Extensions
   - Find "Matsu" and click the gear icon
   - Set your Matsu API URL, username, and password

## Configuration

### Extension Settings

- **API URL**: Your Matsu backend URL (e.g., `http://localhost:8000`)
- **Username**: Your Matsu username
- **Password**: Your Matsu password
- **Custom Monitor Order**: Comma-separated monitor IDs for custom sorting

### Menu Bar Settings

- **Menu Bar Monitors**: Comma-separated monitor IDs to pin in the menu bar
- **Display Mode**: Choose how to display values (Icon Only, Icon + Value, Icon + Name + Value)
- **Refresh Interval**: How often to update data (30s, 1m, 5m)

## Commands

### Menu Bar Monitor
Displays selected monitors in your macOS menu bar. Supports:
- Auto-rotation between pinned monitors
- Alert indicators
- Tag-based grouping
- Quick access to all monitors

### Monitors
View and manage all monitoring items:
- Sort by name, value, last updated, alert status, or custom order
- Add local aliases for custom names
- Organize with tags
- Edit alert thresholds
- Manage constant cards

### Alerts
View all configured alerts:
- See active vs. configured alerts
- Sort by status, name, value, or alert level
- Quick access to monitor details

## Development

```bash
# Start development mode
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Fix linting issues
npm run fix-lint
```

### Project Structure

```
matsu-companion/
├── src/
│   ├── api.ts              # API client
│   ├── utils.ts            # Utilities
│   ├── menu-bar.tsx        # Menu bar command
│   ├── list-monitors.tsx   # Monitors command
│   ├── view-alerts.tsx     # Alerts command
│   ├── monitor-detail.tsx  # Monitor details view
│   └── local-aliases.ts    # Local storage for aliases/tags
├── assets/
│   └── icon.png            # Extension icon
├── package.json            # Extension manifest
└── README.md               # This file
```

## License

MIT

## Author

giraphant
