export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function paramId(value: string | string[] | undefined): string {
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) {
    throw new HttpError(400, "VALIDATION", "Missing id.");
  }
  return id;
}

export function clientIp(req: { ip?: string; get: (name: string) => string | undefined }): string | undefined {
  return req.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.ip;
}
