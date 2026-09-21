import nodemailer from "nodemailer";
import { env, fakeMail, isProd } from "../config/env.js";
import { prisma } from "./prisma.js";

const transport = fakeMail
  ? nodemailer.createTransport({ jsonTransport: true })
  : nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      requireTLS: !env.smtp.secure && env.smtp.port === 587,
      auth:
        env.smtp.user && env.smtp.pass
          ? { user: env.smtp.user, pass: env.smtp.pass }
          : undefined,
    });

type MailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  userId?: string;
  type: string;
  /** Stored in the notification log. Never put a password here. */
  logBody?: string;
};

export async function sendMail(input: MailInput): Promise<void> {
  try {
    await transport.sendMail({
      from: env.smtp.from,
      replyTo: env.emailReplyTo,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  } catch (error) {
    if (input.userId) {
      await prisma.notification.create({
        data: {
          userId: input.userId,
          type: input.type,
          subject: input.subject,
          body: input.logBody ?? "Email failed. Body not stored.",
          status: "FAILED",
          error: error instanceof Error ? error.message : "send failed",
        },
      });
    }
    throw error;
  }

  if (fakeMail) {
    console.log(`[mail:dev] ${input.subject} -> ${input.to}`);
    console.log(input.text);
  } else {
    console.log(`[mail] sent ${input.type} to ${input.to}`);
  }

  if (input.userId) {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        subject: input.subject,
        body: input.logBody ?? "Email sent. Sensitive details were not stored.",
        status: "SENT",
        sentAt: new Date(),
      },
    });
  }
}

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: string,
  userId?: string,
  roleLabel?: string,
): Promise<void> {
  if (!isProd) {
    console.log(`[otp:dev] ${to} ${purpose} ${code}`);
  }
  const isLogin = purpose === "login";
  const subject = isLogin ? "Your PVI-CAP sign-in code" : "Your PVI-CAP password reset code";
  const roleLine = roleLabel ? `You have logged in as ${roleLabel}.` : "";
  const portalLine = isLogin ? `Open the career assessment: ${env.corsOrigin}` : "";
  const text = [
    "Prakramika Vocational Institute",
    "",
    isLogin ? "Use this code to finish signing in to PVI-CAP." : "Use this code to reset your PVI-CAP password.",
    roleLine,
    portalLine,
    "",
    `Your OTP is ${code}`,
    "It is valid for 10 minutes.",
    "",
    "This message is from no-reply@prakramikavocationalinstitute.com.",
    "If you did not ask for this, you can ignore it.",
    "",
    env.instituteUrl,
  ]
    .filter((line) => line !== "")
    .join("\n");

  const html = wrapHtml(
    isLogin ? "Your sign-in code" : "Your password reset code",
    `
      <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">${
        isLogin ? "Use this code to finish signing in to PVI-CAP." : "Use this code to reset your PVI-CAP password."
      }</p>
      ${roleLabel ? `<p style="margin:0 0 12px;font-size:16px;line-height:1.5;">You have logged in as <strong>${escapeHtml(roleLabel)}</strong>.</p>` : ""}
      ${isLogin ? `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">Open the career assessment: <a href="${env.corsOrigin}" style="color:#377d41;">${escapeHtml(env.corsOrigin)}</a></p>` : ""}
      <p style="margin:0 0 8px;letter-spacing:0.4em;font-size:32px;font-weight:600;text-align:center;">${escapeHtml(code)}</p>
      <p style="margin:0 0 16px;font-size:14px;color:#5c6b66;text-align:center;">Your OTP · valid for 10 minutes</p>
      <p style="margin:0;font-size:13px;color:#5c6b66;">Sent from no-reply@prakramikavocationalinstitute.com · <a href="${env.instituteUrl}" style="color:#14604f;">prakramikavocationalinstitute.com</a></p>
    `,
  );

  await sendMail({
    to,
    userId,
    type: `otp.${purpose}`,
    subject,
    text,
    html,
    logBody: `OTP sent for ${purpose} to ${to}. Code is not stored.`,
  });
}

function wrapHtml(title: string, inner: string): string {
  const year = new Date().getFullYear();
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f4f1ea;font-family:'Segoe UI',Arial,sans-serif;color:#274054;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f1ea;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4e0d6;">
            <tr>
              <td style="background:#377d41;padding:18px 24px;text-align:center;color:#ffffff;letter-spacing:0.12em;font-size:13px;">
                PRAKRAMIKA VOCATIONAL INSTITUTE
              </td>
            </tr>
            <tr>
              <td style="background:#fffaf3;padding:10px 24px;text-align:center;border-bottom:3px solid #eb6860;">
                <p style="margin:0;font-size:15px;font-weight:700;color:#274054;">Career Assessment Platform</p>
                <p style="margin:4px 0 0;font-size:12px;color:#377d41;">Empowering neurodiverse learners for an independent life</p>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;font-size:22px;color:#274054;">${title}</h1>
                ${inner}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;font-size:13px;color:#5a5a5a;line-height:1.55;">
                No. 28, SRR Nagar, Nolambur, Chennai – 600037<br/>
                +91 9790892444 · info.prakramika@gmail.com<br/>
                <a href="${env.instituteUrl}" style="color:#377d41;">prakramikavocationalinstitute.com</a>
              </td>
            </tr>
            <tr>
              <td style="background:#274054;padding:14px 24px;text-align:center;color:#c9d2da;font-size:11px;">
                © ${year} Prakramika Vocational Institute · Sent from no-reply@prakramikavocationalinstitute.com
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEnrolmentEmail(input: {
  to: string;
  respondentFirstName: string;
  learnerName: string;
  relation: "PARENT" | "GUARDIAN" | "TEACHER" | "SELF" | "OTHER";
  username: string;
  password: string;
  userId: string;
}): Promise<void> {
  const signInUrl = env.corsOrigin;
  const isSelf = input.relation === "SELF";
  const subject = isSelf
    ? "You have been enrolled in PVI-CAP"
    : `${input.learnerName} has been enrolled in PVI-CAP`;

  const greeting = `Dear ${input.respondentFirstName},`;
  const intro = isSelf
    ? "You have been enrolled in the Prakramika Vocational Institute Career Assessment Platform (PVI-CAP)."
    : `${input.learnerName} has been enrolled in the Prakramika Vocational Institute Career Assessment Platform (PVI-CAP).`;
  const how = isSelf
    ? "Sign in with the username and password below. After you sign in, choose Child, enter the email code, and complete the child profile if this is your first visit."
    : `Sign in with the username and password below. After you sign in, choose who is at the computer (Parent, Teacher, Caregiver, or Child). We then email a one-time code to that person. The first time, you will fill ${input.learnerName}'s child profile, then start the career assessment. You can stop and come back — we save as you go.`;

  const text = [
    greeting,
    "",
    intro,
    how,
    "",
    `Login link: ${signInUrl}`,
    `Username: ${input.username}`,
    `Temporary password: ${input.password}`,
    "",
    "Please change this password after you first sign in.",
    "",
    "If you were not expecting this message, contact Prakramika Vocational Institute.",
  ].join("\n");

  const html = wrapHtml(
    isSelf ? "You are enrolled" : `${escapeHtml(input.learnerName)} is enrolled`,
    `
      <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">${escapeHtml(intro)}</p>
      <p style="margin:0 0 20px;font-size:16px;line-height:1.5;">${escapeHtml(how)}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background:#e7efe9;padding:16px;margin:0 0 16px;">
        <tr><td style="font-size:14px;padding:4px 0;"><strong>Login link</strong><br><a href="${signInUrl}" style="color:#377d41;">${escapeHtml(signInUrl)}</a></td></tr>
        <tr><td style="font-size:14px;padding:4px 0;"><strong>Username</strong><br>${escapeHtml(input.username)}</td></tr>
        <tr><td style="font-size:14px;padding:4px 0;"><strong>Temporary password</strong><br>${escapeHtml(input.password)}</td></tr>
      </table>
      <p style="margin:0;font-size:15px;line-height:1.5;">Please change this password after you first sign in.</p>
    `,
  );

  await sendMail({
    to: input.to,
    userId: input.userId,
    type: "account.enrolled",
    subject,
    text,
    html,
    logBody: `Enrolment email for learner "${input.learnerName}" sent to ${input.to}. Password was not stored.`,
  });
}

export async function sendStaffWelcomeEmail(to: string, firstName: string, userId: string): Promise<void> {
  await sendMail({
    to,
    userId,
    type: "account.created",
    subject: "Your PVI-CAP staff account",
    logBody: "Staff welcome email sent. Credentials were not included.",
    text: [
      `Hello ${firstName},`,
      "",
      "A staff account has been created for you on the PVI-CAP Digital Career Assessment Platform.",
      `Sign in at ${env.corsOrigin}`,
      "",
      "If you were not expecting this message, contact Prakramika Vocational Institute.",
    ].join("\n"),
  });
}

export async function sendRolePortalEmail(input: {
  to: string;
  roleLabel: string;
  childName: string;
  username: string;
  userId: string;
}): Promise<void> {
  const signInUrl = env.corsOrigin;
  const subject = `${input.childName}'s career assessment — ${input.roleLabel} access`;
  const text = [
    `Dear ${input.roleLabel},`,
    "",
    `You have been named as the ${input.roleLabel.toLowerCase()} for ${input.childName} on the Prakramika Career Assessment Platform.`,
    "",
    `Login link: ${signInUrl}`,
    `Username (the family sign-in): ${input.username}`,
    `Ask the parent for the password if you do not already have it. On the sign-in screen, choose ${input.roleLabel}. We will email you a one-time code.`,
    "",
    "If you were not expecting this message, contact Prakramika Vocational Institute.",
  ].join("\n");

  const html = wrapHtml(
    `${escapeHtml(input.roleLabel)} access`,
    `
      <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Dear ${escapeHtml(input.roleLabel)},</p>
      <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">You have been named as the ${escapeHtml(input.roleLabel.toLowerCase())} for <strong>${escapeHtml(input.childName)}</strong> on the Prakramika Career Assessment Platform.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background:#e7efe9;padding:16px;margin:0 0 16px;">
        <tr><td style="font-size:14px;padding:4px 0;"><strong>Login link</strong><br><a href="${signInUrl}" style="color:#377d41;">${escapeHtml(signInUrl)}</a></td></tr>
        <tr><td style="font-size:14px;padding:4px 0;"><strong>Username</strong><br>${escapeHtml(input.username)}</td></tr>
      </table>
      <p style="margin:0;font-size:15px;line-height:1.5;">Ask the parent for the password if you do not already have it. On the sign-in screen, choose <strong>${escapeHtml(input.roleLabel)}</strong>. We will email you a one-time code.</p>
    `,
  );

  await sendMail({
    to: input.to,
    userId: input.userId,
    type: "account.role-invite",
    subject,
    text,
    html,
    logBody: `${input.roleLabel} portal link sent to ${input.to} for ${input.childName}. Password was not included.`,
  });
}

export async function sendCompletionEmail(input: {
  to: string;
  adultFirstName: string;
  childName: string;
  userId: string;
}): Promise<void> {
  const subject = `You have completed the career assessment for ${input.childName}`;
  const text = [
    `Dear ${input.adultFirstName},`,
    "",
    `You have completed the career assessment for ${input.childName}.`,
    "You will receive the report by email shortly.",
    "",
    "Thank you.",
    "Prakramika Vocational Institute",
  ].join("\n");

  const html = wrapHtml(
    "Assessment complete",
    `
      <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">Dear ${escapeHtml(input.adultFirstName)},</p>
      <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">You have completed the career assessment for <strong>${escapeHtml(input.childName)}</strong>.</p>
      <p style="margin:0;font-size:16px;line-height:1.5;">You will receive the report by email shortly.</p>
    `,
  );

  await sendMail({
    to: input.to,
    userId: input.userId,
    type: "assessment.completed",
    subject,
    text,
    html,
    logBody: `Completion email sent for ${input.childName}. Phase 1 does not attach a report.`,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export type DemoInbox = {
  from: string;
  to: string;
  subject: string;
  code?: string;
  password?: string;
  note: string;
};

export function demoInbox(input: {
  to: string;
  subject: string;
  code?: string;
  password?: string;
}): DemoInbox | undefined {
  if (!fakeMail) return undefined;
  return {
    from: env.smtp.from,
    to: input.to,
    subject: input.subject,
    code: input.code,
    password: input.password,
    note: "Local demo inbox — SMTP is not connected. This letter would go to that person's mailbox when mail is switched on.",
  };
}
