import { getCarbonServiceRole } from "@carbon/auth/client.server";
import { inngest } from "../../client";

export const jobPlanningFunction = inngest.createFunction(
  { id: "job-planning", retries: 3 },
  { event: "carbon/job-planning" },
  async ({ event, step }) => {
    const { jobId, companyId, userId, shouldSchedule = false } = event.data;
    const serviceRole = getCarbonServiceRole();

    const recalculate = await step.run("recalculate-job-requirements", () =>
      serviceRole.functions.invoke("recalculate", {
        body: {
          type: "jobRequirements",
          id: jobId,
          companyId,
          userId
        }
      })
    );

    if (recalculate.error) {
      throw new Error(
        recalculate.error.message || "Failed to recalculate job requirements"
      );
    }

    const mrp = await step.run("run-job-mrp", () =>
      serviceRole.functions.invoke("mrp", {
        body: {
          type: "job",
          id: jobId,
          companyId,
          userId
        }
      })
    );

    if (mrp.error) {
      throw new Error(mrp.error.message || "Failed to run MRP");
    }

    if (!shouldSchedule) {
      return {
        success: true,
        scheduled: false
      };
    }

    const schedule = await step.run("schedule-job", () =>
      serviceRole.functions.invoke("schedule", {
        body: {
          jobId,
          companyId,
          userId,
          mode: "initial",
          direction: "backward"
        }
      })
    );

    if (schedule.error) {
      throw new Error(schedule.error.message || "Failed to schedule job");
    }

    return {
      success: true,
      scheduled: true,
      schedule: schedule.data
    };
  }
);
