/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** API URL - Your Matsu backend API URL (e.g., http://localhost:8000 or https://your-domain.com) */
  "apiUrl": string,
  /** Username - Your Matsu username */
  "username": string,
  /** Password - Your Matsu password */
  "password": string,
  /** Custom Monitor Order - Comma-separated monitor IDs to define custom sort order (e.g., monitor1,monitor2,monitor3). Monitors not listed will appear after in alphabetical order. */
  "monitorOrder"?: string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `menu-bar` command */
  export type MenuBar = ExtensionPreferences & {
  /** Menu Bar Monitors - Comma-separated monitor IDs to display in menu bar (e.g., monitor1,monitor2) */
  "menuBarMonitors"?: string,
  /** Display Mode - How to display monitors in the menu bar */
  "menuBarDisplayMode": "iconOnly" | "iconAndValue" | "iconNameValue",
  /** Refresh Interval - How often to refresh the menu bar */
  "menuBarRefreshInterval": "30s" | "1m" | "5m"
}
  /** Preferences accessible in the `list-monitors` command */
  export type ListMonitors = ExtensionPreferences & {}
  /** Preferences accessible in the `view-alerts` command */
  export type ViewAlerts = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `menu-bar` command */
  export type MenuBar = {}
  /** Arguments passed to the `list-monitors` command */
  export type ListMonitors = {}
  /** Arguments passed to the `view-alerts` command */
  export type ViewAlerts = {}
}

