# Quick Start Guide

## Installation Steps

### 1. Copy Extension to Your Mac

Copy the entire `matsu-raycast-extension` folder to your Mac:

```bash
# Example: Using scp or any file transfer method
scp -r matsu-raycast-extension/ your-mac:/path/to/extensions/
```

Or clone from a repository if you've pushed it to GitHub.

### 2. Install Dependencies

On your Mac, navigate to the extension directory and install dependencies:

```bash
cd matsu-raycast-extension
npm install
```

### 3. Start Development Mode

Run the extension in development mode:

```bash
npm run dev
```

This will automatically import the extension into Raycast.

### 4. Configure Extension

1. Open Raycast (Cmd+Space or your configured hotkey)
2. Type "Matsu" to find the extension
3. Press `Cmd+K` and select "Configure Extension"
4. Set the following:
   - **API URL**: Your Matsu backend URL
     - Local: `http://localhost:8000`
     - Remote: `https://your-domain.com`
   - **Username**: Your Matsu username (e.g., `admin`)
   - **Password**: Your Matsu password

### 5. Use the Extension

#### List All Monitors
- Open Raycast
- Type "List Monitors"
- Press Enter
- You'll see all your monitors with real-time values

#### View Active Alerts
- Open Raycast
- Type "View Alerts"
- Press Enter
- See all configured alerts and which ones are currently triggered

## Common Issues

### "Cannot find module" error

Make sure you ran `npm install` in the extension directory.

### "API request failed" error

1. Check that your Matsu backend is running
2. Verify the API URL in extension preferences
3. Test the URL in your browser: `http://your-api-url/api/monitors`
4. Make sure there's no trailing slash in the API URL

### Authentication failed

1. Verify username and password are correct
2. Test login in the web interface first
3. Re-enter credentials in Raycast extension preferences

### Extension not appearing in Raycast

1. Make sure you ran `npm run dev`
2. Restart Raycast: `Cmd+Q` then reopen
3. Check for TypeScript errors in the terminal

## Development

### Making Changes

1. Edit the TypeScript files in `src/`
2. Save the file
3. Raycast will automatically reload the extension
4. Test your changes

### Debugging

Check the terminal where you ran `npm run dev` for error messages and logs.

## Next Steps

Once everything is working:

1. Try the keyboard shortcuts:
   - `Cmd+R` to refresh data
   - `Cmd+O` to open in browser
   - `Cmd+C` to copy values

2. Pin frequently used monitors to Raycast favorites

3. Set up Raycast hotkeys for quick access

## Need Help?

- Check the main README.md for detailed documentation
- Review the API endpoints in `src/api.ts`
- Look at the Raycast API docs: https://developers.raycast.com
