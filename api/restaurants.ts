import { handleRestaurants, type ApiRequest, type ApiResponse } from "../server/apiHandlers.js";

export default function handler(req: ApiRequest, res: ApiResponse) {
  return handleRestaurants(req, res);
}
