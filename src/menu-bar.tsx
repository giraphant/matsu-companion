import {
  MenuBarExtra,
  open,
  Icon,
  Color,
  getPreferenceValues,
  openCommandPreferences,
  openExtensionPreferences,
  launchCommand,
  LaunchType,
} from "@raycast/api";
import { useCachedPromise } from "@raycast/utils";
import React, { useState, useEffect } from "react";
import { api, MonitorSummary, AlertConfig } from "./api";
import { formatValue, formatTimeSince, isValueOutOfRange, getAlertLevelEmoji } from "./utils";
import { getAllAliases, getDisplayName, getAllTags } from "./local-aliases";

interface MenuBarPreferences {
  menuBarMonitors?: string;
  monitorOrder?: string;
  menuBarDisplayMode?: "iconOnly" | "iconAndValue" | "iconNameValue";
}

export default function MenuBar() {
  const preferences = getPreferenceValues<MenuBarPreferences>();
  const monitorIds = preferences.menuBarMonitors
    ?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0) || [];
  const customOrder = preferences.monitorOrder
    ?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0) || [];

  // Rotation state for pinned monitors
  const [currentIndex, setCurrentIndex] = useState(0);

  const {
    data: monitors,
    isLoading: monitorsLoading,
    revalidate: revalidateMonitors,
  } = useCachedPromise(
    async () => {
      return await api.getMonitors();
    },
    [],
    {
      keepPreviousData: true, // Keep showing old data while loading new data
    }
  );

  const {
    data: alertConfigs,
    isLoading: alertsLoading,
    revalidate: revalidateAlerts,
  } = useCachedPromise(
    async () => {
      try {
        return await api.getAlertConfigs();
      } catch (error) {
        // Alert configs may not be available, return empty array
        console.warn("Failed to load alert configs:", error);
        return [];
      }
    },
    [],
    {
      keepPreviousData: true,
    }
  );

  const {
    data: aliases,
    isLoading: aliasesLoading,
  } = useCachedPromise(
    async () => {
      return await getAllAliases();
    },
    [],
    {
      keepPreviousData: true,
    }
  );

  const {
    data: localTags,
    isLoading: tagsLoading,
  } = useCachedPromise(
    async () => {
      return await getAllTags();
    },
    [],
    {
      keepPreviousData: true,
    }
  );

  // Only show loading on initial load, not on refresh
  const isLoading = (monitorsLoading || alertsLoading || aliasesLoading || tagsLoading) && !monitors;

  // Convert alert configs to map
  const alerts = alertConfigs
    ? new Map(alertConfigs.map((config) => [config.monitor_id, config]))
    : new Map<string, AlertConfig>();

  // Sort function following custom order
  const sortByCustomOrder = (items: MonitorSummary[]) => {
    if (customOrder.length === 0) {
      // No custom order, sort by name
      return [...items].sort((a, b) => {
        const nameA = (a.monitor_name || a.monitor_id || "").toLowerCase();
        const nameB = (b.monitor_name || b.monitor_id || "").toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }

    return [...items].sort((a, b) => {
      const indexA = customOrder.indexOf(a.monitor_id);
      const indexB = customOrder.indexOf(b.monitor_id);

      // If both are in custom order, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      // If only A is in custom order, it comes first
      if (indexA !== -1) return -1;
      // If only B is in custom order, it comes first
      if (indexB !== -1) return 1;
      // If neither is in custom order, sort by name
      const nameA = (a.monitor_name || a.monitor_id || "").toLowerCase();
      const nameB = (b.monitor_name || b.monitor_id || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });
  };

  // Filter pinned monitors (keep the order as specified in menuBarMonitors)
  const pinnedMonitors = monitorIds
    .map((id) => monitors?.find((m) => m.monitor_id === id))
    .filter((m): m is MonitorSummary => m !== undefined);

  // All monitors for tag grouping (sorted by custom order)
  const allMonitorsForTags = sortByCustomOrder(monitors || []);

  // Rotation logic for pinned monitors
  useEffect(() => {
    if (pinnedMonitors.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % pinnedMonitors.length);
    }, 3000); // Rotate every 3 seconds

    return () => clearInterval(interval);
  }, [pinnedMonitors.length]);

  // Get current monitor for title display (rotates if multiple pinned)
  const primaryMonitor = pinnedMonitors.length > 0 ? pinnedMonitors[currentIndex % pinnedMonitors.length] : undefined;
  const primaryAlertConfig = primaryMonitor ? alerts.get(primaryMonitor.monitor_id) : undefined;
  const isPrimaryBreached = primaryMonitor && primaryAlertConfig
    ? isValueOutOfRange(
        primaryMonitor.latest_value,
        primaryAlertConfig.upper_threshold,
        primaryAlertConfig.lower_threshold
      )
    : false;

  // Count active alerts
  const activeAlertsCount = monitors?.filter((monitor) => {
    const alertConfig = alerts.get(monitor.monitor_id);
    return alertConfig && isValueOutOfRange(
      monitor.latest_value,
      alertConfig.upper_threshold,
      alertConfig.lower_threshold
    );
  }).length || 0;

  // Generate title based on display mode
  const getTitle = () => {
    const displayMode = preferences.menuBarDisplayMode || "iconAndValue";

    if (!primaryMonitor) return undefined; // No title if no monitor configured
    if (isLoading) return "...";

    const localAlias = aliases?.[primaryMonitor.monitor_id];
    const displayName = getDisplayName(primaryMonitor.monitor_name, primaryMonitor.monitor_id, localAlias);
    const value = formatValue(primaryMonitor.latest_value, primaryMonitor.unit);
    const emoji = isPrimaryBreached && primaryAlertConfig
      ? getAlertLevelEmoji(primaryAlertConfig.alert_level)
      : "";

    switch (displayMode) {
      case "iconOnly":
        return emoji || undefined; // Only show emoji if there's an alert, otherwise no title
      case "iconAndValue":
        return `${emoji} ${value}`.trim();
      case "iconNameValue":
        return `${emoji} ${displayName}: ${value}`.trim();
      default:
        return `${emoji} ${value}`.trim();
    }
  };

  // Get icon - red if there are active alerts
  const getMenuBarIcon = () => {
    if (activeAlertsCount > 0) {
      return { source: Icon.ExclamationMark, tintColor: Color.Red };
    }
    return Icon.LineChart;
  };

  // Get tooltip
  const getTooltip = () => {
    if (activeAlertsCount > 0) {
      return `⚠️ ${activeAlertsCount} active alert${activeAlertsCount > 1 ? 's' : ''}`;
    }
    if (primaryMonitor) {
      return `${primaryMonitor.monitor_name || primaryMonitor.monitor_id}`;
    }
    return "Matsu Monitor";
  };

  const getMonitorIcon = (monitor: MonitorSummary) => {
    const alertConfig = alerts.get(monitor.monitor_id);
    const isBreached = alertConfig
      ? isValueOutOfRange(monitor.latest_value, alertConfig.upper_threshold, alertConfig.lower_threshold)
      : false;

    if (isBreached) {
      return { source: Icon.ExclamationMark, tintColor: Color.Red };
    }
    return { source: monitor.monitor_type === "constant" ? Icon.Pin : Icon.LineChart };
  };

  return (
    <MenuBarExtra
      icon={getMenuBarIcon()}
      title={getTitle()}
      isLoading={isLoading}
      tooltip={getTooltip()}
    >
      {/* Pinned Monitors Section */}
      {pinnedMonitors.length > 0 && (
        <MenuBarExtra.Section title="Pinned">
          {pinnedMonitors.map((monitor) => {
            const localAlias = aliases?.[monitor.monitor_id];
            const displayName = getDisplayName(monitor.monitor_name, monitor.monitor_id, localAlias);
            const value = formatValue(monitor.latest_value, monitor.unit);

            return (
              <MenuBarExtra.Item
                key={monitor.monitor_id}
                icon={getMonitorIcon(monitor)}
                title={displayName}
                subtitle={value}
                tooltip={`Last updated: ${formatTimeSince(monitor.latest_timestamp)}`}
                onAction={async () => {
                  await launchCommand({
                    name: "list-monitors",
                    type: LaunchType.UserInitiated,
                  });
                }}
              />
            );
          })}
        </MenuBarExtra.Section>
      )}

      {/* Active Alerts Section */}
      {activeAlertsCount > 0 && (
        <MenuBarExtra.Section title={`🔴 Active Alerts (${activeAlertsCount})`}>
          {monitors
            ?.filter((monitor) => {
              const alertConfig = alerts.get(monitor.monitor_id);
              return (
                alertConfig &&
                isValueOutOfRange(
                  monitor.latest_value,
                  alertConfig.upper_threshold,
                  alertConfig.lower_threshold
                )
              );
            })
            .slice(0, 5) // Limit to 5 alerts
            .map((monitor) => {
              const localAlias = aliases?.[monitor.monitor_id];
              const displayName = getDisplayName(monitor.monitor_name, monitor.monitor_id, localAlias);
              const value = formatValue(monitor.latest_value, monitor.unit);
              const alertConfig = alerts.get(monitor.monitor_id);

              return (
                <MenuBarExtra.Item
                  key={monitor.monitor_id}
                  icon={{ source: Icon.ExclamationMark, tintColor: Color.Red }}
                  title={displayName}
                  subtitle={`${value} ${alertConfig ? getAlertLevelEmoji(alertConfig.alert_level) : ""}`}
                  onAction={async () => {
                  await launchCommand({
                    name: "list-monitors",
                    type: LaunchType.UserInitiated,
                  });
                }}
                />
              );
            })}
        </MenuBarExtra.Section>
      )}

      {/* Tags Section */}
      {allMonitorsForTags.length > 0 && (() => {
        // Group all monitors by tags from local storage
        const monitorsByTag: { [tag: string]: MonitorSummary[] } = {};
        const untaggedMonitors: MonitorSummary[] = [];

        allMonitorsForTags.forEach((monitor) => {
          // Get tags from local storage
          const monitorTags = localTags?.[monitor.monitor_id] || [];
          if (monitorTags.length === 0) {
            untaggedMonitors.push(monitor);
          } else {
            monitorTags.forEach((tag) => {
              if (!monitorsByTag[tag]) {
                monitorsByTag[tag] = [];
              }
              monitorsByTag[tag].push(monitor);
            });
          }
        });

        const tagNames = Object.keys(monitorsByTag).sort();

        return (
          <>
            {/* Tagged monitors in submenus */}
            {tagNames.length > 0 && (
              <MenuBarExtra.Section title="Tags">
                {tagNames.map((tagName) => {
                  // Sort monitors within tag by display name
                  const sortedTagMonitors = [...monitorsByTag[tagName]].sort((a, b) => {
                    const nameA = getDisplayName(a.monitor_name, a.monitor_id, aliases?.[a.monitor_id]).toLowerCase();
                    const nameB = getDisplayName(b.monitor_name, b.monitor_id, aliases?.[b.monitor_id]).toLowerCase();
                    return nameA.localeCompare(nameB);
                  });

                  return (
                    <MenuBarExtra.Submenu key={tagName} title={tagName} icon={Icon.Tag}>
                      {sortedTagMonitors.map((monitor) => {
                        const localAlias = aliases?.[monitor.monitor_id];
                        const displayName = getDisplayName(monitor.monitor_name, monitor.monitor_id, localAlias);
                        const value = formatValue(monitor.latest_value, monitor.unit);

                        return (
                          <MenuBarExtra.Item
                            key={monitor.monitor_id}
                            icon={getMonitorIcon(monitor)}
                            title={displayName}
                            subtitle={value}
                            tooltip={`Last updated: ${formatTimeSince(monitor.latest_timestamp)}`}
                            onAction={async () => {
                  await launchCommand({
                    name: "list-monitors",
                    type: LaunchType.UserInitiated,
                  });
                }}
                          />
                        );
                      })}
                    </MenuBarExtra.Submenu>
                  );
                })}
              </MenuBarExtra.Section>
            )}

            {/* Untagged monitors in More submenu */}
            {untaggedMonitors.length > 0 && (
              <MenuBarExtra.Section title="More">
                <MenuBarExtra.Submenu title={`Untagged (${untaggedMonitors.length})`} icon={Icon.Ellipsis}>
                  {untaggedMonitors.map((monitor) => {
                    const localAlias = aliases?.[monitor.monitor_id];
                    const displayName = getDisplayName(monitor.monitor_name, monitor.monitor_id, localAlias);
                    const value = formatValue(monitor.latest_value, monitor.unit);

                    return (
                      <MenuBarExtra.Item
                        key={monitor.monitor_id}
                        icon={getMonitorIcon(monitor)}
                        title={displayName}
                        subtitle={value}
                        tooltip={`Last updated: ${formatTimeSince(monitor.latest_timestamp)}`}
                        onAction={async () => {
                  await launchCommand({
                    name: "list-monitors",
                    type: LaunchType.UserInitiated,
                  });
                }}
                      />
                    );
                  })}
                </MenuBarExtra.Submenu>
              </MenuBarExtra.Section>
            )}
          </>
        );
      })()}

      {/* No Monitors Configured */}
      {monitors?.length === 0 && (
        <MenuBarExtra.Section>
          <MenuBarExtra.Item title="No monitors available" icon={Icon.Info} />
          <MenuBarExtra.Item
            title="Configure in Preferences"
            icon={Icon.Gear}
            onAction={openExtensionPreferences}
          />
        </MenuBarExtra.Section>
      )}

      {/* Settings Section */}
      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Refresh"
          icon={Icon.ArrowClockwise}
          shortcut={{ modifiers: ["cmd"], key: "r" }}
          onAction={() => {
            revalidateMonitors();
            revalidateAlerts();
          }}
        />
        <MenuBarExtra.Item
          title="Configure Menu Bar Monitors"
          icon={Icon.Gear}
          shortcut={{ modifiers: ["cmd"], key: "," }}
          onAction={openCommandPreferences}
        />
        <MenuBarExtra.Item
          title="Open Extension Preferences"
          icon={Icon.Cog}
          onAction={openExtensionPreferences}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
