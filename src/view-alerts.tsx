import { Action, ActionPanel, Color, Icon, List, getPreferenceValues } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { api, MonitorSummary, AlertConfig } from "./api";
import { formatValue, formatTimeSince, isValueOutOfRange, getAlertLevelEmoji } from "./utils";
import MonitorDetail from "./monitor-detail";
import { getAllAliases, getDisplayName } from "./local-aliases";
import { useState } from "react";

interface AlertItem {
  monitor: MonitorSummary;
  config: AlertConfig;
  isActive: boolean;
}

interface Preferences {
  monitorOrder?: string;
}

type SortBy = "status" | "name" | "value" | "level" | "custom";

export default function ViewAlerts() {
  const preferences = getPreferenceValues<Preferences>();
  const customOrder = preferences.monitorOrder
    ?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0) || [];

  const [sortBy, setSortBy] = useState<SortBy>("status");
  const {
    data: monitors,
    isLoading: monitorsLoading,
    revalidate: revalidateMonitors,
  } = usePromise(async () => {
    return await api.getMonitors();
  });

  const {
    data: alerts,
    isLoading: alertsLoading,
    revalidate: revalidateAlerts,
  } = usePromise(async () => {
    return await api.getAlertConfigs();
  });

  const {
    data: aliases,
    isLoading: aliasesLoading,
  } = usePromise(async () => {
    return await getAllAliases();
  });

  const isLoading = monitorsLoading || alertsLoading || aliasesLoading;

  // Combine monitors with their alert configs
  const alertItems: AlertItem[] = [];
  if (monitors && alerts) {
    const alertMap = new Map(alerts.map((a) => [a.monitor_id, a]));
    monitors.forEach((monitor) => {
      const config = alertMap.get(monitor.monitor_id);
      if (config) {
        const isActive = isValueOutOfRange(
          monitor.latest_value,
          config.upper_threshold,
          config.lower_threshold
        );
        alertItems.push({ monitor, config, isActive });
      }
    });
  }

  // Sort alert items
  const levelOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedAlertItems = [...alertItems].sort((a, b) => {
    switch (sortBy) {
      case "custom": {
        const indexA = customOrder.indexOf(a.monitor.monitor_id);
        const indexB = customOrder.indexOf(b.monitor.monitor_id);

        // If both are in custom order, sort by their position
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }
        // If only A is in custom order, it comes first
        if (indexA !== -1) return -1;
        // If only B is in custom order, it comes first
        if (indexB !== -1) return 1;
        // If neither is in custom order, sort by status
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        const nameA = (a.monitor.monitor_name || a.monitor.monitor_id).toLowerCase();
        const nameB = (b.monitor.monitor_name || b.monitor.monitor_id).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      case "status": {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        // Secondary sort by level
        const aLevel = levelOrder[a.config.alert_level as keyof typeof levelOrder] ?? 4;
        const bLevel = levelOrder[b.config.alert_level as keyof typeof levelOrder] ?? 4;
        return aLevel - bLevel;
      }
      case "name": {
        const nameA = (a.monitor.monitor_name || a.monitor.monitor_id).toLowerCase();
        const nameB = (b.monitor.monitor_name || b.monitor.monitor_id).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      case "value": {
        const valA = a.monitor.latest_value ?? -Infinity;
        const valB = b.monitor.latest_value ?? -Infinity;
        return valB - valA; // Descending
      }
      case "level": {
        const aLevel = levelOrder[a.config.alert_level as keyof typeof levelOrder] ?? 4;
        const bLevel = levelOrder[b.config.alert_level as keyof typeof levelOrder] ?? 4;
        if (aLevel !== bLevel) return aLevel - bLevel;
        // Secondary sort by status
        return a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1;
      }
      default:
        return 0;
    }
  });

  const activeAlerts = sortedAlertItems.filter((item) => item.isActive);
  const configuredAlerts = sortedAlertItems.filter((item) => !item.isActive);

  return (
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Search alerts..."
      searchBarAccessory={
        <List.Dropdown tooltip="Sort by" value={sortBy} onChange={(value) => setSortBy(value as SortBy)}>
          {customOrder.length > 0 && (
            <List.Dropdown.Item title="Custom Order" value="custom" icon={Icon.List} />
          )}
          <List.Dropdown.Item title="Alert Status" value="status" icon={Icon.ExclamationMark} />
          <List.Dropdown.Item title="Name (A-Z)" value="name" icon={Icon.TextCursor} />
          <List.Dropdown.Item title="Value (High-Low)" value="value" icon={Icon.LineChart} />
          <List.Dropdown.Item title="Alert Level" value="level" icon={Icon.Bell} />
        </List.Dropdown>
      }
    >
      {activeAlerts.length > 0 && (
        <List.Section title={`🔴 Active Alerts (${activeAlerts.length})`}>
          {activeAlerts.map((item) => (
            <AlertListItem
              key={item.monitor.monitor_id}
              item={item}
              aliases={aliases}
              onRefresh={() => {
                revalidateMonitors();
                revalidateAlerts();
              }}
            />
          ))}
        </List.Section>
      )}

      {configuredAlerts.length > 0 && (
        <List.Section title={`🔔 Configured Alerts (${configuredAlerts.length})`}>
          {configuredAlerts.map((item) => (
            <AlertListItem
              key={item.monitor.monitor_id}
              item={item}
              aliases={aliases}
              onRefresh={() => {
                revalidateMonitors();
                revalidateAlerts();
              }}
            />
          ))}
        </List.Section>
      )}

      {alertItems.length === 0 && !isLoading && (
        <List.EmptyView
          icon={Icon.Bell}
          title="No Alerts Configured"
          description="Configure alert thresholds in the web interface to see them here"
        />
      )}
    </List>
  );
}

interface AlertListItemProps {
  item: AlertItem;
  onRefresh: () => void;
}

function AlertListItem({ item, onRefresh, aliases }: AlertListItemProps & { aliases?: Record<string, string> }) {
  const { monitor, config, isActive } = item;
  const localAlias = aliases?.[monitor.monitor_id];
  const displayName = getDisplayName(monitor.monitor_name, monitor.monitor_id, localAlias);

  const accessories: List.Item.Accessory[] = [];

  // Add current value
  accessories.push({
    text: formatValue(monitor.latest_value, monitor.unit),
    tooltip: "Current value",
  });

  // Alert level emoji
  accessories.push({
    tag: {
      value: getAlertLevelEmoji(config.alert_level),
      color: isActive ? Color.Red : Color.SecondaryText,
    },
    tooltip: `Alert level: ${config.alert_level}`,
  });

  const getAlertDetail = () => {
    const thresholdInfo = [];
    if (config.upper_threshold !== null) {
      thresholdInfo.push(`- **Upper threshold:** ${formatValue(config.upper_threshold, monitor.unit)}`);
    }
    if (config.lower_threshold !== null) {
      thresholdInfo.push(`- **Lower threshold:** ${formatValue(config.lower_threshold, monitor.unit)}`);
    }

    const markdown = `
## ${isActive ? "🔴 ALERT TRIGGERED" : "🟢 Normal"}

### Current Value
**${formatValue(monitor.latest_value, monitor.unit)}**

---

### Alert Configuration
- **Alert Level:** ${getAlertLevelEmoji(config.alert_level)} ${config.alert_level.toUpperCase()}
${thresholdInfo.join("\n")}

---

### Statistics
- **Min:** ${formatValue(monitor.min_value, monitor.unit)}
- **Average:** ${formatValue(monitor.avg_value, monitor.unit)}
- **Max:** ${formatValue(monitor.max_value, monitor.unit)}
- **Changes Detected:** ${monitor.change_count}
`;

    return (
      <List.Item.Detail
        markdown={markdown}
        metadata={
          <List.Item.Detail.Metadata>
            <List.Item.Detail.Metadata.Label title="Monitor ID" text={monitor.monitor_id} />
            <List.Item.Detail.Metadata.TagList title="Status">
              <List.Item.Detail.Metadata.TagList.Item
                text={isActive ? "TRIGGERED" : "Normal"}
                color={isActive ? Color.Red : Color.Green}
              />
            </List.Item.Detail.Metadata.TagList>
            <List.Item.Detail.Metadata.Separator />
            <List.Item.Detail.Metadata.Label title="Last Updated" text={formatTimeSince(monitor.latest_timestamp)} />
            <List.Item.Detail.Metadata.Label
              title="Timestamp"
              text={new Date(monitor.latest_timestamp + "Z").toLocaleString()}
            />
            <List.Item.Detail.Metadata.Separator />
            <List.Item.Detail.Metadata.Label title="Alert Updated" text={new Date(config.updated_at).toLocaleString()} />
            {monitor.url && (
              <>
                <List.Item.Detail.Metadata.Separator />
                <List.Item.Detail.Metadata.Link title="Source URL" text={monitor.url} target={monitor.url} />
              </>
            )}
          </List.Item.Detail.Metadata>
        }
      />
    );
  };

  return (
    <List.Item
      icon={{
        source: isActive ? Icon.ExclamationMark : Icon.Bell,
        tintColor: isActive ? Color.Red : Color.SecondaryText,
      }}
      title={displayName}
      subtitle={monitor.description || undefined}
      accessories={accessories}
      detail={getAlertDetail()}
      actions={
        <ActionPanel>
          <Action.Push
            title="View Full Details"
            icon={Icon.Eye}
            target={
              <MonitorDetail
                monitor={monitor}
                alertConfig={config}
                onUpdate={() => {
                  onRefresh();
                }}
              />
            }
          />
          <Action.OpenInBrowser
            title="Open in Browser"
            url={monitor.url}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
          />
          <Action.CopyToClipboard
            title="Copy Current Value"
            content={formatValue(monitor.latest_value, monitor.unit)}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            onAction={onRefresh}
          />
        </ActionPanel>
      }
    />
  );
}
