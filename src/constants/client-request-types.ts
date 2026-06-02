export const CLIENT_REQUEST_TYPES = [
  'fulfillment',
  'retrieval_redeployment',
  'cross_border',
  'itad',
] as const;

export type ClientRequestType = (typeof CLIENT_REQUEST_TYPES)[number];

export const CLIENT_REQUEST_TYPE_OPTIONS: {
  value: ClientRequestType;
  label: string;
  shortLabel: string;
  description: string;
  color: string;
}[] = [
  {
    value: 'fulfillment',
    label: 'Device fulfillment',
    shortLabel: 'Fulfillment',
    description: 'New device procurement, specs, employee shipping, and MRP pricing.',
    color: '#f97316',
  },
  {
    value: 'retrieval_redeployment',
    label: 'Retrieval, storage & redeployment',
    shortLabel: 'Retrieval',
    description: 'Pick up devices, store at warehouse, and redeploy — addresses, vendor, and payment.',
    color: '#8b5cf6',
  },
  {
    value: 'cross_border',
    label: 'Cross-border shipping',
    shortLabel: 'Cross-border',
    description: 'Move devices between countries with POCs, documentation, and pricing.',
    color: '#3b82f6',
  },
  {
    value: 'itad',
    label: 'ITAD (asset disposal)',
    shortLabel: 'ITAD',
    description: 'IT asset disposal services, device count, ITAD vendor, and pricing.',
    color: '#22c55e',
  },
];

export function getClientRequestTypeMeta(type: string | undefined | null) {
  return CLIENT_REQUEST_TYPE_OPTIONS.find((o) => o.value === type)
    ?? CLIENT_REQUEST_TYPE_OPTIONS[0];
}
