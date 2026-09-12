export type IcarusDeploymentSlice = "full" | "research_pilot";

export function getDeploymentSlice(environment: Record<string, string | undefined> = process.env): IcarusDeploymentSlice {
  if (environment.ICARUS_DEPLOYMENT_SLICE === "full") return "full";
  if (environment.ICARUS_DEPLOYMENT_SLICE === "research_pilot") return "research_pilot";
  return environment.VERCEL === "1" ? "research_pilot" : "full";
}
