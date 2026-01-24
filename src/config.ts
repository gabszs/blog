import type { Site, SocialObjects } from "./types";

export const SITE: Site = {
  website: "https://portfile.dev/", // replace this with your deployed domain
  author: "Gabriel Carvalho",
  profile: "https://www.linkedin.com/in/gabzsz/",
  desc: "My Personal blog to describe my adventures into Code World.",
  title: "Gabriel Carvalho",
  ogImage: "shanghai-street.jpg",
  lightAndDarkMode: true,
  postPerIndex: 4,
  postPerPage: 4,
  scheduledPostMargin: 15 * 60 * 1000, // 15 minutes
  showArchives: true,
  showBackButton: true, // show back button in post detail
  editPost: {
    enabled: true,
    text: "Edit page",
    url: "https://github.com/gabszs/portfolio-web/edit/main/",
  },
  dynamicOgImage: true,
  dir: "ltr", // "rtl" | "auto"
  lang: "en", // html lang code. Set this empty and default will be "en"
  timezone: "Asia/Bangkok", // Default global timezone (IANA format) https://en.wikipedia.org/wiki/List_of_tz_database_time_zones
} as const;

export const LOGO_IMAGE = {
  enable: false,
  svg: true,
  width: 216,
  height: 46,
};

export const SOCIALS: SocialObjects = [
  {
    name: "Github",
    href: "https://github.com/gabszs",
    linkTitle: ` ${SITE.title} on Github`,
    active: true,
  },
  {
    name: "LinkedIn",
    href: "https://www.linkedin.com/in/gabzsz/",
    linkTitle: `${SITE.title} on LinkedIn`,
    active: true,
  },
  {
    name: "Mail",
    href: "mailto:gabrielcarvalho.workk@gmail.com",
    linkTitle: `Send an email to ${SITE.title}`,
    active: true,
  },
  {
    name: "WhatsApp",
    href: "https://wa.me/5511947047830",
    linkTitle: `${SITE.title} on WhatsApp`,
    active: true,
  },
];
