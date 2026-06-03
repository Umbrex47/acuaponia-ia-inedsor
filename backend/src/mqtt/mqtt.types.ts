export interface MqttInboundMessage {
  topic: string;
  payload: string;
  receivedAt: string;
}

export interface MqttConnectionStatus {
  connected: boolean;
  error: string | null;
}
