import { LocalStorage } from "@raycast/api";

const ALIASES_KEY = "monitor-aliases";
const TAGS_KEY = "monitor-tags";

interface MonitorAliases {
  [monitorId: string]: string;
}

interface MonitorTags {
  [monitorId: string]: string[];
}

export async function getMonitorAlias(monitorId: string): Promise<string | undefined> {
  const aliases = await getAllAliases();
  return aliases[monitorId];
}

export async function setMonitorAlias(monitorId: string, alias: string): Promise<void> {
  const aliases = await getAllAliases();
  if (alias.trim()) {
    aliases[monitorId] = alias.trim();
  } else {
    delete aliases[monitorId];
  }
  await LocalStorage.setItem(ALIASES_KEY, JSON.stringify(aliases));
}

export async function deleteMonitorAlias(monitorId: string): Promise<void> {
  const aliases = await getAllAliases();
  delete aliases[monitorId];
  await LocalStorage.setItem(ALIASES_KEY, JSON.stringify(aliases));
}

export async function getAllAliases(): Promise<MonitorAliases> {
  const aliasesStr = await LocalStorage.getItem<string>(ALIASES_KEY);
  if (!aliasesStr) {
    return {};
  }
  try {
    return JSON.parse(aliasesStr);
  } catch (error) {
    console.error("Failed to parse aliases:", error);
    return {};
  }
}

export function getDisplayName(monitorName: string | null, monitorId: string, localAlias?: string): string {
  if (localAlias) {
    return localAlias;
  }
  return monitorName || monitorId;
}

// Tag management functions
export async function getMonitorTags(monitorId: string): Promise<string[]> {
  const tags = await getAllTags();
  return tags[monitorId] || [];
}

export async function setMonitorTags(monitorId: string, tags: string[]): Promise<void> {
  const allTags = await getAllTags();
  const cleanTags = tags.map(t => t.trim()).filter(t => t.length > 0);

  if (cleanTags.length > 0) {
    allTags[monitorId] = cleanTags;
  } else {
    delete allTags[monitorId];
  }
  await LocalStorage.setItem(TAGS_KEY, JSON.stringify(allTags));
}

export async function deleteMonitorTags(monitorId: string): Promise<void> {
  const tags = await getAllTags();
  delete tags[monitorId];
  await LocalStorage.setItem(TAGS_KEY, JSON.stringify(tags));
}

export async function getAllTags(): Promise<MonitorTags> {
  const tagsStr = await LocalStorage.getItem<string>(TAGS_KEY);
  if (!tagsStr) {
    return {};
  }
  try {
    return JSON.parse(tagsStr);
  } catch (error) {
    console.error("Failed to parse tags:", error);
    return {};
  }
}

export async function getAllUniqueTagNames(): Promise<string[]> {
  const allTags = await getAllTags();
  const tagSet = new Set<string>();
  Object.values(allTags).forEach(tags => {
    tags.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}
