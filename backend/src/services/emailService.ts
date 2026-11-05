import 'dotenv/config';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';

// ── JWT Magic Link Token Helpers ───────────────────────────────────────────
export function generateTransferApprovalToken(transferId: string): string {
  const secret = process.env.JWT_SECRET || 'mokada-wenne';
  return jwt.sign(
    { transferId, action: 'release_transfer' },
    secret,
    { expiresIn: '14d' }
  );
}

export function verifyTransferTokenPayload(token: string): { transferId: string } | null {
  try {
    const secret = process.env.JWT_SECRET || 'mokada-wenne';
    const decoded = jwt.verify(token, secret) as any;
    if (decoded && decoded.transferId && decoded.action === 'release_transfer') {
      return { transferId: decoded.transferId };
    }
    return null;
  } catch {
    return null;
  }
}

// ── Transporter Helper (Dynamically Evaluated) ─────────────────────────────
function getTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const isSecure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: { user, pass },
  });
}

function getFrontendBaseUrl(): string {
  const raw = process.env.FRONTEND_URL || process.env.APP_URL || 'https://maga-labor-enty.vercel.app';
  return raw.trim().replace(/\/+$/, '');
}

/**
 * Dispatches an email or logs a rich formatted preview if SMTP is not configured.
 */
async function sendMailSafe(options: {
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; messageId?: string }> {
  try {
    const transporter = getTransporter();
    const smtpUser = process.env.SMTP_USER;

    // Sender resolution: If using a Gmail account, 'from' must match SMTP_USER to avoid Google rejection
    const fromAddress =
      smtpUser && smtpUser.includes('@gmail.com')
        ? `"MAGA Mobilization Portal" <${smtpUser}>`
        : process.env.SMTP_FROM || (smtpUser ? `"MAGA Mobilization Portal" <${smtpUser}>` : 'MAGA Mobilization Portal <no-reply@maga.lk>');

    let toRecipients = Array.isArray(options.to) ? options.to.filter(Boolean) : [options.to];
    let ccRecipients = Array.isArray(options.cc) ? options.cc.filter(Boolean) : (options.cc ? [options.cc] : []);

    // For developer testing: if project emails in DB are dummy (@maga.lk), always CC the test SMTP_USER so they see the real email
    if (smtpUser && !toRecipients.includes(smtpUser) && !ccRecipients.includes(smtpUser)) {
      ccRecipients.push(smtpUser);
    }

    if (toRecipients.length === 0) {
      if (smtpUser) {
        toRecipients = [smtpUser];
      } else {
        console.warn('[EMAIL SERVICE] No valid recipient specified. Skipping dispatch.');
        return { success: false };
      }
    }

    if (!transporter) {
      console.log('─────────────────────────────────────────────────────────────────');
      console.log('📧 [MAGA EMAIL SERVICE - DEV/MOCK DISPATCH]');
      console.log(`   To:      ${toRecipients.join(', ')}`);
      if (ccRecipients.length > 0) console.log(`   CC:      ${ccRecipients.join(', ')}`);
      console.log(`   Subject: ${options.subject}`);
      console.log(`   Notice:  SMTP_USER is not configured in .env. To send real emails,`);
      console.log(`            set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in backend/.env`);
      console.log('─────────────────────────────────────────────────────────────────');
      return { success: true, messageId: `mock-${Date.now()}` };
    }

    console.log(`[EMAIL SERVICE] Sending email to: ${toRecipients.join(', ')} (CC: ${ccRecipients.join(', ')}) ...`);

    const info = await transporter.sendMail({
      from: fromAddress,
      to: toRecipients.join(', '),
      cc: ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined,
      subject: options.subject,
      text: options.text || 'Please view this message in an HTML-capable email viewer.',
      html: options.html,
    });

    console.log(`[EMAIL SERVICE] SUCCESS! Email delivered with ID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[EMAIL SERVICE ERROR] Failed to send email:', error);
    // Return gracefully so the transfer transaction does not fail due to SMTP server issues
    return { success: false };
  }
}

// ── Email Styling Helpers ──────────────────────────────────────────────────
function getMagaHeader(title: string, subTitle: string = 'Inter-Site Personnel Mobilization & Transfer Advisory'): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #002B49 0%, #001B30 100%); border-top-left-radius: 8px; border-top-right-radius: 8px; padding: 24px 28px; color: #FFFFFF;">
      <tr>
        <td>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: middle;">
                <div style="font-size: 20px; font-weight: 800; letter-spacing: 1.5px; color: #FFFFFF; font-family: 'Segoe UI', Helvetica, Arial, sans-serif;">
                  MAGA
                </div>
                <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.5px; color: #E5A93C; text-transform: uppercase; margin-top: 2px;">
                  MAGA ENGINEERING (PVT) LTD
                </div>
                <div style="font-size: 12px; color: #B0C4DE; margin-top: 4px;">
                  ${subTitle}
                </div>
              </td>
              <td align="right" style="vertical-align: middle;">
                <span style="background: rgba(229, 169, 60, 0.15); border: 1px solid #E5A93C; color: #FFD27D; font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-block;">
                  Official Notice
                </span>
              </td>
            </tr>
          </table>
          <div style="height: 1px; background: rgba(255,255,255,0.15); margin: 18px 0 14px 0;"></div>
          <div style="font-size: 16px; font-weight: 700; color: #FFFFFF;">
            ${title}
          </div>
        </td>
      </tr>
    </table>
  `;
}

function getMagaFooter(): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #F4F6F9; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; padding: 20px 28px; border-top: 1px solid #E2E8F0; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 11px; color: #64748B;">
      <tr>
        <td>
          <p style="margin: 0 0 6px 0; font-weight: 600; color: #334155;">
            MAGA ENGINEERING (PVT) LTD &bull; Corporate Plant &amp; Labor Administration
          </p>
          <p style="margin: 0 0 4px 0; line-height: 1.4;">
            Head Office: 200, Nawala Road, Narahenpita, Colombo 05, Sri Lanka | Phone: +94 11 280 8835 | Web: www.maga.lk
          </p>
          <p style="margin: 0; color: #94A3B8; font-style: italic;">
            This is an automated operational notification generated by the MAGA Central ERP &amp; Labor Mobilization System.
          </p>
        </td>
      </tr>
    </table>
  `;
}

// ── Types ──────────────────────────────────────────────────────────────────
export interface TransferNotificationPayload {
  transferId: string;
  employee: {
    fullName: string;
    employeeCode: string;
    nicNo?: string | null;
    tradeGroupName?: string | null;
  };
  fromProject: {
    projectCode: string;
    projectName: string;
    email?: string | null;
    projectManager?: string | null;
  };
  toProject: {
    projectCode: string;
    projectName: string;
    email?: string | null;
    projectManager?: string | null;
  };
  requestedDate: Date | string;
  effectiveReleaseDate?: Date | string;
  requestRemarks?: string | null;
  releaseRemarks?: string | null;
}

// ── 1. SEND TRANSFER REQUEST EMAIL (Action Required from Releasing PM) ─────
export async function sendTransferRequestedEmail(data: TransferNotificationPayload): Promise<void> {
  const reqDateStr = new Date(data.requestedDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const token = generateTransferApprovalToken(data.transferId);
  const baseUrl = getFrontendBaseUrl();
  const reviewPortalUrl = `${baseUrl}/transfers/review?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Inter-Site Transfer Request</title>
    </head>
    <body style="margin: 0; padding: 24px; background-color: #EDF2F7; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #1E293B;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #CBD5E1;">
        <tr>
          <td>
            ${getMagaHeader(
              `ACTION REQUIRED: Inter-Site Personnel Transfer Request`,
              `Mobilization Request for ${data.employee.fullName} (${data.employee.employeeCode})`
            )}

            <div style="padding: 24px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #334155;">
                Dear <strong>Project Manager / Site Administrator</strong> (<strong>${data.fromProject.projectName}</strong> - <code>${data.fromProject.projectCode}</code>),
              </p>
              <p style="margin: 0 0 20px 0; font-size: 13px; line-height: 1.6; color: #475569;">
                A mobilization request has been submitted by <strong>${data.toProject.projectName} (${data.toProject.projectCode})</strong> to transfer the following employee from your project site to their station.
              </p>

              <!-- Personnel Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; margin-bottom: 20px; overflow: hidden;">
                <tr>
                  <td style="padding: 14px 18px; border-bottom: 1px solid #E2E8F0; background: #0F172A; color: #FFFFFF;">
                    <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; color: #94A3B8; font-weight: 600;">
                      Personnel Identification &amp; Trade
                    </div>
                    <div style="font-size: 16px; font-weight: 700; color: #FFFFFF; margin-top: 2px;">
                      ${data.employee.fullName}
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 18px;">
                    <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; color: #334155;">
                      <tr>
                        <td width="35%" style="color: #64748B; font-weight: 500;">Employee / EPF Code:</td>
                        <td width="65%" style="font-weight: 700; font-family: monospace; color: #0F172A;">${data.employee.employeeCode}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748B; font-weight: 500;">National Identity (NIC):</td>
                        <td style="font-weight: 600;">${data.employee.nicNo || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748B; font-weight: 500;">Designation / Trade:</td>
                        <td>
                          <span style="background: #E2E8F0; color: #1E293B; font-weight: 600; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                            ${data.employee.tradeGroupName || 'General Labour'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #64748B; font-weight: 500;">Current Project Station:</td>
                        <td style="font-weight: 600; color: #B45309;">${data.fromProject.projectName} (${data.fromProject.projectCode})</td>
                      </tr>
                      <tr>
                        <td style="color: #64748B; font-weight: 500;">Requesting Project Station:</td>
                        <td style="font-weight: 600; color: #0284C7;">${data.toProject.projectName} (${data.toProject.projectCode})</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Transfer Details Card -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; margin-bottom: 22px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <div style="font-size: 12px; font-weight: 700; color: #92400E; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                      Requested Mobilization Timeline
                    </div>
                    <div style="font-size: 13px; color: #78350F; line-height: 1.5;">
                      <div><strong>Requested Transfer Date:</strong> <span style="background: #FEEBC8; padding: 3px 8px; border-radius: 4px; font-weight: 700; color: #744210;">${reqDateStr}</span></div>
                      ${data.requestRemarks ? `<div style="margin-top: 8px;"><strong>Request Justification / Scope:</strong> <em>"${data.requestRemarks}"</em></div>` : ''}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Notice for Releasing PM -->
              <div style="background: #EFF6FF; border-left: 4px solid #2563EB; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; font-size: 12px; color: #1E40AF; line-height: 1.5;">
                <strong>Notice for Releasing Project Manager:</strong><br/>
                If ongoing critical works prevent releasing this worker on the requested date, you can <strong>reschedule the "Actual Effective Release Date"</strong> to your convenient date when approving in the portal.
              </div>

              <!-- Action Call to Action Button -->
              <div style="text-align: center; margin: 28px 0 20px 0;">
                <a href="${reviewPortalUrl}" style="background-color: #002B49; color: #FFFFFF; font-weight: 700; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 6px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 2px 6px rgba(0,43,73,0.3);">
                  Review &amp; Confirm Release Date
                </a>
              </div>

              <p style="text-align: center; font-size: 11px; color: #64748B; margin: 0;">
                Alternatively, open your Site Management Portal &gt; Employees Master &gt; Pending Inter-Site Release Requests.
              </p>
            </div>

            ${getMagaFooter()}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const recipients = [data.fromProject.email].filter(Boolean) as string[];
  const ccRecipients = [data.toProject.email].filter(Boolean) as string[];

  await sendMailSafe({
    to: recipients.length > 0 ? recipients : ['projectmanager@maga.lk'],
    cc: ccRecipients,
    subject: `[ACTION REQUIRED] Inter-Site Transfer Request: ${data.employee.employeeCode} - ${data.employee.fullName} (${data.fromProject.projectCode} → ${data.toProject.projectCode})`,
    html,
  });
}

// ── 2. SEND TRANSFER APPROVED & AUTO-TRANSFERRED EMAIL ─────────────────────
export async function sendTransferApprovedEmail(data: TransferNotificationPayload): Promise<void> {
  const reqDateStr = new Date(data.requestedDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const actualDateStr = new Date(data.effectiveReleaseDate || data.requestedDate).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Transfer Approved & Mobilized</title>
    </head>
    <body style="margin: 0; padding: 24px; background-color: #EDF2F7; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #1E293B;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #CBD5E1;">
        <tr>
          <td>
            ${getMagaHeader(
              `CONFIRMED: Personnel Mobilization & Transfer Complete`,
              `Automated Handshake Execution Completed for ${data.employee.fullName}`
            )}

            <div style="padding: 24px 28px;">
              <div style="background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px;">
                <div style="font-size: 14px; font-weight: 700; color: #065F46; display: flex; align-items: center; gap: 8px;">
                  &#10004; Transfer Confirmed &amp; Auto-Executed
                </div>
                <div style="font-size: 13px; color: #047857; margin-top: 4px; line-height: 1.5;">
                  The releasing project manager has approved this transfer. The employee has been automatically deactivated at <strong>${data.fromProject.projectName}</strong> and enrolled into the active roster of <strong>${data.toProject.projectName}</strong>.
                </div>
              </div>

              <!-- Personnel & Timeline Table -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; margin-bottom: 20px;">
                <tr>
                  <td style="padding: 16px 18px;">
                    <table role="presentation" width="100%" cellpadding="6" cellspacing="0" style="font-size: 13px; color: #334155;">
                      <tr>
                        <td width="35%" style="color: #64748B; font-weight: 500;">Personnel Name:</td>
                        <td width="65%" style="font-weight: 700; color: #0F172A;">${data.employee.fullName} (${data.employee.employeeCode})</td>
                      </tr>
                      <tr>
                        <td style="color: #64748B; font-weight: 500;">Trade Group:</td>
                        <td style="font-weight: 600;">${data.employee.tradeGroupName || 'General Labour'}</td>
                      </tr>
                      <tr>
                        <td style="color: #64748B; font-weight: 500;">Released From:</td>
                        <td style="font-weight: 600; color: #475569;">${data.fromProject.projectName} (${data.fromProject.projectCode})</td>
                      </tr>
                      <tr>
                        <td style="color: #64748B; font-weight: 500;">Transferred To:</td>
                        <td style="font-weight: 700; color: #0369A1;">${data.toProject.projectName} (${data.toProject.projectCode})</td>
                      </tr>
                      <tr>
                        <td style="color: #64748B; font-weight: 500;">Originally Requested Date:</td>
                        <td style="color: #64748B;">${reqDateStr}</td>
                      </tr>
                      <tr style="background: #FEF3C7;">
                        <td style="color: #92400E; font-weight: 700; padding: 8px 6px;">Actual Effective Release Date:</td>
                        <td style="font-weight: 800; color: #78350F; padding: 8px 6px; font-size: 14px;">${actualDateStr}</td>
                      </tr>
                      ${data.releaseRemarks ? `
                      <tr>
                        <td style="color: #64748B; font-weight: 500; vertical-align: top;">Releasing Remarks:</td>
                        <td style="font-style: italic; color: #1E293B;">"${data.releaseRemarks}"</td>
                      </tr>` : ''}
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size: 12px; color: #64748B; line-height: 1.5; margin: 0;">
                Both project sites may now view this updated status under their respective Daily Sheets and Employee Masters.
              </p>
            </div>

            ${getMagaFooter()}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const recipients = [data.toProject.email, data.fromProject.email].filter(Boolean) as string[];

  await sendMailSafe({
    to: recipients.length > 0 ? recipients : ['projectmanager@maga.lk'],
    subject: `[CONFIRMED] Personnel Transferred: ${data.employee.employeeCode} - ${data.employee.fullName} (${data.fromProject.projectCode} → ${data.toProject.projectCode})`,
    html,
  });
}

// ── 3. SEND TRANSFER REJECTED EMAIL ───────────────────────────────────────
export async function sendTransferRejectedEmail(data: TransferNotificationPayload & { reason: string }): Promise<void> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Transfer Request Declined</title>
    </head>
    <body style="margin: 0; padding: 24px; background-color: #EDF2F7; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; color: #1E293B;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 650px; margin: 0 auto; background: #FFFFFF; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); overflow: hidden; border: 1px solid #CBD5E1;">
        <tr>
          <td>
            ${getMagaHeader(
              `NOTICE: Inter-Site Personnel Transfer Declined`,
              `Request for ${data.employee.fullName} (${data.employee.employeeCode})`
            )}

            <div style="padding: 24px 28px;">
              <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.5; color: #334155;">
                Dear <strong>Project Manager</strong> (<strong>${data.toProject.projectName}</strong>),
              </p>
              <p style="margin: 0 0 18px 0; font-size: 13px; line-height: 1.6; color: #475569;">
                Your transfer request for <strong>${data.employee.fullName} (${data.employee.employeeCode})</strong> stationed at <strong>${data.fromProject.projectName}</strong> has been <strong>declined</strong> by the releasing station at this time.
              </p>

              <div style="background: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 6px; padding: 14px 18px; margin-bottom: 20px;">
                <div style="font-size: 12px; font-weight: 700; color: #991B1B; text-transform: uppercase; letter-spacing: 0.5px;">
                  Reason / Justification Provided by Releasing Station:
                </div>
                <div style="font-size: 13px; color: #7F1D1D; margin-top: 6px; font-style: italic;">
                  "${data.reason || 'Not specified by project manager.'}"
                </div>
              </div>

              <p style="font-size: 12px; color: #64748B; line-height: 1.5; margin: 0;">
                If you have queries regarding labor allocation, please liaise directly with the Project Manager of ${data.fromProject.projectName} or Head Office Plant &amp; Labor Administration.
              </p>
            </div>

            ${getMagaFooter()}
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const recipients = [data.toProject.email].filter(Boolean) as string[];

  await sendMailSafe({
    to: recipients.length > 0 ? recipients : ['projectmanager@maga.lk'],
    subject: `[DECLINED] Inter-Site Transfer Request: ${data.employee.employeeCode} - ${data.employee.fullName}`,
    html,
  });
}
