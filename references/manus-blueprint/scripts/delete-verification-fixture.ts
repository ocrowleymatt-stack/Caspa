import assert from "node:assert/strict";
import { appRouter } from "../server/routers";
import { getUserByOpenId } from "../server/db";
import { ENV } from "../server/_core/env";
import type { TrpcContext } from "../server/_core/context";

async function main() {
  const projectId = Number(process.argv[2]);
  const title = process.argv.slice(3).join(" ");
  assert(Number.isInteger(projectId) && projectId > 0, "Provide a positive project ID.");
  assert(title.startsWith("CASPA verification ") || title.startsWith("CASPA production verification ") || title.startsWith("CASPA auto-draft verification "), "Provide the exact disposable fixture title.");
  const user = await getUserByOpenId(ENV.ownerOpenId);
  assert(user, "Project owner not found.");
  const caller = appRouter.createCaller({
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  });
  const project = await caller.projects.get({ projectId });
  if (project.currentState !== "archived") {
    const archived = await caller.projects.archive({ projectId });
    assert.equal(archived.currentState, "archived");
  }
  await caller.settings.deleteProject({ projectId, confirmation: title });
  console.log(`Archived and deleted disposable CASPA project ${projectId}.`);
}

main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1); });
