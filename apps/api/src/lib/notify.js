import { Queue } from "bullmq";
import { redis } from "./redis.js";

const queue = new Queue("client-notify", { connection: redis });

export async function queueClientNotify(projectId, eventType, detail) {
  try {
    // Worker filters projects with no active email shares; queueing is cheap.
    await queue.add("notify", {
      project_id: projectId,
      events: [{ type: eventType, detail }]
    }, {
      delay: 300000,
      removeOnComplete: 50,
      removeOnFail: 20
    });
  } catch (err) {
    console.warn("[notify] queue failed:", err.message);
  }
}
