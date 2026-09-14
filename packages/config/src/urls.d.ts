export interface AppUrls {
  accounts: string;
  auth: string;
  admin: string;
}

export function getAppUrls(currentOrigin?: string): AppUrls;
export default getAppUrls;
