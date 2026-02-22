import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      provider: string;
      apiKey: string;
      azureEndpoint?: string;
      azureDeployment?: string;
      azureApiVersion?: string;
    };

    if (!body.apiKey) {
      return NextResponse.json(
        { ok: false, message: "API key is required" },
        { status: 400 },
      );
    }

    if (body.provider === "azure_openai") {
      // Azure OpenAI: use a simple fetch to the deployments endpoint
      const endpoint = body.azureEndpoint?.replace(/\/+$/, "");
      if (!endpoint || !body.azureDeployment || !body.azureApiVersion) {
        return NextResponse.json(
          { ok: false, message: "Azure endpoint, deployment, and API version are required" },
          { status: 400 },
        );
      }

      const url = `${endpoint}/openai/deployments/${body.azureDeployment}?api-version=${body.azureApiVersion}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "api-key": body.apiKey },
      });

      if (res.ok) {
        return NextResponse.json({ ok: true, message: "Azure OpenAI connected" });
      }

      const errText = await res.text().catch(() => "Unknown error");
      return NextResponse.json({
        ok: false,
        message: `Azure returned ${String(res.status)}: ${errText.slice(0, 200)}`,
      });
    }

    // Standard OpenAI: list models as a lightweight test
    const client = new OpenAI({ apiKey: body.apiKey });
    const models = await client.models.list();
    const count = models.data?.length ?? 0;

    return NextResponse.json({
      ok: true,
      message: `OpenAI connected (${String(count)} models available)`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
