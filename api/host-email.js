import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import { createHash } from 'node:crypto';

const smtpDeliveries=new Map();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EMAIL_TEXT = 'Your Spain portrait is attached. Thanks for visiting!\n\nPowered by PowerWyze Smart Stations\nWebsite: https://powerwyze.com/\nInstagram: https://www.instagram.com/powerwyze/\n\nSpain tourism: https://www.spain.info/en/';

const EMAIL_HTML = `
<!doctype html>
<html lang="en">
  <body style="margin:0;background:#202c33;color:#23333b;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#202c33;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;">
            <tr>
              <td style="background:#23333b;padding:30px 28px;text-align:center;">
                <div style="color:#f5d47a;font-size:12px;letter-spacing:3px;font-weight:bold;">TURESPAÑA PHOTO EXPERIENCE</div>
                <h1 style="margin:12px 0 0;color:#ffffff;font-size:30px;line-height:1.15;">Your Spain portrait is ready.</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 12px;text-align:center;">
                <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">Thanks for discovering Spain with Turespaña. Your personalized event portrait is attached below and included as a downloadable image.</p>
                <img src="cid:turespana-portrait" alt="Your Spain portrait" width="384" style="display:block;width:100%;max-width:384px;height:auto;margin:0 auto;border-radius:12px;border:1px solid #dce4e7;" />
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 28px;text-align:center;">
                <p style="margin:0 0 16px;color:#53636b;font-size:14px;line-height:1.5;">A memory of Spain from Turespaña at IMEX.</p>
                <p style="margin:0 0 8px;font-size:14px;line-height:1.6;">
                  <a href="https://www.spain.info/en/" style="color:#9a6b18;font-weight:bold;text-decoration:none;">Spain tourism website</a>
                  
                </p>
                <p style="margin:0;font-size:14px;line-height:1.6;">
                  <a href="https://powerwyze.com/" style="color:#31596b;font-weight:bold;text-decoration:none;">PowerWyze website</a>
                  <span style="color:#aeb9bd;">&nbsp; · &nbsp;</span>
                  <a href="https://www.instagram.com/powerwyze/" style="color:#31596b;font-weight:bold;text-decoration:none;">@powerwyze</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="background:#f5f7f8;padding:18px 28px;text-align:center;color:#718087;font-size:12px;line-height:1.5;">
                Powered by PowerWyze Smart Stations · AI-powered event experiences
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

function cleanFilename(value, fallback) {
  const name = String(value || fallback).split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '_');
  return name || fallback;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey && !(process.env.WYZER_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD)) {
      res.status(500).send('Email delivery is not configured.');
      return;
    }

    const { email, filename, mimeType, imageBase64 } = req.body || {};
    if (!email || !EMAIL_PATTERN.test(String(email)) || !imageBase64) {
      res.status(400).send('Missing required fields.');
      return;
    }

    const finalMime = String(mimeType || 'image/jpeg').toLowerCase();
    if (!finalMime.startsWith('image/')) {
      res.status(400).send('Only image attachments are supported.');
      return;
    }

    const cleanBase64 = String(imageBase64).replace(/^data:[^;]+;base64,/, '');
    const bytes = Buffer.from(cleanBase64, 'base64');
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) {
      res.status(400).send('Image attachment is empty or too large.');
      return;
    }

    const resend = resendApiKey ? new Resend(resendApiKey) : null;
    const finalFilename = cleanFilename(filename, 'turespana-portrait.jpg');
    const from = process.env.RESEND_FROM_EMAIL || 'Turespaña Photo Booth <onboarding@resend.dev>';
    const replyTo = process.env.RESEND_REPLY_TO;
    // Scope idempotency to the complete provider payload. A template, sender or
    // attachment-name change is a different email; exact retries remain deduplicated.
    const message = {
      from,
      to: [String(email).trim()],
      ...(replyTo ? { replyTo } : {}),
      subject: 'Your Spain portrait',
      html: EMAIL_HTML,
      text: EMAIL_TEXT,
      attachments: [{
        filename: finalFilename,
        content: bytes.toString('base64'),
        contentId: 'turespana-portrait',
      }],
    };
    const deliveryId = createHash('sha256').update(JSON.stringify(message)).digest('hex');
    let data,error;
    if(resend){({data,error}=await resend.emails.send(message,{idempotencyKey:`turespana-photo-${deliveryId}`}));}
    else {
      const user=process.env.WYZER_GMAIL_USER || process.env.GMAIL_USER;
      if(!user)return res.status(503).json({ok:false,error:'Photo email is not configured.'});
      const transport=nodemailer.createTransport({service:'gmail',connectionTimeout:10000,socketTimeout:20000,auth:{user,pass:process.env.WYZER_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD}});
      const task=()=>transport.sendMail({from:{name:'Turespaña',address:user},to:message.to,subject:message.subject,text:message.text,html:message.html,
        messageId:`<turespana-${deliveryId}@powerwyze.com>`,attachments:[{filename:finalFilename,content:bytes,contentType:finalMime,cid:'turespana-portrait'}]});
      const now=Date.now();
      for(const [key,entry] of smtpDeliveries)if(now-entry.at>600000)smtpDeliveries.delete(key);
      if(smtpDeliveries.size>=100)smtpDeliveries.delete(smtpDeliveries.keys().next().value);
      if(!smtpDeliveries.has(deliveryId))smtpDeliveries.set(deliveryId,{at:now,promise:task().catch(error=>{smtpDeliveries.delete(deliveryId);throw error;})});
      const sent=await smtpDeliveries.get(deliveryId).promise;
      if(!sent.accepted?.length){smtpDeliveries.delete(deliveryId);return res.status(502).json({ok:false,error:'Email delivery was not accepted.'});}
      data={id:sent.messageId};
    }

    if (error) {
      console.error('Photo email failed', {name:error.name});
      return res.status(502).json({ ok: false, error: 'Email delivery failed.' });
    }

    return res.status(200).json({ ok: true, id: data?.id || null });
  } catch (e) {
    console.error('Unexpected email delivery error', {name:e?.name});
    return res.status(500).json({ ok: false, error: 'Unexpected email delivery error.' });
  }
}
