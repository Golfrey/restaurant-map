import { handleCronRefresh, type ApiRequest, type ApiResponse } from "../../server/apiHandlers.js";

export const config = {
  maxDuration: 300
};

export default function handler(req: ApiRequest, res: ApiResponse) {
  return handleCronRefresh(req, res);
}
