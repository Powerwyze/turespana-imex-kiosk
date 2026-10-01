import {readFileSync} from 'node:fs';
export const SPAIN_LOGO=readFileSync(new URL('../public/assets/spain-info-logo.png',import.meta.url));
export const SPAIN_WEBSITE='https://www.spain.info/en/';
export const SPAIN_INSTAGRAM='https://www.instagram.com/spain?stkn=cm80a2E2dW56MGJw';
export const TOURISM_FOOTER_TEXT=`Discover what Spain has to offer
Spain's official tourism website: ${SPAIN_WEBSITE}

Follow us on Instagram: ${SPAIN_INSTAGRAM}

Powered by PowerWyze Smart Stations
Website: https://powerwyze.com/
Instagram: https://www.instagram.com/powerwyze/`;
export const TOURISM_FOOTER_HTML=`
<tr>
  <td style="padding:24px 28px 12px;text-align:center;background:#ffffff;color:#14213d;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto;">
      <tr><td align="center" bgcolor="#ffdf39" style="border-radius:10px;">
        <a href="${SPAIN_WEBSITE}" style="display:inline-block;padding:18px 24px;color:#14213d;font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;line-height:1.4;text-decoration:none;">Discover what Spain has to offer</a>
      </td></tr>
    </table>
    <p style="margin:18px 0 14px;font-size:16px;line-height:1.6;">
      <a href="${SPAIN_WEBSITE}" style="color:#174b75;text-decoration:underline;">Spain's official tourism website</a>
    </p>
    <p style="margin:0 0 8px;font-size:16px;line-height:1.6;">
      <a href="${SPAIN_INSTAGRAM}" style="color:#174b75;font-weight:bold;text-decoration:underline;">Follow us on Instagram</a>
    </p>
  </td>
</tr>
<tr>
  <td style="padding:18px 28px 0;text-align:center;background:#ffffff;color:#66727c;font-size:12px;line-height:1.6;">
    Powered by <a href="https://powerwyze.com/" style="color:#66727c;text-decoration:underline;">PowerWyze Smart Stations</a>
    &nbsp;·&nbsp; <a href="https://www.instagram.com/powerwyze/" style="color:#66727c;text-decoration:underline;">@powerwyze</a>
  </td>
</tr>
<tr>
  <td style="padding:18px 28px 28px;text-align:center;background:#ffffff;">
    <a href="${SPAIN_WEBSITE}" aria-label="Spain's official tourism website" style="text-decoration:none;">
      <img src="cid:spain-tourism-logo" alt="Spain tourism logo" width="150" height="150" style="display:block;width:150px;max-width:100%;height:auto;margin:0 auto;border:0;" />
    </a>
  </td>
</tr>`;
