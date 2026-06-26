export interface ProviderTypeOption {
  value: string;
  label: string;
}

export interface ModelEntry {
  value: string;
  label: string;
}

export interface Provider {
  name: string;
  type: string;
  apiUrl: string;
  apiKey: string;
  defaultModel: string;
  models: ModelEntry[];
}

export interface ProvidersData {
  providers: Provider[];
  defaultProvider: string;
}

export const EMPTY_PROVIDERS_DATA: ProvidersData = {
  providers: [],
  defaultProvider: '',
};
