import type { Route } from "./+types/home";
import { Chatbot } from "../components/chatbot";
import { loadClientConfig } from "../utils/client-config";

export function meta({}: Route.MetaArgs) {
  const config = loadClientConfig();
  
  return [
    { title: `${config.ui.app_name} - AI Water Damage Assessment` },
    { name: "description", content: "Professional AI-powered water damage assessment with computer vision and industry expertise" },
    { name: "viewport", content: "width=device-width, initial-scale=1" },
    { name: "theme-color", content: "#ff6b35" },
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
    conversationEndpoint: "/api/conversation",
    config: environmentConfig,
    environment,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <div className="min-h-screen p-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Chatbot 
        apiEndpoint={loaderData.apiEndpoint}
        config={loaderData.config}
      />
    </div>
  );
}
