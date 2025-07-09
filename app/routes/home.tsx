import type { Route } from "./+types/home";
import { DamageAssessment } from "../components/damage-assessment";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Smart Damage Assessment Tool" },
    { name: "description", content: "AI-powered water damage assessment with industry expertise" },
  ];
}

export function loader({ context }: Route.LoaderArgs) {
  return { 
    message: context.cloudflare.env.VALUE_FROM_CLOUDFLARE,
    apiEndpoint: "/api/assess-damage",
    searchEndpoint: "/api/knowledge-search"
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  return <DamageAssessment 
    apiEndpoint={loaderData.apiEndpoint} 
    searchEndpoint={loaderData.searchEndpoint}
  />;
}
