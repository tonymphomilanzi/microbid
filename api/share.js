import { prisma } from "./_lib/prisma.js";

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function truncate(s = "", n = 160) {
  const str = String(s).trim().replace(/\s+/g, " ");
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function htmlDoc({ title, description, image, url, redirectTo }) {
  const t = escapeHtml(title);
  const d = escapeHtml(description);
  const hasImage = Boolean(image);
  const twitterCard = hasImage ? "summary_large_image" : "summary";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${t}</title>
<meta name="description" content="${d}"/>
<meta property="og:title" content="${t}"/>
<meta property="og:description" content="${d}"/>
<meta property="og:url" content="${escapeHtml(url)}"/>
<meta property="og:type" content="website"/>
${hasImage ? `<meta property="og:image" content="${escapeHtml(image)}"/>` : ""}
<meta name="twitter:card" content="${twitterCard}"/>
<meta name="twitter:title" content="${t}"/>
<meta name="twitter:description" content="${d}"/>
${hasImage ? `<meta name="twitter:image" content="${escapeHtml(image)}"/>` : ""}
<link rel="canonical" href="${escapeHtml(url)}"/>
<meta http-equiv="refresh" content="0; url=${escapeHtml(redirectTo)}" />
</head>
<body style="font-family:system-ui,-apple-system,sans-serif;padding:24px;">
  <h1>${t}</h1>
  <p style="color:#666;">${d}</p>
  <p>Redirecting… <a href="${escapeHtml(redirectTo)}">Click here if not redirected</a>.</p>
</body>
</html>`;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).send("Method not allowed");
    }

    const baseUrl = getBaseUrl(req);
    const type = String(req.query?.type || "").toLowerCase();
    const idRaw = req.query?.id;
    const id = Array.isArray(idRaw) ? idRaw[0] : idRaw;

    if (!type || !id) {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(
        htmlDoc({
          title: "Microbid",
          description: "Marketplace updates and listings.",
          image: "",
          url: `${baseUrl}/feed`,
          redirectTo: `/feed`,
        })
      );
    }

    // FEED SHARE
    if (type === "feed") {
      const post = await prisma.feedPost.findUnique({
        where: { id },
        include: { author: { select: { username: true } } },
      });

      if (!post) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(
          htmlDoc({
            title: "Post not found • Microbid",
            description: "This post may have been removed.",
            image: "",
            url: `${baseUrl}/feed`,
            redirectTo: `/feed`,
          })
        );
      }

      const shareUrl = `${baseUrl}/api/share?type=feed&id=${encodeURIComponent(post.id)}`;
      const redirectTo = `/feed/${encodeURIComponent(post.id)}`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=60");

      return res.status(200).send(
        htmlDoc({
          title: post.title,
          description: truncate(post.body, 180),
          image: post.image || "",
          url: shareUrl,
          redirectTo,
        })
      );
    }

    // LISTING SHARE
    if (type === "listing") {
      const listing = await prisma.listing.findUnique({
        where: { id },
        include: { seller: { select: { username: true } } },
      });

      if (!listing) {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.status(200).send(
          htmlDoc({
            title: "Listing not found • Microbid",
            description: "This listing may have been removed.",
            image: "",
            url: `${baseUrl}/marketplace`,
            redirectTo: `/marketplace`,
          })
        );
      }

      const shareUrl = `${baseUrl}/api/share?type=listing&id=${encodeURIComponent(listing.id)}`;
      const redirectTo = `/listings/${encodeURIComponent(listing.id)}`;

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=60");

      return res.status(200).send(
        htmlDoc({
          title: listing.title,
          description: truncate(listing.description, 180),
          image: listing.image || "",
          url: shareUrl,
          redirectTo,
        })
      );
    }

    // Fallback
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(
      htmlDoc({
        title: "Microbid",
        description: "Marketplace updates and listings.",
        image: "",
        url: `${baseUrl}/feed`,
        redirectTo: `/feed`,
      })
    );
  } catch (e) {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.status(500).send(e?.message || "Share error");
  }
}