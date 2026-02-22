import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pat: string };

    if (!body.pat) {
      return NextResponse.json(
        { ok: false, message: "PAT is required" },
        { status: 400 },
      );
    }

    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${body.pat}`,
        Accept: "application/vnd.github+json",
      },
    });

    if (res.ok) {
      const data = (await res.json()) as { login?: string };
      return NextResponse.json({
        ok: true,
        message: `Authenticated as ${data.login ?? "unknown"}`,
      });
    }

    const errText = await res.text().catch(() => "Unknown error");
    return NextResponse.json({
      ok: false,
      message: `GitHub returned ${String(res.status)}: ${errText.slice(0, 200)}`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
