export const MQTT_TOPIC_SEGMENTS = {
  sensors: 'sensors',
  fish: 'fish',
  plants: 'plants',
  cameras: 'cameras',
  commands: 'commands',
} as const;

export function buildTopicPrefix(prefix: string): string {
  return prefix.replace(/\/+$/, '');
}

export function buildSubscribeTopics(prefix: string): string[] {
  const base = buildTopicPrefix(prefix);
  return [
    `${base}/${MQTT_TOPIC_SEGMENTS.sensors}/#`,
    `${base}/${MQTT_TOPIC_SEGMENTS.fish}/#`,
    `${base}/${MQTT_TOPIC_SEGMENTS.plants}/#`,
    `${base}/${MQTT_TOPIC_SEGMENTS.cameras}/#`,
    `${base}/${MQTT_TOPIC_SEGMENTS.commands}/#`,
  ];
}

export function buildPublishTopic(prefix: string, segment: string, suffix = ''): string {
  const base = buildTopicPrefix(prefix);
  const path = suffix ? `${segment}/${suffix}` : segment;
  return `${base}/${path}`.replace(/\/+/g, '/');
}
