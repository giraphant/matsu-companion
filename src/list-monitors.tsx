import { Action, ActionPanel, Color, Icon, List, getPreferenceValues, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { api, MonitorSummary, AlertConfig } from "./api";
import { formatValue, formatTimeSince, isValueOutOfRange, getAlertLevelEmoji } from "./utils";
import MonitorDetail from "./monitor-detail";
import { getAllAliases, setMonitorAlias, deleteMonitorAlias, getDisplayName, setMonitorTags, deleteMonitorTags, getAllTags } from "./local-aliases";
import { useState } from "react";

interface Preferences {
  monitorOrder?: string;
}

type SortBy = "name" | "value" | "lastUpdated" | "alertStatus" | "custom";

export default function ListMonitors() {
  const preferences = getPreferenceValues<Preferences>();
  const customOrder = preferences.monitorOrder
    ?.split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0) || [];

  const [sortBy, setSortBy] = useState<SortBy>("name");

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
    const configs = await api.getAlertConfigs();
    const alertMap = new Map<string, AlertConfig>();
    configs.forEach((config) => alertMap.set(config.monitor_id, config));
    return alertMap;
  });

  const {
    data: aliases,
    isLoading: aliasesLoading,
    revalidate: revalidateAliases,
  } = usePromise(async () => {
    return await getAllAliases();
  });

  const {
    data: localTags,
    isLoading: tagsLoading,
    revalidate: revalidateTags,
  } = usePromise(async () => {
    return await getAllTags();
  });

  const isLoading = monitorsLoading || alertsLoading || aliasesLoading || tagsLoading;

  // Sort monitors
  const sortedMonitors = monitors ? [...monitors].sort((a, b) => {
    switch (sortBy) {
      case "custom": {
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
        const nameA = (a.monitor_name || a.monitor_id).toLowerCase();
        const nameB = (b.monitor_name || b.monitor_id).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      case "name": {
        const nameA = (a.monitor_name || a.monitor_id).toLowerCase();
        const nameB = (b.monitor_name || b.monitor_id).toLowerCase();
        return nameA.localeCompare(nameB);
      }
      case "value": {
        const valA = a.latest_value ?? -Infinity;
        const valB = b.latest_value ?? -Infinity;
        return valB - valA; // Descending
      }
      case "lastUpdated": {
        const timeA = new Date(a.latest_timestamp + "Z").getTime();
        const timeB = new Date(b.latest_timestamp + "Z").getTime();
        return timeB - timeA; // Most recent first
      }
      case "alertStatus": {
        const alertA = alerts?.get(a.monitor_id);
        const alertB = alerts?.get(b.monitor_id);
        const breachedA = alertA
          ? isValueOutOfRange(a.latest_value, alertA.upper_threshold, alertA.lower_threshold)
          : false;
        const breachedB = alertB
          ? isValueOutOfRange(b.latest_value, alertB.upper_threshold, alertB.lower_threshold)
          : false;

        if (breachedA === breachedB) {
          // If same alert status, sort by name
          const nameA = (a.monitor_name || a.monitor_id).toLowerCase();
          const nameB = (b.monitor_name || b.monitor_id).toLowerCase();
          return nameA.localeCompare(nameB);
        }
        return breachedA ? -1 : 1; // Alerts first
      }
      default:
        return 0;
    }
  }) : [];

  const getMonitorAccessory = (monitor: MonitorSummary) => {
    const accessories: List.Item.Accessory[] = [];

    // Add current value
    accessories.push({
      text: formatValue(monitor.latest_value, monitor.unit),
      tooltip: "Current value",
    });

    // Add alert indicator if monitor has threshold configured and is breaching
    const alertConfig = alerts?.get(monitor.monitor_id);
    if (alertConfig) {
      const isBreached = isValueOutOfRange(
        monitor.latest_value,
        alertConfig.upper_threshold,
        alertConfig.lower_threshold
      );

      if (isBreached) {
        accessories.push({
          tag: {
            value: getAlertLevelEmoji(alertConfig.alert_level),
            color: Color.Red,
          },
          tooltip: `Alert: ${alertConfig.alert_level}`,
        });
      }
    }

    return accessories;
  };

  const getMonitorDetail = (monitor: MonitorSummary) => {
    const alertConfig = alerts?.get(monitor.monitor_id);
    const isBreached = alertConfig
      ? isValueOutOfRange(monitor.latest_value, alertConfig.upper_threshold, alertConfig.lower_threshold)
      : false;

    const markdown = `
## Current Value
**${formatValue(monitor.latest_value, monitor.unit)}**

---

## Statistics
- **Min:** ${formatValue(monitor.min_value, monitor.unit)}
- **Average:** ${formatValue(monitor.avg_value, monitor.unit)}
- **Max:** ${formatValue(monitor.max_value, monitor.unit)}
- **Total Records:** ${monitor.total_records}
- **Changes Detected:** ${monitor.change_count}

${
  alertConfig
    ? `---

## Alert Status
${isBreached ? `🔴 **ALERT TRIGGERED** (${alertConfig.alert_level})` : `🟢 Normal`}

**Thresholds:**
- Upper: ${alertConfig.upper_threshold ? formatValue(alertConfig.upper_threshold, monitor.unit) : "Not set"}
- Lower: ${alertConfig.lower_threshold ? formatValue(alertConfig.lower_threshold, monitor.unit) : "Not set"}
`
    : ""
}
`;

    return (
      <List.Item.Detail
        markdown={markdown}
        metadata={
          <List.Item.Detail.Metadata>
            <List.Item.Detail.Metadata.Label title="Monitor ID" text={monitor.monitor_id} />
            <List.Item.Detail.Metadata.Label
              title="Type"
              text={monitor.monitor_type === "constant" ? "Constant" : "Monitor"}
              icon={monitor.monitor_type === "constant" ? Icon.Pin : Icon.LineChart}
            />
            <List.Item.Detail.Metadata.Separator />
            <List.Item.Detail.Metadata.Label title="Last Updated" text={formatTimeSince(monitor.latest_timestamp)} />
            <List.Item.Detail.Metadata.Label
              title="Timestamp"
              text={new Date(monitor.latest_timestamp + "Z").toLocaleString()}
            />
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
    <List
      isLoading={isLoading}
      isShowingDetail
      searchBarPlaceholder="Search monitors..."
      actions={
        <ActionPanel>
          <Action.Push
            title="Create Constant Card"
            icon={Icon.Plus}
            target={<CreateConstantForm onUpdate={() => {
              revalidateMonitors();
              revalidateAlerts();
            }} />}
            shortcut={{ modifiers: ["cmd"], key: "n" }}
          />
        </ActionPanel>
      }
      searchBarAccessory={
        <List.Dropdown tooltip="Sort by" value={sortBy} onChange={(value) => setSortBy(value as SortBy)}>
          {customOrder.length > 0 && (
            <List.Dropdown.Item title="Custom Order" value="custom" icon={Icon.List} />
          )}
          <List.Dropdown.Item title="Name (A-Z)" value="name" icon={Icon.TextCursor} />
          <List.Dropdown.Item title="Value (High-Low)" value="value" icon={Icon.LineChart} />
          <List.Dropdown.Item title="Last Updated" value="lastUpdated" icon={Icon.Clock} />
          <List.Dropdown.Item title="Alert Status" value="alertStatus" icon={Icon.ExclamationMark} />
        </List.Dropdown>
      }
    >
      {sortedMonitors.map((monitor) => {
        const localAlias = aliases?.[monitor.monitor_id];
        const displayName = getDisplayName(monitor.monitor_name, monitor.monitor_id, localAlias);

        // Get tags from local storage
        const tags = localTags?.[monitor.monitor_id] || [];

        const isConstant = monitor.monitor_type === "constant";
        const alertConfig = alerts?.get(monitor.monitor_id);
        const isBreached = alertConfig
          ? isValueOutOfRange(monitor.latest_value, alertConfig.upper_threshold, alertConfig.lower_threshold)
          : false;

        // Add tags to subtitle
        const subtitleParts = [];
        if (monitor.description) subtitleParts.push(monitor.description);
        if (tags.length > 0) subtitleParts.push(`🏷️ ${tags.join(", ")}`);
        const subtitle = subtitleParts.join(" • ") || undefined;

        return (
          <List.Item
            key={monitor.monitor_id}
            icon={{
              source: isConstant ? Icon.Pin : Icon.LineChart,
              tintColor: isBreached ? Color.Red : undefined,
            }}
            title={displayName}
            subtitle={subtitle}
            accessories={getMonitorAccessory(monitor)}
            detail={getMonitorDetail(monitor)}
            actions={
              <ActionPanel>
                <Action.Push
                  title="View Full Details"
                  icon={Icon.Eye}
                  target={
                    <MonitorDetail
                      monitor={monitor}
                      alertConfig={alerts?.get(monitor.monitor_id)}
                      onUpdate={() => {
                        revalidateMonitors();
                        revalidateAlerts();
                      }}
                    />
                  }
                />
                <Action.Push
                  title="Edit Tags"
                  icon={Icon.Tag}
                  target={
                    <EditTagsForm
                      monitor={monitor}
                      currentTags={tags}
                      onUpdate={revalidateTags}
                    />
                  }
                  shortcut={{ modifiers: ["cmd"], key: "t" }}
                />
                <Action.Push
                  title="Edit Local Alias"
                  icon={Icon.Pencil}
                  target={
                    <EditAliasForm
                      monitor={monitor}
                      currentAlias={localAlias}
                      onUpdate={revalidateAliases}
                    />
                  }
                  shortcut={{ modifiers: ["cmd", "shift"], key: "e" }}
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
                  onAction={() => {
                    revalidateMonitors();
                    revalidateAlerts();
                  }}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

// Create Constant Card Form
interface CreateConstantFormProps {
  onUpdate?: () => void;
}

function CreateConstantForm({ onUpdate }: CreateConstantFormProps) {
  const { pop } = useNavigation();
  const [name, setName] = useState<string>("");
  const [value, setValue] = useState<string>("");
  const [unit, setUnit] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [color, setColor] = useState<string>("#3b82f6");

  async function handleSubmit() {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Creating constant card..." });

      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        throw new Error("Value must be a valid number");
      }

      if (!name.trim()) {
        throw new Error("Name is required");
      }

      await api.createConstantCard(
        name.trim(),
        numValue,
        unit.trim() || undefined,
        description.trim() || undefined,
        color.trim() || undefined
      );
      await showToast({ style: Toast.Style.Success, title: "Constant card created" });
      onUpdate?.();
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to create constant card",
        message: String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Create" onSubmit={handleSubmit} icon={Icon.Check} />
        </ActionPanel>
      }
    >
      <Form.Description title="Create New Constant Card" text="Add a new constant card to track static values" />
      <Form.Separator />
      <Form.TextField
        id="name"
        title="Name"
        placeholder="e.g., Bitcoin Price Target"
        value={name}
        onChange={setName}
        info="Display name for this constant card"
      />
      <Form.TextField
        id="value"
        title="Value"
        placeholder="e.g., 100000"
        value={value}
        onChange={setValue}
        info="Numeric value for this card"
      />
      <Form.TextField
        id="unit"
        title="Unit"
        placeholder="e.g., USD, %, BTC (optional)"
        value={unit}
        onChange={setUnit}
        info="Optional unit to display with the value"
      />
      <Form.TextArea
        id="description"
        title="Description"
        placeholder="Optional description"
        value={description}
        onChange={setDescription}
        info="Brief description of this constant card"
      />
      <Form.TextField
        id="color"
        title="Color"
        placeholder="#3b82f6"
        value={color}
        onChange={setColor}
        info="Hex color code (e.g., #F59E0B for orange)"
      />
    </Form>
  );
}

// Edit Local Alias Form
interface EditAliasFormProps {
  monitor: MonitorSummary;
  currentAlias?: string;
  onUpdate?: () => void;
}

function EditAliasForm({ monitor, currentAlias, onUpdate }: EditAliasFormProps) {
  const { pop } = useNavigation();
  const [alias, setAlias] = useState<string>(currentAlias || "");

  async function handleSubmit() {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Saving local alias..." });

      await setMonitorAlias(monitor.monitor_id, alias);
      await showToast({ style: Toast.Style.Success, title: "Local alias saved" });
      onUpdate?.();
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save alias",
        message: String(error),
      });
    }
  }

  async function handleDelete() {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Deleting local alias..." });
      await deleteMonitorAlias(monitor.monitor_id);
      await showToast({ style: Toast.Style.Success, title: "Local alias deleted" });
      onUpdate?.();
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete alias",
        message: String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Alias" onSubmit={handleSubmit} icon={Icon.Check} />
          {currentAlias && (
            <Action
              title="Delete Alias"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              onAction={handleDelete}
              shortcut={{ modifiers: ["cmd"], key: "delete" }}
            />
          )}
        </ActionPanel>
      }
    >
      <Form.Description
        title="Edit Local Alias"
        text={`Set a custom display name for this monitor (stored locally only)`}
      />
      <Form.Separator />
      <Form.Description title="Monitor ID" text={monitor.monitor_id} />
      <Form.Description title="Original Name" text={monitor.monitor_name || "(none)"} />
      <Form.Separator />
      <Form.TextField
        id="alias"
        title="Local Alias"
        placeholder="Enter custom name"
        value={alias}
        onChange={setAlias}
        info="Leave empty to use original name"
      />
    </Form>
  );
}

// Edit Tags Form
interface EditTagsFormProps {
  monitor: MonitorSummary;
  currentTags: string[];
  onUpdate?: () => void;
}

function EditTagsForm({ monitor, currentTags, onUpdate }: EditTagsFormProps) {
  const { pop } = useNavigation();
  const [tagsInput, setTagsInput] = useState<string>(currentTags.join(", "));

  async function handleSubmit() {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Saving tags..." });

      const tags = tagsInput
        .split(",")
        .map(t => t.trim())
        .filter(t => t.length > 0);

      await setMonitorTags(monitor.monitor_id, tags);
      await showToast({ style: Toast.Style.Success, title: "Tags saved" });
      onUpdate?.();
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save tags",
        message: String(error),
      });
    }
  }

  async function handleDelete() {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Deleting tags..." });
      await deleteMonitorTags(monitor.monitor_id);
      await showToast({ style: Toast.Style.Success, title: "Tags deleted" });
      onUpdate?.();
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete tags",
        message: String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Tags" onSubmit={handleSubmit} icon={Icon.Check} />
          {currentTags.length > 0 && (
            <Action
              title="Delete All Tags"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              onAction={handleDelete}
              shortcut={{ modifiers: ["cmd"], key: "delete" }}
            />
          )}
        </ActionPanel>
      }
    >
      <Form.Description
        title="Edit Tags"
        text="Add tags to organize monitors in the menu bar"
      />
      <Form.Separator />
      <Form.Description title="Monitor" text={monitor.monitor_name || monitor.monitor_id} />
      <Form.Separator />
      <Form.TextField
        id="tags"
        title="Tags"
        placeholder="production, critical, database"
        value={tagsInput}
        onChange={setTagsInput}
        info="Comma-separated tags (e.g., production, critical)"
      />
      <Form.Description
        title="How it works"
        text="Tags will group monitors in the menu bar. One monitor can have multiple tags."
      />
    </Form>
  );
}
