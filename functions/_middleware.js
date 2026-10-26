function target(url) {
  const path = url.pathname.toLowerCase();
  const dest = {
    services: "/services",
    equipment: "/equipment",
    aboutus: "/about",
    contactme: "/contact",
    projects: "/projects",
    testimonials: "/testimonials",
    curbdrains: "/services#core-drilling",
    concreteopenings: "/services#flat-sawing",
    marchafbjointcutting: "/projects",
    unitedinactionphotos: "/projects",
    "1993thestartofitall": "/about",
    "1993thestartcontinued": "/about",
    dadandtheboys: "/about"
  };
  if (path === "/splash.asp" || path === "/default.asp") {
    const f = (url.searchParams.get("f") || "").toLowerCase();
    const pg = (url.searchParams.get("pg") || "").toLowerCase();
    if (f === "contactme_sendemailmessage") return "/contact";
    const key = pg || f;
    if (!key) return "/";
    return dest[key] || "/";
  }
  const m = path.match(/^\/default\.asp\.(pg|f)-(.+)$/);
  if (!m) return null;
  return dest[m[2]] || "/";
}

export function onRequest(context) {
  const url = new URL(context.request.url);
  const dest = target(url);
  if (!dest) return context.next();
  return Response.redirect(new URL(dest, url), 301);
}
