export function formatValue(value: number | null, unit: string | null): string {
  if (value === null) return "N/A";
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatTimeSince(timestamp: string): string {
  const now = new Date();
  const timestampUTC = timestamp.endsWith("Z") ? timestamp : timestamp + "Z";
  const then = new Date(timestampUTC);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function isValueOutOfRange(
  value: number | null,
  upperThreshold?: number | null,
  lowerThreshold?: number | null
): boolean {
  if (value === null) return false;
  if (upperThreshold && value > upperThreshold) return true;
  if (lowerThreshold && value < lowerThreshold) return true;
  return false;
}

export function getAlertLevelColor(level: string): string {
  switch (level) {
    case "critical":
      return "#EF4444"; // Red
    case "high":
      return "#F97316"; // Orange
    case "medium":
      return "#EAB308"; // Yellow
    case "low":
      return "#22C55E"; // Green
    default:
      return "#6B7280"; // Gray
  }
}

export function getAlertLevelEmoji(level: string): string {
  switch (level) {
    case "critical":
      return "🔴";
    case "high":
      return "🟠";
    case "medium":
      return "🟡";
    case "low":
      return "🟢";
    default:
      return "⚪";
  }
}
