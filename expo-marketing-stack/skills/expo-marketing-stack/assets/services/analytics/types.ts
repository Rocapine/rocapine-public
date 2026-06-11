export interface AnalyticsEvent {
  name: string;
  properties: Record<string, any>;
}

export interface AnalyticsProperty {
  key: string;
  value: any;
}

export interface AnalyticsPurchaseEventProperties {
  ltv: number;
  currency: string;
  transactionId: string;
  isTrial: boolean;
  planFrequency: string;
  country: string;
  platform: string;
  sku: string;
}
