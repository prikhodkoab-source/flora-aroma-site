export const siteContacts = {
  phoneDisplay: "+38 050 0272882",
  phoneHref: "tel:+380500272882",
  emailDisplay: "Flora_&_Aroma@gmail.com",
  emailHref: "mailto:Flora_%26_Aroma@gmail.com",
  facebookUrl: "https://www.facebook.com/share/1HhvejhSAr/",
  telegramUrl: ""
} as const;

export const socialLinks = [
  {
    key: "facebook",
    label: "Facebook",
    url: siteContacts.facebookUrl
  },
  {
    key: "telegram",
    label: "Telegram",
    url: siteContacts.telegramUrl
  }
].filter((link) => link.url);
