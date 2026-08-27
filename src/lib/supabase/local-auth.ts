type LocalAuthEnvironment = Partial<Pick<NodeJS.ProcessEnv, "NODE_ENV" | "ICARUS_LOCAL_AUTH_BYPASS" | "ICARUS_LOCAL_AUTH_EMAIL" | "ICARUS_LOCAL_AUTH_PASSWORD">>;

export type LocalAuthCredentials = { email: string; password: string };

export function isLocalAuthBypassEnabled(environment: LocalAuthEnvironment = process.env) {
  return environment.NODE_ENV === "development" && environment.ICARUS_LOCAL_AUTH_BYPASS === "true";
}

export function getLocalAuthBypassCredentials(environment: LocalAuthEnvironment = process.env): LocalAuthCredentials | null {
  if (!isLocalAuthBypassEnabled(environment)) return null;

  const email = environment.ICARUS_LOCAL_AUTH_EMAIL?.trim();
  const password = environment.ICARUS_LOCAL_AUTH_PASSWORD;
  if (!email || !password) throw new Error("Local auth bypass is enabled but its server-only email or password is missing.");

  return { email, password };
}
