import { requireUser } from "@/lib/auth/current-user";
import { todayISO } from "@/lib/dates";
import { ensureSynced } from "@/lib/fixed/sync";
import { getCalculatorData } from "@/lib/queries/calculator";

export async function GET() {
  const user = await requireUser();
  await ensureSynced(user);
  const data = await getCalculatorData(user.id, todayISO());
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
