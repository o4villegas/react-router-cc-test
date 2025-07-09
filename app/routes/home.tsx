import type { Route } from "./+types/home";
import { DamageAssessment } from "../components/damage-assessment";
import { loadClientConfig } from "../utils/client-config";

export function meta({}: Route.MetaArgs) {
  const config = loadClientConfig();
  
  return [
    { title: `${config.ui.app_name} - Water Damage Assessment` },
    { name: "description", content: "AI-powered water damage assessment with industry expertise and IICRC standards" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#2563eb" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  const config = loadClientConfig();
  const env = (context as any).cloudflare?.env;
  
  // Determine environment from context
  const environment = env?.NODE_ENV || env?.CLOUDFLARE_ENV || 'development';
  const environmentConfig = loadClientConfig(environment);
  
  return { 
    message: env?.VALUE_FROM_CLOUDFLARE || "Smart Damage Assessment Tool",
    apiEndpoint: environmentConfig.api.endpoints.damage_assessment,
    searchEndpoint: environmentConfig.api.endpoints.knowledge_search,
    config: environmentConfig,
    environment,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <DamageAssessment 
    apiEndpoint={loaderData.apiEndpoint} 
    searchEndpoint={loaderData.searchEndpoint}
    config={loaderData.config}
  />;
}
