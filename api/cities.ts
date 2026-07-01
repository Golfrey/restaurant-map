import { handleCities, type ApiRequest, type ApiResponse } from "../server/apiHandlers.js";

export default function handler(req: ApiRequest, res: ApiResponse) {
  return handleCities(req, res);
}
