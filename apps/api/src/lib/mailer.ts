import nodemailer from "nodemailer";
import { env, isProd } from "../config/env.js";
import { prisma } from "./prisma.js";

const transport = env.smtpHost
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth:
        env.smtpUser && env.smtpPass
          ? { user: env.smtpUser, pass: env.smtpPass }
          : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

type MailInput = {
  to: string;
  subject: string;
  text: string;
  userId?: string;
  type: string;
};

export async function sendMail(input: MailInput): Promise<void> {
  await transport.sendMail({
    from: env.emailFrom,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });

  if (!env.smtpHost) {
    console.log(`[mail:dev] ${input.subject} -> ${input.to}`);
    console.log(input.text);
  }

  if (input.userId) {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        subject: input.subject,
        body: input.text,
        status: "SENT",
        sentAt: new Date(),
      },
    });
  }
}

export async function sendOtpEmail(to: string, code: string, purpose: string, userId?: string): Promise<void> {
  if (!isProd) {
    console.log(`[otp:dev] ${to} ${purpose} ${code}`);
  }
  const purposeLabel = purpose === "password_reset" ? "password reset" : purpose.replaceAll("_", " ");
  await sendMail({
    to,
    userId,
    type: `otp.${purpose}`,
    subject: `PVI-CAP ${purposeLabel} code`,
    text: [
      `Your PVI-CAP ${purposeLabel} code is ${code}.`,
      "It expires in 10 minutes. If you did not request this, ignore this email.",
    ].join("\n"),
  });
}

export async function sendWelcomeEmail(to: string, firstName: string, userId: string): Promise<void> {
  await sendMail({
    to,
    userId,
    type: "account.created",
    subject: "Your PVI-CAP account",
    text: [
      `Hello ${firstName},`,
      "",
      "An account has been created for you on the PVI-CAP Digital Career Assessment Platform.",
      `Sign in at ${env.corsOrigin}`,
      "",
      "If you were not expecting this message, contact Prakramika Vocational Institute.",
    ].join("\n"),
  });
}
