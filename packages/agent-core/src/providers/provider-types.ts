export interface AIModel {
  value: string;
  label: string;
}

export interface AIProvider {
  name: string;
  type: string;
  apiUrl: string;
  apiKey: string;
  defaultModel: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  models: AIModel[];
}

export interface AIProvidersConfigType {
  providers: AIProvider[];
  defaultProvider: string | null;
}
