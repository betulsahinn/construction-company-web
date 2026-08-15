import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_CONTACT_TO_EMAIL = "info@icmimarmehmeteser.com";
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as typeof globalThis & {
  contactFormRateLimit?: Map<string, RateLimitEntry>;
};

const contactFormRateLimit =
  globalForRateLimit.contactFormRateLimit ?? new Map<string, RateLimitEntry>();

globalForRateLimit.contactFormRateLimit = contactFormRateLimit;

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(5).max(40),
  message: z.string().trim().min(10).max(4000),
  website: z.string().trim().max(200).optional().default(""),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please complete all fields with valid information." },
        { status: 400 },
      );
    }

    const submission = parsed.data;

    if (submission.website) {
      return NextResponse.json({ success: true });
    }

    const clientKey = getClientKey(request);
    if (isRateLimited(clientKey)) {
      return NextResponse.json(
        { error: "Too many messages sent. Please try again later." },
        { status: 429 },
      );
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.CONTACT_FROM_EMAIL;
    const toEmail = process.env.CONTACT_TO_EMAIL || DEFAULT_CONTACT_TO_EMAIL;

    if (!resendApiKey || !fromEmail) {
      return NextResponse.json(
        { error: "Message delivery is not configured yet." },
        { status: 503 },
      );
    }

    const resendResponse = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: submission.email,
        subject: `New contact form message from ${submission.name}`,
        text: formatPlainTextMessage(submission),
        html: formatHtmlMessage(submission),
      }),
    });

    if (!resendResponse.ok) {
      return NextResponse.json(
        { error: "Message could not be sent. Please try again later." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Message could not be sent. Please try again later." },
      { status: 500 },
    );
  }
}

function getClientKey(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "unknown";
}

function isRateLimited(clientKey: string) {
  const now = Date.now();
  const existing = contactFormRateLimit.get(clientKey);

  if (!existing || existing.resetAt <= now) {
    contactFormRateLimit.set(clientKey, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });

    return false;
  }

  existing.count += 1;
  contactFormRateLimit.set(clientKey, existing);

  return existing.count > RATE_LIMIT_MAX_SUBMISSIONS;
}

function formatPlainTextMessage({
  name,
  email,
  phone,
  message,
}: z.infer<typeof contactSchema>) {
  return [
    "New contact form message",
    "",
    `Name: ${name}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    "",
    "Message:",
    message,
  ].join("\n");
}

function formatHtmlMessage({
  name,
  email,
  phone,
  message,
}: z.infer<typeof contactSchema>) {
  return `
    <div>
      <h2>New contact form message</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
    </div>
  `;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
