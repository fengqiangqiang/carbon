import { assertIsPost, error, success } from "@carbon/auth";
import { requirePermissions } from "@carbon/auth/auth.server";
import { getCarbonServiceRole } from "@carbon/auth/client.server";
import { flash } from "@carbon/auth/session.server";
import { trigger } from "@carbon/jobs";
import type { ActionFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { jobStatus, updateJobStatus } from "~/modules/production";
import { path, requestReferrer } from "~/utils/path";

export async function action({ request, params }: ActionFunctionArgs) {
  assertIsPost(request);
  const { client, companyId, userId } = await requirePermissions(request, {
    update: "production"
  });

  const { jobId: id } = params;
  if (!id) throw new Error("Could not find id");

  const url = new URL(request.url);
  const shouldSchedule = url.searchParams.get("schedule") === "1";

  const formData = await request.formData();
  const status = formData.get("status") as (typeof jobStatus)[number];
  const selectedPurchaseOrdersBySupplierId = formData.get(
    "selectedPurchaseOrdersBySupplierId"
  ) as string | null;

  if (!status || !jobStatus.includes(status)) {
    throw redirect(
      path.to.job(id),
      await flash(request, error(null, "Invalid status"))
    );
  }

  if (status === "Ready") {
    const { data } = await client
      .from("job")
      .select("item(itemReplenishment(manufacturingBlocked))")
      .eq("id", id)
      .single();

    if (data?.item?.itemReplenishment?.manufacturingBlocked) {
      throw redirect(
        requestReferrer(request) ?? path.to.job(id),
        await flash(request, error(null, "Manufacturing is blocked"))
      );
    }
  }

  if (["Ready", "Planned"].includes(status) && shouldSchedule) {
    try {
      const purchaseOrdersBySupplierId = JSON.parse(
        selectedPurchaseOrdersBySupplierId ?? "{}"
      );

      if (Object.keys(purchaseOrdersBySupplierId).length > 0) {
        const serviceRole = getCarbonServiceRole();
        const createPurchaseOrders = await serviceRole.functions.invoke(
          "create",
          {
            body: {
              type: "purchaseOrderFromJob",
              jobId: id,
              purchaseOrdersBySupplierId,
              companyId,
              userId
            }
          }
        );

        if (createPurchaseOrders.error) {
          throw createPurchaseOrders.error;
        }
      }
    } catch (err) {
      console.error(err);
      throw redirect(
        requestReferrer(request) ?? path.to.job(id),
        await flash(request, error(err, "Failed to create purchase orders"))
      );
    }
  }

  const update = await updateJobStatus(client, {
    id,
    status,
    assignee: ["Cancelled"].includes(status) ? null : undefined,
    updatedBy: userId
  });
  if (update.error) {
    throw redirect(
      requestReferrer(request) ?? path.to.job(id),
      await flash(request, error(update.error, "Failed to update job status"))
    );
  }

  if (status === "Ready" && shouldSchedule) {
    const releaseDate = await client
      .from("job")
      .update({
        releasedDate: new Date().toISOString()
      })
      .eq("id", id);

    if (releaseDate.error) {
      throw redirect(
        requestReferrer(request) ?? path.to.job(id),
        await flash(
          request,
          error(releaseDate.error, "Failed to set released date")
        )
      );
    }
  }

  if (["Planned", "Ready"].includes(status)) {
    await trigger("job-planning", {
      jobId: id,
      companyId,
      userId,
      shouldSchedule
    }).catch((err) => {
      console.error("Failed to trigger job planning", err);
    });
  }

  if (status === "Closed") {
    const serviceRole = await getCarbonServiceRole();
    await serviceRole.functions.invoke("close-job", {
      body: { jobId: id, userId, companyId }
    });
  }

  if (status === "Planned") {
    throw redirect(
      path.to.jobMaterials(id),
      await flash(request, success("Job marked as planned"))
    );
  }

  throw redirect(
    requestReferrer(request) ?? path.to.job(id),
    await flash(request, success("Updated job status"))
  );
}
