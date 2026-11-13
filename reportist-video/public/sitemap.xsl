<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"
                xmlns:xhtml="http://www.w3.org/1999/xhtml"
                exclude-result-prefixes="sm xhtml">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="sm:urlset">
    <html lang="en">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>PenguinCut — Sitemap</title>
        <style>
          body { margin: 0; background: #f8f9fa; color: #0f172a;
                 font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          .wrap { max-width: 980px; margin: 0 auto; padding: 48px 24px 64px; }
          header { display: flex; align-items: center; gap: 18px; margin-bottom: 28px; }
          header img { border-radius: 14px; border: 1px solid #e2e8f0; background: #fff; }
          h1 { margin: 0 0 4px; font-size: 1.5rem; font-weight: 800; letter-spacing: -0.03em; }
          .meta { color: #64748b; font-size: 0.9rem; margin: 0; }
          table { width: 100%; border-collapse: collapse; background: #fff;
                  border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;
                  box-shadow: 0 2px 8px rgba(15,23,42,0.06); }
          th, td { text-align: left; padding: 13px 16px; font-size: 0.88rem;
                   border-bottom: 1px solid #eef2f7; vertical-align: middle; }
          th { background: #f8fafc; color: #64748b; font-size: 0.72rem; font-weight: 700;
               letter-spacing: 0.06em; text-transform: uppercase; }
          tr:last-child td { border-bottom: 0; }
          td a { color: #0f172a; font-weight: 700; text-decoration: none; }
          td a:hover { text-decoration: underline; }
          .prio { font-family: ui-monospace, Consolas, monospace; color: #64748b; }
          .note { margin-top: 18px; color: #94a3b8; font-size: 0.78rem; }
          .note a { color: #0f172a; }
        </style>
      </head>
      <body>
        <main class="wrap">
          <header>
            <img src="/icon-512x512.png" width="56" height="56" alt="PenguinCut"/>
            <div>
              <h1>PenguinCut Sitemap</h1>
              <p class="meta"><xsl:value-of select="count(sm:url)"/> URLs across all locales · last updated
                <xsl:value-of select="sm:url[1]/sm:lastmod"/></p>
            </div>
          </header>

          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Languages</th>
                <th>Last modified</th>
                <th>Change</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sm:url">
                <tr>
                  <td>
                    <a>
                      <xsl:attribute name="href"><xsl:value-of select="sm:loc"/></xsl:attribute>
                      <xsl:value-of select="sm:loc"/>
                    </a>
                  </td>
                  <td class="prio"><xsl:value-of select="count(xhtml:link)"/> alternates</td>
                  <td class="prio"><xsl:value-of select="sm:lastmod"/></td>
                  <td class="prio"><xsl:value-of select="sm:changefreq"/></td>
                  <td class="prio"><xsl:value-of select="sm:priority"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>

          <p class="note">This sitemap is maintained automatically. See also
            <a href="/robots.txt">robots.txt</a> and <a href="/">penguincut.com</a>.</p>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
