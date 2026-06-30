import { handleStatus, type ApiRequest, type ApiResponse } from "../server/apiHandlers";

export default function handler(req: ApiRequest, res: ApiResponse) {
  return handleStatus(req, res);
}
