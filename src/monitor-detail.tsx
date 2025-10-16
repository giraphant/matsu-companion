import { Action, ActionPanel, Color, Detail, Icon, Form, showToast, Toast, useNavigation } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { api, MonitorSummary, AlertConfig } from "./api";
import { formatValue, formatTimeSince, isValueOutOfRange, getAlertLevelEmoji, safeFormatDate } from "./utils";
import React, { useState } from "react";

interface MonitorDetailProps {
  monitor: MonitorSummary;
  alertConfig?: AlertConfig;
  onUpdate?: () => void;
}

export default function MonitorDetail({ monitor, alertConfig, onUpdate }: MonitorDetailProps) {
  const { data: chartData, isLoading } = usePromise(
    async (monitorId) => {
      return await api.getChartData(monitorId, 7);
    },
    [monitor.monitor_id]
  );

  const isBreached = alertConfig
    ? isValueOutOfRange(monitor.latest_value, alertConfig.upper_threshold, alertConfig.lower_threshold)
    : false;

  const markdown = `
# ${monitor.monitor_name || monitor.monitor_id}

${isBreached ? `## ${getAlertLevelEmoji(alertConfig?.alert_level || "medium")} ALERT TRIGGERED\n` : ""}

## Current Value
**${formatValue(monitor.latest_value, monitor.unit)}**

Last updated: ${formatTimeSince(monitor.latest_timestamp)}

---

## Statistics (7 days)

| Metric | Value |
|--------|-------|
| **Min** | ${formatValue(monitor.min_value, monitor.unit)} |
| **Average** | ${formatValue(monitor.avg_value, monitor.unit)} |
| **Max** | ${formatValue(monitor.max_value, monitor.unit)} |
| **Total Records** | ${monitor.total_records} |
| **Changes Detected** | ${monitor.change_count} |

${
  alertConfig
    ? `
---

## Alert Configuration

| Setting | Value |
|---------|-------|
| **Alert Level** | ${getAlertLevelEmoji(alertConfig.alert_level)} ${alertConfig.alert_level.toUpperCase()} |
| **Upper Threshold** | ${alertConfig.upper_threshold ? formatValue(alertConfig.upper_threshold, monitor.unit) : "Not set"} |
| **Lower Threshold** | ${alertConfig.lower_threshold ? formatValue(alertConfig.lower_threshold, monitor.unit) : "Not set"} |
| **Last Updated** | ${safeFormatDate(alertConfig.updated_at)} |
`
    : ""
}

${
  monitor.description
    ? `
---

## Description
${monitor.description}
`
    : ""
}

${
  chartData
    ? `
---

## Recent Data Points (Last 10)

| Time | Value | Status |
|------|-------|--------|
${chartData.data
  .slice(-10)
  .reverse()
  .map((point) => {
    const time = safeFormatDate(point.timestamp);
    const value = formatValue(point.value, monitor.unit);
    return `| ${time} | ${value} | ${point.status} |`;
  })
  .join("\n")}
`
    : ""
}
`;

  const metadata = (
    <Detail.Metadata>
      <Detail.Metadata.Label title="Monitor ID" text={monitor.monitor_id} />
      <Detail.Metadata.Label
        title="Type"
        text={monitor.monitor_type === "constant" ? "Constant Card" : "Monitor"}
        icon={monitor.monitor_type === "constant" ? Icon.Pin : Icon.LineChart}
      />
      <Detail.Metadata.Separator />
      <Detail.Metadata.Label title="Current Value" text={formatValue(monitor.latest_value, monitor.unit)} />
      <Detail.Metadata.Label title="Last Updated" text={formatTimeSince(monitor.latest_timestamp)} />
      {alertConfig && (
        <>
          <Detail.Metadata.Separator />
          <Detail.Metadata.TagList title="Alert Status">
            <Detail.Metadata.TagList.Item
              text={isBreached ? "TRIGGERED" : "Normal"}
              color={isBreached ? Color.Red : Color.Green}
            />
          </Detail.Metadata.TagList>
          <Detail.Metadata.Label
            title="Alert Level"
            text={alertConfig.alert_level.toUpperCase()}
            icon={{ source: Icon.Bell, tintColor: isBreached ? Color.Red : Color.SecondaryText }}
          />
        </>
      )}
      {monitor.color && (
        <>
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Card Color" text={monitor.color} />
        </>
      )}
    </Detail.Metadata>
  );

  return (
    <Detail
      isLoading={isLoading}
      markdown={markdown}
      metadata={metadata}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            {monitor.monitor_type === "constant" && (
              <Action.Push
                title="Edit Constant Value"
                icon={Icon.Pencil}
                target={<EditConstantForm monitor={monitor} onUpdate={onUpdate} />}
                shortcut={{ modifiers: ["cmd"], key: "e" }}
              />
            )}
            {alertConfig ? (
              <Action.Push
                title="Edit Alert Config"
                icon={Icon.Bell}
                target={<EditAlertForm monitor={monitor} alertConfig={alertConfig} onUpdate={onUpdate} />}
                shortcut={{ modifiers: ["cmd"], key: "a" }}
              />
            ) : (
              <Action.Push
                title="Create Alert Config"
                icon={Icon.Bell}
                target={<EditAlertForm monitor={monitor} onUpdate={onUpdate} />}
                shortcut={{ modifiers: ["cmd"], key: "a" }}
              />
            )}
            {alertConfig && (
              <Action
                title="Delete Alert Config"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                onAction={async () => {
                  try {
                    await showToast({ style: Toast.Style.Animated, title: "Deleting alert config..." });
                    await api.deleteAlertConfig(monitor.monitor_id);
                    await showToast({ style: Toast.Style.Success, title: "Alert config deleted" });
                    onUpdate?.();
                  } catch (error) {
                    await showToast({
                      style: Toast.Style.Failure,
                      title: "Failed to delete alert config",
                      message: String(error),
                    });
                  }
                }}
                shortcut={{ modifiers: ["cmd", "shift"], key: "delete" }}
              />
            )}
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action.OpenInBrowser title="Open in Browser" url={monitor.url} icon={Icon.Globe} />
            <Action.CopyToClipboard
              title="Copy Current Value"
              content={formatValue(monitor.latest_value, monitor.unit)}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action.CopyToClipboard
              title="Copy Monitor ID"
              content={monitor.monitor_id}
              shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

// Edit Alert Config Form
interface EditAlertFormProps {
  monitor: MonitorSummary;
  alertConfig?: AlertConfig;
  onUpdate?: () => void;
}

function EditAlertForm({ monitor, alertConfig, onUpdate }: EditAlertFormProps) {
  const { pop } = useNavigation();
  const [upperThreshold, setUpperThreshold] = useState<string>(
    alertConfig?.upper_threshold?.toString() || ""
  );
  const [lowerThreshold, setLowerThreshold] = useState<string>(
    alertConfig?.lower_threshold?.toString() || ""
  );
  const [alertLevel, setAlertLevel] = useState<string>(alertConfig?.alert_level || "medium");

  async function handleSubmit() {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Saving alert config..." });

      const upper = upperThreshold ? parseFloat(upperThreshold) : undefined;
      const lower = lowerThreshold ? parseFloat(lowerThreshold) : undefined;

      if (upper !== undefined && isNaN(upper)) {
        throw new Error("Upper threshold must be a valid number");
      }
      if (lower !== undefined && isNaN(lower)) {
        throw new Error("Lower threshold must be a valid number");
      }

      await api.updateAlertConfig(monitor.monitor_id, upper, lower, alertLevel);
      await showToast({ style: Toast.Style.Success, title: "Alert config saved" });
      onUpdate?.();
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to save alert config",
        message: String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save Alert Config" onSubmit={handleSubmit} icon={Icon.Check} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Monitor"
        text={`${monitor.monitor_name || monitor.monitor_id} (${formatValue(monitor.latest_value, monitor.unit)})`}
      />
      <Form.Separator />
      <Form.TextField
        id="upperThreshold"
        title="Upper Threshold"
        placeholder="Leave empty for no upper limit"
        value={upperThreshold}
        onChange={setUpperThreshold}
        info="Alert when value exceeds this threshold"
      />
      <Form.TextField
        id="lowerThreshold"
        title="Lower Threshold"
        placeholder="Leave empty for no lower limit"
        value={lowerThreshold}
        onChange={setLowerThreshold}
        info="Alert when value falls below this threshold"
      />
      <Form.Dropdown id="alertLevel" title="Alert Level" value={alertLevel} onChange={setAlertLevel}>
        <Form.Dropdown.Item value="low" title="🟢 Low" icon={Icon.Circle} />
        <Form.Dropdown.Item value="medium" title="🟡 Medium" icon={Icon.Circle} />
        <Form.Dropdown.Item value="high" title="🟠 High" icon={Icon.Circle} />
        <Form.Dropdown.Item value="critical" title="🔴 Critical" icon={Icon.Circle} />
      </Form.Dropdown>
    </Form>
  );
}

// Edit Constant Card Form
interface EditConstantFormProps {
  monitor: MonitorSummary;
  onUpdate?: () => void;
}

function EditConstantForm({ monitor, onUpdate }: EditConstantFormProps) {
  const { pop } = useNavigation();
  const [name, setName] = useState<string>(monitor.monitor_name || "");
  const [value, setValue] = useState<string>(monitor.latest_value?.toString() || "");
  const [unit, setUnit] = useState<string>(monitor.unit || "");
  const [description, setDescription] = useState<string>(monitor.description || "");
  const [color, setColor] = useState<string>(monitor.color || "#3b82f6");

  async function handleSubmit() {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Updating constant card..." });

      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        throw new Error("Value must be a valid number");
      }

      if (!name.trim()) {
        throw new Error("Name is required");
      }

      await api.updateConstantCard(
        monitor.monitor_id,
        numValue,
        name.trim(),
        unit.trim() || undefined,
        description.trim() || undefined,
        color.trim() || undefined
      );
      await showToast({ style: Toast.Style.Success, title: "Constant card updated" });
      onUpdate?.();
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to update constant card",
        message: String(error),
      });
    }
  }

  async function handleDelete() {
    try {
      await showToast({ style: Toast.Style.Animated, title: "Deleting constant card..." });
      await api.deleteConstantCard(monitor.monitor_id);
      await showToast({ style: Toast.Style.Success, title: "Constant card deleted" });
      onUpdate?.();
      pop();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to delete constant card",
        message: String(error),
      });
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" onSubmit={handleSubmit} icon={Icon.Check} />
          <Action
            title="Delete Constant Card"
            icon={Icon.Trash}
            style={Action.Style.Destructive}
            onAction={handleDelete}
            shortcut={{ modifiers: ["cmd"], key: "delete" }}
          />
        </ActionPanel>
      }
    >
      <Form.Description title="Edit Constant Card" text={monitor.monitor_id} />
      <Form.Separator />
      <Form.TextField
        id="name"
        title="Name"
        placeholder="Card name"
        value={name}
        onChange={setName}
        info="Display name for this constant card"
      />
      <Form.TextField
        id="value"
        title="Value"
        placeholder="Enter value"
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
        info="Hex color code (e.g., #F59E0B)"
      />
    </Form>
  );
}
