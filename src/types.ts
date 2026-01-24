export interface Site {
  website: string;
  author: string;
  profile: string;
  desc: string;
  title: string;
  ogImage: string;
  lightAndDarkMode: boolean;
  postPerIndex: number;
  postPerPage: number;
  scheduledPostMargin: number;
  showArchives: boolean;
  showBackButton: boolean;
  editPost: {
    enabled: boolean;
    text: string;
    url: string;
  };
  dynamicOgImage: boolean;
  dir: "ltr" | "rtl" | "auto";
  lang: string;
  timezone: string;
}

export interface SocialObject {
  name: string;
  href: string;
  linkTitle: string;
  active: boolean;
}

export type SocialObjects = SocialObject[];
