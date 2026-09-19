export interface AppUrls {
  app: string;
  accounts: string;
  auth: string;
  admin: string;
}

export function getAppUrls(currentOrigin?: string): AppUrls;
export default getAppUrls;
