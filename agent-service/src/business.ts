export type BusinessSystem = {
  key: string;
  name: string;
  purpose: string;
  healthUrl?: string;
};

const env = process.env;

export const BUSINESS_SYSTEMS: BusinessSystem[] = [
  {
    key: "hub",
    name: "V79 Hub",
    purpose: "Central customer, subscription and ecosystem control center.",
    healthUrl: env.V79_HUB_HEALTH_URL || "http://v79-hub:3040/api/health",
  },
  {
    key: "website",
    name: "V79 Digital Website",
    purpose: "Public website, lead capture and business information.",
    healthUrl: env.V79_WEBSITE_HEALTH_URL,
  },
  {
    key: "lasertag",
    name: "CombatZone SLU",
    purpose: "Laser Tag bookings, customers, events and store operations.",
    healthUrl: env.V79_LASERTAG_HEALTH_URL,
  },
  {
    key: "marketing",
    name: "V79 Marketing",
    purpose: "Campaigns, leads, content and marketing performance.",
    healthUrl: env.V79_MARKETING_HEALTH_URL,
  },
  {
    key: "pos",
    name: "V79 POS",
    purpose: "Sales, inventory, vendors and reorder intelligence.",
    healthUrl: env.V79_POS_HEALTH_URL,
  },
  {
    key: "tiquet",
    name: "V79 Tiquet",
    purpose: "Customer support and service tickets.",
    healthUrl: env.V79_TIQUET_HEALTH_URL,
  },
  {
    key: "ffpro",
    name: "Fire Finance Pro",
    purpose: "Finance, cashflow, budgeting and business planning.",
    healthUrl: env.V79_FFPRO_HEALTH_URL,
  },
  {
    key: "academy",
    name: "V79 Academy",
    purpose: "Training courses, students and learning operations.",
    healthUrl: env.V79_ACADEMY_HEALTH_URL,
  },
  {
    key: "games",
    name: "Gaming Studio J",
    purpose: "Children's games, learning content and usage analytics.",
    healthUrl: env.V79_GAMES_HEALTH_URL,
  },
];

export function getBusinessSystem(key: string) {
  return BUSINESS_SYSTEMS.find(
    (system) => system.key.toLowerCase() === key.trim().toLowerCase(),
  );
}
