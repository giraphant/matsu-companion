import { getPreferenceValues } from "@raycast/api";
import fetch from "node-fetch";

interface Preferences {
  apiUrl: string;
  username: string;
  password: string;
}

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

  constructor() {
    const preferences = getPreferenceValues<Preferences>();
    this.baseUrl = preferences.apiUrl.replace(/\/$/, ""); // Remove trailing slash
    this.username = preferences.username;
    this.password = preferences.password;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }

  async login(): Promise<boolean> {
    try {
      const response = await this.request<{ success: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: this.username,
          password: this.password,
        }),
      });
      return response.success;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  }

  async getMonitors(): Promise<MonitorSummary[]> {
    return this.request<MonitorSummary[]>("/api/monitors");
  }

  async getAlertConfigs(): Promise<AlertConfig[]> {
    return this.request<AlertConfig[]>("/api/alerts/configs");
  }

  async getChartData(monitorId: string, days: number = 7): Promise<ChartData> {
    return this.request<ChartData>(`/api/chart-data/${monitorId}?days=${days}`);
  }

  async updateAlertConfig(
    monitorId: string,
    upperThreshold?: number,
    lowerThreshold?: number,
    alertLevel: string = "medium"
  ): Promise<AlertConfig> {
    return this.request<AlertConfig>("/api/alerts/config", {
      method: "POST",
      body: JSON.stringify({
        monitor_id: monitorId,
        upper_threshold: upperThreshold,
        lower_threshold: lowerThreshold,
        alert_level: alertLevel,
      }),
    });
  }

  async deleteAlertConfig(monitorId: string): Promise<void> {
    await this.request(`/api/alerts/config/${monitorId}`, {
      method: "DELETE",
    });
  }

  async updateConstantCard(
    monitorId: string,
    value: number,
    name?: string,
    unit?: string,
    description?: string,
    color?: string
  ): Promise<void> {
    const body: Record<string, string | number> = { value };
    if (name !== undefined) body.name = name;
    if (unit !== undefined) body.unit = unit;
    if (description !== undefined) body.description = description;
    if (color !== undefined) body.color = color;

    await this.request(`/api/constant/${monitorId}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  }

  async deleteConstantCard(monitorId: string): Promise<void> {
    await this.request(`/api/constant/${monitorId}`, {
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
    const body: Record<string, string | number> = { name, value };
    if (unit) body.unit = unit;
    if (description) body.description = description;
    if (color) body.color = color;

    return this.request<{ monitor_id: string }>("/api/constant", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }
}

export const api = new MatsuAPI();
