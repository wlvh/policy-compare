export const aviationProfile = {
  version: "aviation/1.0.0",
  fields: {
    "INSURED:": "name",
    "REINSURED:": "name",
    "ADDRESS:": "address",
    "PERIOD:": "policy_period",
    "SUMS INSURED:": "sum_insured",
    "SUM INSURED:": "sum_insured",
    "DEDUCTIBLE:": "deductible",
    "RATE:": "rate",
    "TOLERANCE:": "tolerance",
    "ENDORSEMENT:": "endorsement",
    "REPEATED HEADER LIMIT:": "header_limit",
  } as Record<string, string>,
  subjects: {
    "INSURED:": "original_insured",
    "REINSURED:": "reinsured",
  } as Record<string, string>,
  subjectFields: ["name", "address"],
  table: {
    name: "aircraft_schedule",
    headers: ["REGISTRATION", "SERIAL", "MODEL", "CCY", "AGREED VALUE"],
    columns: ["registration", "serial", "model", "currency", "agreed_value"],
    primary: "registration",
    secondary: "serial",
  },
  thresholds: { local: 0.6, global: 0.95, globalMinTokens: 8 },
  budget: {
    candidates: 20_000,
    tokenProducts: 100_000_000,
    diffProducts: 4_000_000,
  },
  dateFormat: "DD Month YYYY",
};
export type Profile = typeof aviationProfile;
