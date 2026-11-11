import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/api/csrf";
import { handleApiError, readJson, requireApiTenant } from "@/lib/api/responses";
import {
  bulkUpdateUserRepositoriesSchema,
  userRepositoryListQuerySchema,
} from "@/lib/validation/schemas";
import { toUserRepositoryDto } from "@/server/dto/user-repository-dto";
import { services } from "@/server/services";

export const dynamic = "force-dynamic";

function readQuery(request: Request): Record<string, string> {
  const query: Record<string, string> = {};

  new URL(request.url).searchParams.forEach((value, key) => {
    if (value !== "") {
      query[key] = value;
    }
  });

  return query;
}

export async function GET(request: Request) {
  try {
    const tenant = await requireApiTenant();
    const options = userRepositoryListQuerySchema.parse(readQuery(request));
    const page = await services.userRepositories.listPage(tenant, options);

    return NextResponse.json({
      data: page.records.map(toUserRepositoryDto),
      meta: {
        page: page.page,
        perPage: page.perPage,
        total: page.total,
        totalPages: page.totalPages,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);

    const tenant = await requireApiTenant();
    const body = bulkUpdateUserRepositoriesSchema.parse(await readJson(request));
    const { ids, ...data } = body;
    const updated = await services.userRepositories.updateMany(tenant, data, ids);

    if (data.trackingEnabled) {
      await services.projects.ensureForTrackedRepositories(tenant);
    }

    return NextResponse.json({ data: { updated } });
  } catch (error) {
    return handleApiError(error);
  }
}
