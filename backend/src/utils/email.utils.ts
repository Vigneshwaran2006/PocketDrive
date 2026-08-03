import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// verify connection
transporter.verify((error) => {
  if (error) {
    console.error("Email service error:", error);
  } else {
    console.log("Email service ready ✅");
  }
});

export const sendVerificationEmail = async (
  email: string,
  full_name: string,
  token: string
): Promise<void> => {
  const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Verify your PocketDrive account",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background-color: #2563eb; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">PocketDrive</h1>
              <p style="color: #bfdbfe; margin: 5px 0 0 0;">Your Personal Document Vault</p>
            </div>
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin-top: 0;">Hello, ${full_name}!</h2>
              <p style="color: #475569; line-height: 1.6;">
                Welcome to PocketDrive! Please verify your email address to activate your account and start organizing your documents securely.
              </p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${verificationUrl}" 
                   style="background-color: #2563eb; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                This link will expire in <strong>24 hours</strong>. If you did not create a PocketDrive account, you can safely ignore this email.
              </p>
              <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  If the button above doesn't work, copy and paste this link into your browser:
                </p>
                <p style="color: #2563eb; font-size: 12px; word-break: break-all;">${verificationUrl}</p>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © 2024 PocketDrive. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
};

export const sendPasswordResetEmail = async (
  email: string,
  full_name: string,
  token: string
): Promise<void> => {
  const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Reset your PocketDrive password",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0;">
          <div style="max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background-color: #dc2626; padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">PocketDrive</h1>
              <p style="color: #fecaca; margin: 5px 0 0 0;">Password Reset Request</p>
            </div>
            <div style="padding: 40px 30px;">
              <h2 style="color: #1e293b; margin-top: 0;">Hello, ${full_name}!</h2>
              <p style="color: #475569; line-height: 1.6;">
                We received a request to reset your PocketDrive password. Click the button below to create a new password.
              </p>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #dc2626; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #64748b; font-size: 14px; line-height: 1.6;">
                This link will expire in <strong>1 hour</strong>. If you did not request a password reset, please ignore this email. Your password will remain unchanged.
              </p>
              <div style="border-top: 1px solid #e2e8f0; margin-top: 30px; padding-top: 20px;">
                <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                  If the button above doesn't work, copy and paste this link into your browser:
                </p>
                <p style="color: #dc2626; font-size: 12px; word-break: break-all;">${resetUrl}</p>
              </div>
            </div>
            <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0;">
                © 2024 PocketDrive. All rights reserved.
              </p>
            </div>
          </div>
        </body>
      </html>
    `,
  });
};