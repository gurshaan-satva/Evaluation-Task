import { Response } from "express";

interface ApiResponse {
  status: string;
  message: string;
  data: any;
}

export function sendSuccess(
  res: Response,
  message: string,
  data: any = null,
  statusCode: number = 200
): Response {
  const response: ApiResponse = {
    status: "success",
    message,
    data
  };
  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  data: any = null,
  statusCode: number = 400
): Response {
  const response: ApiResponse = {
    status: "error",
    message,
    data
  };
  return res.status(statusCode).json(response);
}
