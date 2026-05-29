/** Переменные, которые middleware auth кладёт в контекст Hono. */
export interface AppVariables {
  userId: string;
  username: string;
}

export type AppEnv = { Variables: AppVariables };
