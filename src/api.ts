import { getPreferenceValues } from "@raycast/api";

interface Preferences {
  apiUrl: string;
  username: string;
  password: string;
}

// New API response types from Matsu
interface ApiMonitor {
  id: string;
  name: string;
  formula: string;
  unit: string | null;
  description: string | null;
  color: string | null;
  decimal_places: number;
  enabled: boolean;
  value: number | null;
  computed_at: string;
  created_at: string;
  updated_at: string;
}

interface ApiHistoryPoint {
  timestamp: number;
  value: number;
}

interface ApiAlertRule {
  id: string;
  name: string;
  condition: string;
  level: string;
  enabled: boolean;
  cooldown_seconds: number;
  actions: string[];
  created_at: string;
  updated_at: string;
}

// Legacy interface that the UI expects
export interface MonitorSummary {
  monitor_id: string;
  monitor_name: string | null;
  monitor_type?: string;
  url: string;
  unit: string | null;
  color?: string | null;
  description?: string | null;
  tags?: string | null;
  total_records: number;
  latest_value: number | null;
  latest_timestamp: string;
  min_value: number | null;
  max_value: number | null;
  avg_value: number | null;
  change_count: number;
}

export interface AlertConfig {
  monitor_id: string;
  upper_threshold: number | null;
  lower_threshold: number | null;
  alert_level: string;
  created_at: string;
  updated_at: string;
}

export interface ChartDataPoint {
  timestamp: string;
  value: number | null;
  status: string;
}

export interface ChartData {
  monitor_id: string;
  monitor_name: string;
  url: string;
  data: ChartDataPoint[];
  summary: {
    total_points: number;
    date_range: string;
    value_range: {
      min: number | null;
      max: number | null;
      avg: number | null;
    };
    changes_detected: number;
    latest_value: number | null;
    latest_timestamp: string | null;
  };
}

class MatsuAPI {
  private baseUrl: string;
  private username: string;
  private password: string;
  private sessionCookie: string | null = null;

  constructor() {
    const preferences = getPreferenceValues<Preferences>();
    this.baseUrl = preferences.apiUrl.replace(/\/$/, "");
    this.username = preferences.username;
    this.password = preferences.password;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    // Ensure we're logged in
    if (!this.sessionCookie) {
      await this.login();
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(this.sessionCookie ? { Cookie: this.sessionCookie } : {}),
        ...options?.headers,
      },
    });

    // Store session cookie
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.sessionCookie = setCookie;
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  async login(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      });

      const setCookie = response.headers.get("set-cookie");
      if (setCookie) {
        this.sessionCookie = setCookie;
      }

      if (!response.ok) {
        return false;
      }

      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  }

  // Transform new API monitor format to legacy format expected by UI
  private transformMonitor(apiMonitor: ApiMonitor): MonitorSummary {
    return {
      monitor_id: apiMonitor.id,
      monitor_name: apiMonitor.name,
      monitor_type: "monitor", // New API doesn't have this concept
      url: "", // New API doesn't track source URLs
      unit: apiMonitor.unit,
      color: apiMonitor.color,
      description: apiMonitor.description,
      tags: null,
      total_records: 0, // Not available in new API
      latest_value: apiMonitor.value,
      latest_timestamp: apiMonitor.computed_at || apiMonitor.updated_at,
      min_value: null, // Would need to calculate from history
      max_value: null,
      avg_value: null,
      change_count: 0,
    };
  }

  async getMonitors(): Promise<MonitorSummary[]> {
    try {
      const apiMonitors = await this.request<ApiMonitor[]>("/api/monitors");
      return apiMonitors.map((m) => this.transformMonitor(m));
    } catch (error) {
      console.error("Failed to get monitors:", error);
      return [];
    }
  }

  // Extract threshold and monitor ID from alert rule condition
  private parseAlertCondition(
    condition: string,
    monitorId?: string
  ): {
    upper_threshold: number | null;
    lower_threshold: number | null;
    monitor_id: string | null;
  } {
    let upper_threshold: number | null = null;
    let lower_threshold: number | null = null;
    let monitor_id: string | null = null;

    // Parse conditions like "${monitor:monitor_btc_price} > 50000" or "${monitor:some_id} < 50"
    // Extract monitor ID from condition
    const monitorIdMatch = condition.match(/\$\{monitor:([^}]+)\}/);
    if (monitorIdMatch) {
      monitor_id = monitorIdMatch[1];
    }

    // If checking for a specific monitor, only parse if it matches
    if (monitorId && monitor_id && monitor_id !== monitorId) {
      return { upper_threshold: null, lower_threshold: null, monitor_id: null };
    }

    // Parse threshold values - match any reference (${monitor:*} or value) followed by operator and number
    const upperMatch = condition.match(/(?:\$\{monitor:[^}]+\}|value)\s*>\s*([0-9.]+)/);
    const lowerMatch = condition.match(/(?:\$\{monitor:[^}]+\}|value)\s*<\s*([0-9.]+)/);

    if (upperMatch) {
      upper_threshold = parseFloat(upperMatch[1]);
    }
    if (lowerMatch) {
      lower_threshold = parseFloat(lowerMatch[1]);
    }

    return { upper_threshold, lower_threshold, monitor_id };
  }

  async getAlertConfigs(): Promise<AlertConfig[]> {
    try {
      const [alertRules, monitors] = await Promise.all([
        this.request<ApiAlertRule[]>("/api/alert-rules"),
        this.request<ApiMonitor[]>("/api/monitors"),
      ]);

      console.log("DEBUG: Alert rules fetched:", alertRules.length);
      console.log("DEBUG: Monitors fetched:", monitors.length);
      console.log("DEBUG: Alert rules:", JSON.stringify(alertRules, null, 2));

      // In the new system, alert rules reference specific monitors by ID
      // We need to match each rule to its monitor
      const configs: AlertConfig[] = [];

      // For each alert rule, parse it and create config for the referenced monitor
      for (const rule of alertRules) {
        console.log(`DEBUG: Processing rule: ${rule.name}, enabled: ${rule.enabled}, condition: ${rule.condition}`);

        if (!rule.enabled) {
          console.log(`DEBUG: Skipping disabled rule: ${rule.name}`);
          continue;
        }

        const { upper_threshold, lower_threshold, monitor_id } = this.parseAlertCondition(rule.condition);
        console.log(`DEBUG: Parsed condition - monitor_id: ${monitor_id}, upper: ${upper_threshold}, lower: ${lower_threshold}`);

        // Skip rules without clear thresholds
        if (upper_threshold === null && lower_threshold === null) {
          console.log(`DEBUG: Skipping rule without thresholds: ${rule.name}`);
          continue;
        }

        // If rule references a specific monitor, only add config for that monitor
        if (monitor_id) {
          const monitor = monitors.find((m) => m.id === monitor_id);
          console.log(`DEBUG: Looking for monitor ${monitor_id}, found: ${monitor ? "yes" : "no"}`);
          if (monitor) {
            configs.push({
              monitor_id: monitor.id,
              upper_threshold,
              lower_threshold,
              alert_level: rule.level,
              created_at: rule.created_at,
              updated_at: rule.updated_at,
            });
            console.log(`DEBUG: Added config for monitor ${monitor.id}`);
          }
        } else {
          // If rule doesn't specify a monitor, apply to all monitors (global rule)
          console.log(`DEBUG: Global rule, applying to all ${monitors.length} monitors`);
          for (const monitor of monitors) {
            configs.push({
              monitor_id: monitor.id,
              upper_threshold,
              lower_threshold,
              alert_level: rule.level,
              created_at: rule.created_at,
              updated_at: rule.updated_at,
            });
          }
        }
      }

      console.log(`DEBUG: Total configs created: ${configs.length}`);
      console.log("DEBUG: Configs:", JSON.stringify(configs, null, 2));

      return configs;
    } catch (error) {
      console.warn("Failed to get alert configs:", error);
      return [];
    }
  }

  async getChartData(monitorId: string, days: number = 7): Promise<ChartData> {
    try {
      const hours = days * 24;
      const history = await this.request<ApiHistoryPoint[]>(
        `/api/monitors/${monitorId}/history?hours=${hours}`
      );

      // Get monitor details
      const monitor = await this.request<ApiMonitor>(`/api/monitors/${monitorId}`);

      // Transform history to chart data format
      const data: ChartDataPoint[] = history.map((point) => ({
        timestamp: new Date(point.timestamp * 1000).toISOString(),
        value: point.value,
        status: "success", // New API doesn't track status
      }));

      // Calculate summary stats
      const values = history.map((p) => p.value).filter((v) => v !== null) as number[];
      const min = values.length > 0 ? Math.min(...values) : null;
      const max = values.length > 0 ? Math.max(...values) : null;
      const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;

      return {
        monitor_id: monitor.id,
        monitor_name: monitor.name,
        url: "",
        data,
        summary: {
          total_points: history.length,
          date_range: `${days} days`,
          value_range: { min, max, avg },
          changes_detected: 0, // Not tracked in new API
          latest_value: monitor.value,
          latest_timestamp: monitor.computed_at || monitor.updated_at,
        },
      };
    } catch (error) {
      console.error("Failed to get chart data:", error);
      throw error;
    }
  }

  // Alert config operations not fully supported in new API
  async updateAlertConfig(
    monitorId: string,
    upperThreshold?: number,
    lowerThreshold?: number,
    alertLevel: string = "medium"
  ): Promise<AlertConfig> {
    // Build condition string
    const conditions: string[] = [];
    if (upperThreshold !== undefined) {
      conditions.push(`value > ${upperThreshold}`);
    }
    if (lowerThreshold !== undefined) {
      conditions.push(`value < ${lowerThreshold}`);
    }

    const condition = conditions.join(" OR ");

    try {
      const rule = await this.request<ApiAlertRule>("/api/alert-rules", {
        method: "POST",
        body: JSON.stringify({
          name: `Alert for ${monitorId}`,
          condition,
          level: alertLevel,
          enabled: true,
          cooldown_seconds: 300,
          actions: [],
        }),
      });

      return {
        monitor_id: monitorId,
        upper_threshold: upperThreshold || null,
        lower_threshold: lowerThreshold || null,
        alert_level: rule.level,
        created_at: rule.created_at,
        updated_at: rule.updated_at,
      };
    } catch (error) {
      console.error("Failed to update alert config:", error);
      throw error;
    }
  }

  async deleteAlertConfig(monitorId: string): Promise<void> {
    // This is problematic - we need the rule ID, not monitor ID
    // Skipping for now as it's not critical
    console.warn("Delete alert config not fully supported in new API");
  }

  // Constant cards are just regular monitors in the new API
  async updateConstantCard(
    monitorId: string,
    value: number,
    name?: string,
    unit?: string,
    description?: string,
    color?: string
  ): Promise<void> {
    const body: Record<string, string | number | boolean> = {
      formula: value.toString(), // Constant value as formula
    };
    if (name !== undefined) body.name = name;
    if (unit !== undefined) body.unit = unit;
    if (description !== undefined) body.description = description;
    if (color !== undefined) body.color = color;

    await this.request(`/api/monitors/${monitorId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async deleteConstantCard(monitorId: string): Promise<void> {
    await this.request(`/api/monitors/${monitorId}`, {
      method: "DELETE",
    });
  }

  async createConstantCard(
    name: string,
    value: number,
    unit?: string,
    description?: string,
    color?: string
  ): Promise<{ monitor_id: string }> {
    const body: Record<string, string | number> = {
      name,
      formula: value.toString(), // Constant value as formula
      decimal_places: 2,
    };
    if (unit) body.unit = unit;
    if (description) body.description = description;
    if (color) body.color = color;

    const result = await this.request<ApiMonitor>("/api/monitors", {
      method: "POST",
      body: JSON.stringify(body),
    });

    return { monitor_id: result.id };
  }
}

export const api = new MatsuAPI();
