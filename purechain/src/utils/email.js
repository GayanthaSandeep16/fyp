import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env["EMAIL_USER"],
    pass: process.env["EMAIL_PASS"],
  },
});

/**
 * sendEmail
 * Sends an email to the specified recipient with an HTML-formatted body.
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject.
 * @param {string} htmlContent - HTML content of the email (can include plain text for fallback).
 * @returns {Promise<void>} Resolves when the email is sent, rejects on error.
 */
export const sendEmail = async (to, subject, htmlContent) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to,
    subject,
    text: htmlContent.replace(/<[^>]+>/g, ''), // Fallback plain text by stripping HTML tags
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">${subject}</h2>
        <div style="font-size: 16px; color: #555;">
          ${htmlContent}
        </div>
        <p style="font-size: 14px; color: #777; margin-top: 20px;">
          Best regards,<br/>
          From PureChain Team
        </p>
      </div>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    throw error;
  }
};