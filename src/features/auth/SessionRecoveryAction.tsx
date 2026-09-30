import { useNavigate } from "react-router-dom";
import { ApiClientError } from "../../app/api-client.ts";
import { Button } from "@/components/ui/button.tsx";
import { getLoginPath, safeReturnTo } from "../../platform/auth.ts";

export function SessionRecoveryAction({ error, returnTo, description }: {
  readonly error: unknown;
  readonly returnTo: string;
  readonly description?: string;
}) {
  const navigate = useNavigate();
  if (!(error instanceof ApiClientError) || error.status !== 401) return null;
  return <div className="flex flex-col gap-2 text-sm">
    {description && <p>{description}</p>}
    <Button type="button" variant="outline" onClick={() => navigate(getLoginPath(safeReturnTo(returnTo)))}>다시 로그인하고 이어하기</Button>
  </div>;
}
